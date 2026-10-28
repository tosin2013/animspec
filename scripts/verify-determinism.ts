/**
 * Determinism gate (AnimSpec-only). Offline, no LLM/network. Exits non-zero on failure.
 *
 *   1. No nondeterminism sources (Math.random / Date) and no file, network or
 *      process access in src/ code (static scan).
 *   2. Two independent renders of every primitive + composite hash identically.
 *   3. Hashes match the committed reference set for this machine's processor
 *      type (golden/<type>/hashes.json).
 *
 * Frame-order independence (3b/3c): renders agree across orderings in-process
 * and across fresh child processes (issue #55).
 *
 * Whether a primitive responds to the signal is checked by the reactivity gate
 * in scripts/verify-gates.ts, with time held fixed.
 *
 *   npx tsx scripts/verify-determinism.ts            # verify
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";
import { validateAnimSpec } from "../src/specValidator";
import type { SignalFrame } from "../src/types";
import { PRIMITIVES, profilePalette, sanitizeLayer } from "../src/primitives/registry";
import { paletteViolation } from "../verify/core";
import { registerPlugin } from "../src/plugins";
import { GOOD, THROWER } from "./fixtures/plugins/index";
import { computeHashes, renderCases, orderIndependenceMismatches, HERO_ROLES, goldenAssets, type GoldenApi } from "./lib/goldenHashes";
import { freshProcessChunkMismatches } from "./lib/orderProcesses";
import { comparePixels, otherType, processorType, readSet } from "./lib/referenceSets";
import { checkFontData } from "./generate-fonts";

const ROOT = process.cwd();
const type = processorType();
const GOLDEN = type === null ? null : path.join(ROOT, "golden", type, "hashes.json");

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures++; }
};

/**
 * A deliberately stateful renderer for the order-check self-check: it folds the
 * total number of frames ever drawn into every pixel, so output depends on what
 * came before it. The order check MUST report it as a mismatch, or it is blind.
 */
function statefulApi(): GoldenApi {
  let drawn = 0;
  return {
    PRIMITIVES: [{ type: "stateful" }],
    sanitizeLayer: () => ({}),
    createCanvas: (w, h) => {
      const ctx: { data: Uint8ClampedArray; getImageData: () => { data: Uint8ClampedArray } } = {
        data: new Uint8ClampedArray(w * h * 4),
        getImageData: () => ({ data: ctx.data }),
      };
      return { getContext: () => ctx };
    },
    drawSpec: (ctx, dims: { width: number; height: number }) => {
      drawn += 1;
      ctx.data = new Uint8ClampedArray(dims.width * dims.height * 4).fill(drawn & 0xff);
    },
  };
}

// 1. Static purity: strip comments, then look for nondeterminism sources and
//    IO (no file/network/process modules or references in src/ — the vetting
//    gates' purity rule, enforced statically so unexecuted branches are covered).
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []);
const impure: string[] = [];
const ioOffenders: string[] = [];
// File / network / process / worker imports and references, in any form:
// static `import ... from`, dynamic `await import(...)`, `require(...)`, with
// or without the `node:` prefix, and with an optional `/subpath` (so
// `fs/promises` is caught). Also flags `fetch(`, `XMLHttpRequest`, `WebSocket`
// and `process.cwd` references.
const IO_MODULE = "(fs|fs/promises|path|net|tls|http|http2|https|dns|dgram|child_process|worker_threads)";
const IO_PATTERN = new RegExp(
  String.raw`(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](node:)?${IO_MODULE}(?:/[\w./-]*)?["']` +
    String.raw`|fetch\s*\(|XMLHttpRequest|WebSocket|process\.cwd`,
);
// Self-check: these must ALL be caught, or the pattern has silently regressed.
const IO_SELF_CHECK: Array<[string, string]> = [
  [`import fs from "fs";`, "fs"],
  [`import { readFile } from "fs/promises";`, "fs/promises"],
  [`import fsp from "node:fs/promises";`, "fs/promises"],
  [`const fs = await import("node:fs");`, "fs"],
  [`import tls from "node:tls";`, "tls"],
  [`import http2 from "http2";`, "http2"],
];
for (const [line, what] of IO_SELF_CHECK) {
  if (!IO_PATTERN.test(line)) ioOffenders.push(`static-scan self-check missed: ${line} (${what})`);
}
for (const file of walk(path.join(ROOT, "src"))) {
  const code = stripComments(fs.readFileSync(file, "utf8"));
  const rel = path.relative(ROOT, file);
  if (/Math\.random|Date\.now|new Date\(|performance\.now/.test(code)) impure.push(rel);
  if (IO_PATTERN.test(code)) ioOffenders.push(rel);
}
check("no Math.random / Date / performance.now in src/", impure.length === 0, impure.join(", "));
check("no file/network imports or process.cwd/fetch in src/", ioOffenders.length === 0, ioOffenders.join(", "));

// 1b. Font rule: every `.font =` assignment under src/ must build its value
// from the draw context's font, never a literal family name (contracts/fonts.md).
const fontOffenders: string[] = [];
for (const file of walk(path.join(ROOT, "src"))) {
  const code = stripComments(fs.readFileSync(file, "utf8"));
  const rel = path.relative(ROOT, file);
  // An assignment to a `font` property, written `.font =` or `["font"] =`
  // (a bare `=`, not `==` or `=>`), judged on the rest of its line so a
  // missing semicolon cannot hide a literal behind a later statement.
  for (const m of code.matchAll(/(?:\.font|\[\s*["'`]font["'`]\s*\])\s*=(?![=>])([^\n;]*)/g)) {
    if (!/\bx\.font\b/.test(m[1])) fontOffenders.push(`${rel}: ${m[1].trim().slice(0, 60)}`);
  }
}
check("every .font assignment uses the draw context's font", fontOffenders.length === 0, fontOffenders.join(", "));

// 1c. Font data freshness: the generated modules match their .ttf files.
// checkFontData() prints its own FAIL line when stale.
if (checkFontData()) console.log("  ok    font data is up to date");
else failures++;

// 2. Reference set for this machine's processor type.
if (type === null) {
  check(
    process.platform === "win32"
      ? `no reference set for Windows — exact comparison not made`
      : `no reference set for processor type "${process.arch}" — exact comparison not made`,
    false,
  );
} else {
  console.log(`  ok    reference set: ${type}`);
}

// 3. Two independent renders agree.
const api: GoldenApi = { createCanvas: createCanvas as GoldenApi["createCanvas"], drawSpec, PRIMITIVES, sanitizeLayer, assets: goldenAssets(createCanvas as GoldenApi["createCanvas"]) };
const a = computeHashes(api);
const b = computeHashes(api);
const keys = Object.keys(a);
const unstable = keys.filter((k) => a[k] !== b[k]);
check(`two renders are byte-identical (${keys.length} cases)`, unstable.length === 0, unstable.slice(0, 8).join(", "));

// 3b. Frame-order independence (issue #32): a frame is a pure function of
// (spec, frame, seed), so forward / backward / interleaved-chunk and
// reversed-contiguous-chunk renders must agree per frame, at default and
// generated non-default params. The self-check proves the check rejects a
// stateful renderer.
{
  const order = orderIndependenceMismatches(api);
  check(
    `frames are order-independent (${order.cases} cases × ${order.frames} frames × ${order.orderings} orderings)`,
    order.mismatches.length === 0,
    order.mismatches.slice(0, 8).join(", "),
  );
  const blind = orderIndependenceMismatches(statefulApi()).mismatches.length === 0;
  check("order check rejects a stateful renderer (self-check)", !blind);
}

// 3c. Fresh-process order independence (issue #55): module-level state that
// only warms up inside a process must not change output either, so each
// contiguous half of the sequence is rendered by its own fresh child process
// and compared with the in-process forward render. The self-check runs the
// same comparison with stateful children and MUST report mismatches.
{
  let fresh: string[] = [];
  let warm: string[] = [];
  let error: string | null = null;
  try {
    [fresh, warm] = await Promise.all([
      freshProcessChunkMismatches(api),
      freshProcessChunkMismatches(api, { stateful: true }),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }
  check(
    "fresh-process contiguous chunks match the in-process render (2 child processes)",
    error === null && fresh.length === 0,
    error ?? fresh.slice(0, 8).join(", "),
  );
  check(
    "fresh-process check rejects warm-up state (self-check)",
    error === null && warm.length > 0,
    error ?? (warm.length > 0 ? "" : "no mismatch detected"),
  );
}

// 4. Golden file for this set.
if (GOLDEN === null) {
  // Already failed above via the reference-set check; skip the hash checks.
} else if (!fs.existsSync(GOLDEN)) {
  check("golden file exists", false, "run: npm run golden:update");
} else {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8")) as Record<string, string>;
  const changed = keys.filter((k) => golden[k] !== undefined && golden[k] !== a[k]);
  const missing = keys.filter((k) => golden[k] === undefined);
  const stale = Object.keys(golden).filter((k) => a[k] === undefined);
  check(`hashes match golden/${type}`, changed.length === 0, changed.length === 0 ? "" : `${changed.length} case(s): ${changed.join(", ")}`);
  check("every case has a golden hash", missing.length === 0, missing.length === 0 ? "" : `${missing.length} case(s): ${missing.join(", ")} — run: npm run golden:update`);
  check("no stale golden entries", stale.length === 0, stale.length === 0 ? "" : `${stale.length} case(s): ${stale.join(", ")}`);
}

// 5. Set consistency: both sets hold exactly the same case keys, and every
// stored frame decodes to pixels whose hash equals the stored hash.
{
  const arm = await readSet(path.join(ROOT, "golden", "arm64"));
  const x64 = await readSet(path.join(ROOT, "golden", "x64"));
  const onlyArm = Object.keys(arm.hashes).filter((k) => !(k in x64.hashes));
  const onlyX64 = Object.keys(x64.hashes).filter((k) => !(k in arm.hashes));
  const keyDiff = [...onlyArm.map((k) => `arm64-only: ${k}`), ...onlyX64.map((k) => `x64-only: ${k}`)];
  check("Both sets contain exactly the same case keys", keyDiff.length === 0, keyDiff.join(", "));
  const frameMismatch: string[] = [];
  for (const [setName, set] of [["arm64", arm], ["x64", x64]] as const) {
    for (const [key, rgba] of set.frames) {
      if (crypto.createHash("sha256").update(rgba).digest("hex") !== set.hashes[key]) frameMismatch.push(`${setName}/${key}`);
    }
  }
  check("every stored frame matches its stored hash", frameMismatch.length === 0, frameMismatch.join(", "));
}

// 6. Cross-type tolerance: local renders against the other type's stored
// frames. Fails when maxDelta is greater than CROSS_TYPE_TOLERANCE.
const CROSS_TYPE_TOLERANCE = 8;
{
  const local = renderCases(api);
  const largestAgainst = (frames: Map<string, Uint8ClampedArray>): { largest: number; over: Array<{ key: string; maxDelta: number }> } => {
    let largest = 0;
    const over: Array<{ key: string; maxDelta: number }> = [];
    for (const { key, rgba } of local) {
      const other = frames.get(key);
      if (!other) continue;
      const { maxDelta } = comparePixels(rgba, other);
      if (maxDelta > largest) largest = maxDelta;
      if (maxDelta > CROSS_TYPE_TOLERANCE) over.push({ key, maxDelta });
    }
    return { largest, over };
  };
  if (type === null) {
    // No exact comparison was made (already failed above); still report how
    // far this machine is from each stored set, for information.
    const arm = await readSet(path.join(ROOT, "golden", "arm64"));
    const x64 = await readSet(path.join(ROOT, "golden", "x64"));
    console.log(`  info  largest difference from arm64: ${largestAgainst(arm.frames).largest} of 255; from x64: ${largestAgainst(x64.frames).largest} of 255`);
  } else {
    const other = await readSet(path.join(ROOT, "golden", otherType(type)));
    const { largest, over } = largestAgainst(other.frames);
    if (over.length === 0) console.log(`  ok    within tolerance of ${otherType(type)} (largest difference ${largest} of 255, allowed ${CROSS_TYPE_TOLERANCE})`);
    for (const { key, maxDelta } of over) {
      console.error(`  FAIL  within tolerance of ${otherType(type)} — ${key} differs by ${maxDelta} of 255 (allowed ${CROSS_TYPE_TOLERANCE})`);
      failures++;
    }
  }
}

// 6b. Bound layers (spec 013): a bind drives a param per frame from the
// SignalFrame — deterministic, chunk-stable, and silent about malformed binds.
{
  const bound = validateAnimSpec({
    layers: [{ type: "rig", rig: "host", pose: "talk", bind: { mouthOpen: { from: "amplitude", out: [0, 1] } } }],
  });
  const boundSpec = bound.spec!;
  const frameAt = (i: number, level: number): SignalFrame => ({
    index: i,
    t: i / 30,
    values: Float64Array.from({ length: 16 }, (_, k) => level * ((Math.sin(k / 4 + i / 5) + 1) / 2)),
    spectrum: Float64Array.from({ length: 16 }, (_, k) => level * Math.max(0, 1 - k / 16)),
    amplitude: level,
    energy: level * 0.8,
  });
  const renderBound = (frame: SignalFrame): string => {
    const canvas = createCanvas(320, 180);
    const ctx = canvas.getContext("2d");
    drawSpec(ctx, { width: 320, height: 180 }, frame, boundSpec, { reducedFlicker: true, creative: false, seed: 7 });
    return crypto.createHash("sha256").update(ctx.getImageData(0, 0, 320, 180).data).digest("hex");
  };
  const quiet = renderBound(frameAt(12, 0.02));
  const loud = renderBound(frameAt(12, 0.95));
  check("a bound param follows the signal (quiet != loud)", quiet !== loud);

  // Chunk equality with binds active: frames 3..6 alone match the whole render.
  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => frameAt(i, 0.3 + 0.6 * Math.sin(i / 3)));
  const whole = frames.map(renderBound);
  const part = [3, 4, 5].map((i) => renderBound(frames[i]));
  check(
    "bound chunk render equals the same frames of the whole",
    part.every((h, k) => h === whole[3 + k]),
  );

  // A malformed bind is dropped: the layer renders with static params, byte-
  // identical to the same spec without the bind.
  const staticSpec = validateAnimSpec({ layers: [{ type: "rig", rig: "host", pose: "talk" }] });
  const malformed = validateAnimSpec({ layers: [{ type: "rig", rig: "host", pose: "talk", bind: { pose: { from: "amplitude" } } }] });
  check("a malformed bind is dropped and reported", malformed.errors.some((e) => e.includes("bind dropped")) && !((malformed.spec as any).layers[0].bind));
  const renderStatic = (frame: SignalFrame, spec: any): string => {
    const canvas = createCanvas(320, 180);
    const ctx = canvas.getContext("2d");
    drawSpec(ctx, { width: 320, height: 180 }, frame, spec, { reducedFlicker: true, creative: false, seed: 7 });
    return crypto.createHash("sha256").update(ctx.getImageData(0, 0, 320, 180).data).digest("hex");
  };
  const f = frameAt(12, 0.5);
  check("malformed-bind render equals the static spec", renderStatic(f, malformed.spec) === renderStatic(f, staticSpec.spec));
}

// 7. Camera (spec 014): closed-form per frame, chunk-stable, depth-separated.
{
  const frameAt = (i: number, level = 0.5): SignalFrame => ({
    index: i,
    t: i / 30,
    values: Float64Array.from({ length: 16 }, (_, k) => level * ((Math.sin(k / 4 + i / 5) + 1) / 2)),
    spectrum: Float64Array.from({ length: 16 }, (_, k) => level * Math.max(0, 1 - k / 16)),
    amplitude: level,
    energy: level * 0.8,
  });
  const pixelsCam = (spec: any, i: number, seed = 7, reducedFlicker = true): Uint8ClampedArray => {
    const canvas = createCanvas(320, 180);
    const ctx = canvas.getContext("2d");
    drawSpec(ctx, { width: 320, height: 180 }, frameAt(i), spec, { reducedFlicker, creative: false, seed });
    return ctx.getImageData(0, 0, 320, 180).data;
  };
  const renderCam = (spec: any, i: number, seed = 7, reducedFlicker = true): string =>
    crypto.createHash("sha256").update(pixelsCam(spec, i, seed, reducedFlicker)).digest("hex");
  const withCamera = validateAnimSpec({
    background: "black",
    camera: { move: "push", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 240, zoom: 1.25, x: 0.55, y: 0.45 }, ease: "smooth" },
    layers: [{ type: "grid" }],
  });
  const noCamera = validateAnimSpec({ background: "black", layers: [{ type: "grid" }] });
  check("camera is the identity at from.frame", renderCam(withCamera.spec, 0) === renderCam(noCamera.spec, 0));
  check("camera zooms by to.frame", renderCam(withCamera.spec, 240) !== renderCam(withCamera.spec, 0));

  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => renderCam(withCamera.spec, i));
  const part = [3, 4, 5].map((i) => renderCam(withCamera.spec, i));
  check("camera chunk render equals the whole", part.every((h, k) => h === frames[3 + k]));

  const parallaxCam = { move: "parallax", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 100, zoom: 1.3, x: 0.7, y: 0.5 } };
  const fixedLayer = validateAnimSpec({ background: "black", camera: parallaxCam, layers: [{ type: "grid", depth: 0 }] });
  const movingLayer = validateAnimSpec({ background: "black", camera: parallaxCam, layers: [{ type: "grid", depth: 1 }] });
  check("depth 0 layer is fixed across parallax", renderCam(fixedLayer.spec, 0) === renderCam(fixedLayer.spec, 100));
  check("depth 1 layer moves across parallax", renderCam(movingLayer.spec, 0) !== renderCam(movingLayer.spec, 100));

  // Shake (spec 016): closed-form in frame.t and the seed; off when absent or amp 0.
  const still = { frame: 0, zoom: 1, x: 0.5, y: 0.5 };
  const shaken = (camera: object, layers: object[] = [{ type: "grid" }]) => validateAnimSpec({ background: "black", camera, layers }).spec;
  const staticShake = shaken({ move: "static", from: still, shake: { amp: 0.02, freq: 4 } });
  const staticPlain = shaken({ move: "static", from: still });
  check("shake moves the frame", renderCam(staticShake, 12) !== renderCam(staticPlain, 12));
  check("shake renders identically twice", renderCam(staticShake, 12) === renderCam(staticShake, 12));
  const shakeWhole = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => renderCam(staticShake, i));
  const shakePart = [3, 4, 5].map((i) => renderCam(staticShake, i));
  check("shake chunk render equals the whole", shakePart.every((h, k) => h === shakeWhole[3 + k]));
  check("different seeds shake differently", renderCam(staticPlain, 12, 7) === renderCam(staticPlain, 12, 8) && renderCam(staticShake, 12, 7) !== renderCam(staticShake, 12, 8));
  check("shake amp 0 equals no shake", renderCam(shaken({ move: "static", from: still, shake: { amp: 0, freq: 4 } }), 12) === renderCam(staticPlain, 12));
  check("a static camera shakes", shakeWhole[0] !== renderCam(staticShake, 12));
  check("reduced flicker leaves the shake unchanged", renderCam(staticShake, 12, 7, true) === renderCam(staticShake, 12, 7, false));

  // Zoom does not enlarge the shake: the best-aligning integer shift between the
  // shaken and unshaken frame is the same at zoom 1 and zoom 2, within 1 pixel.
  const bestShift = (a: Uint8ClampedArray, b: Uint8ClampedArray): [number, number] => {
    let best: [number, number] = [0, 0], bestErr = Infinity;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      let err = 0;
      for (let y = 20; y < 160; y += 2) for (let x = 20; x < 300; x += 2) err += Math.abs(a[((y + dy) * 320 + x + dx) * 4] - b[(y * 320 + x) * 4]);
      if (err < bestErr) { bestErr = err; best = [dx, dy]; }
    }
    return best;
  };
  const zoomShift = (zoom: number) => {
    const from = { frame: 0, zoom, x: 0.5, y: 0.5 };
    return bestShift(pixelsCam(shaken({ move: "static", from, shake: { amp: 0.02, freq: 4 } }), 12), pixelsCam(shaken({ move: "static", from }), 12));
  };
  const [s1, s2] = [zoomShift(1), zoomShift(2)];
  check("zoom does not enlarge the shake", (s1[0] !== 0 || s1[1] !== 0) && Math.abs(s1[0] - s2[0]) <= 1 && Math.abs(s1[1] - s2[1]) <= 1);

  // Under parallax the shake is scaled by depth; other moves ignore depth.
  const parallaxStill = { move: "parallax", from: still, to: { ...still, frame: 100 } };
  const shakeAt = (camera: object, depth: number) => [shaken({ ...camera, shake: { amp: 0.02, freq: 4 } }, [{ type: "grid", depth }]), shaken(camera, [{ type: "grid", depth }])];
  const [p0s, p0] = shakeAt(parallaxStill, 0);
  const [p1s, p1] = shakeAt(parallaxStill, 1);
  check("depth 0 layer does not shake under parallax", renderCam(p0s, 12) === renderCam(p0, 12));
  check("depth 1 layer shakes under parallax", renderCam(p1s, 12) !== renderCam(p1, 12));
  const [pan0s, pan0] = shakeAt({ move: "pan", from: still, to: { ...still, frame: 100 } }, 0);
  check("a non-parallax move ignores depth", renderCam(pan0s, 12) !== renderCam(pan0, 12));

  // Wider range (spec 016): a pan to x 1.5 ends where a static camera at 1.5 looks.
  const at = (x: number) => ({ frame: 0, zoom: 1, x, y: 0.5 });
  const wide = shaken({ move: "pan", from: at(0.5), to: { ...at(1.5), frame: 47 } }, [{ type: "grid" }, { type: "dots" }]);
  const end15 = shaken({ move: "static", from: at(1.5) }, [{ type: "grid" }, { type: "dots" }]);
  const end05 = shaken({ move: "static", from: at(0.5) }, [{ type: "grid" }, { type: "dots" }]);
  check("a pan to x 1.5 ends one frame right of x 0.5", renderCam(wide, 47) === renderCam(end15, 47) && renderCam(wide, 47) !== renderCam(end05, 47));
}

// Transparent background (spec 017): empty pixels are alpha 0, covered fg is
// opaque in fg, frames repeat and chunk exactly, and ink needs "transparent".
{
  const frameAt = (i: number): SignalFrame => ({
    index: i,
    t: i / 30,
    values: Float64Array.from({ length: 16 }, (_, k) => 0.5 * ((Math.sin(k / 4 + i / 5) + 1) / 2)),
    spectrum: Float64Array.from({ length: 16 }, (_, k) => 0.5 * Math.max(0, 1 - k / 16)),
    amplitude: 0.5,
    energy: 0.4,
  });
  const pixels = (spec: any, i: number): Uint8ClampedArray => {
    const ctx = createCanvas(320, 180).getContext("2d");
    drawSpec(ctx, { width: 320, height: 180 }, frameAt(i), spec, { reducedFlicker: true, creative: false, seed: 7 });
    return ctx.getImageData(0, 0, 320, 180).data;
  };
  const hash = (spec: any, i: number): string => crypto.createHash("sha256").update(pixels(spec, i)).digest("hex");
  for (const ink of ["light", "dark"] as const) {
    const [bgv, fgv] = ink === "light" ? [0, 255] : [255, 0];
    for (const type of ["grid", "dots"]) {
      const solid = pixels({ background: ink === "light" ? "black" : "white", layers: [{ type }] }, 12);
      const clear = pixels({ background: "transparent", ink, layers: [{ type }] }, 12);
      let empty = 0, emptyOk = 0, covered = 0, coveredOk = 0;
      for (let i = 0; i < solid.length; i += 4) {
        const same = (v: number) => solid[i] === v && solid[i + 1] === v && solid[i + 2] === v;
        if (same(bgv)) { empty++; if (clear[i + 3] === 0) emptyOk++; }
        if (same(fgv)) { covered++; if (clear[i + 3] === 255 && clear[i] === fgv && clear[i + 1] === fgv && clear[i + 2] === fgv) coveredOk++; }
      }
      check(`${ink} ink: empty pixels are transparent (${type})`, empty > 0 && emptyOk === empty);
      check(`${ink} ink: covered fg pixels are opaque (${type})`, covered === 0 || coveredOk === covered);
    }
    const spec = { background: "transparent", ink, layers: [{ type: "grid" }, { type: "wave" }] };
    check(`${ink} ink: transparent renders identically twice`, hash(spec, 12) === hash(spec, 12));
    const whole = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => hash(spec, i));
    check(`${ink} ink: transparent chunk render equals the whole`, [3, 4, 5].every((i) => hash(spec, i) === whole[i]));
  }
  check("a solid spec ignores ink", hash({ background: "black", ink: "dark", layers: [{ type: "grid" }] }, 12) === hash({ background: "black", layers: [{ type: "grid" }] }, 12));
}

// Designed grid patterns (spec 018): the quilt draws its cells, designed cells
// ignore the signal, ~ cells match the unpatterned grid, breaks touch only their
// cell, in any order, and solid stays exact.
{
  const W = 320, H = 180;
  const QUILT = "##.a.##/#.....#/..###../#.....#/##.a.##";
  const frameAt = (i: number, level: number): SignalFrame => ({
    index: i,
    t: i / 30,
    values: Float64Array.from({ length: 64 }, (_, k) => level * ((Math.sin(k / 4 + i / 5) + 1) / 2)),
    spectrum: Float64Array.from({ length: 64 }, (_, k) => level * Math.max(0, 1 - k / 64)),
    amplitude: level,
    energy: level * 0.8,
  });
  const px = (spec: any, i = 12, level = 0.5, creative = false): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(i, level), validateAnimSpec(spec).spec as any, { reducedFlicker: true, creative, seed: 7 });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const quilt = (extra: Record<string, unknown> = {}) => ({ accent: "#ff2d2d", layers: [{ type: "grid", pattern: QUILT, ...extra }] });
  const rows = QUILT.split("/");
  let cellsOk = true;
  for (const level of [0.02, 0.5, 0.95]) {
    const d = px(quilt({ solid: true }), 12, level, true);
    rows.forEach((row, r) => [...row].forEach((letter, c) => {
      const i = (Math.floor(((r + 0.5) * H) / rows.length) * W + Math.floor(((c + 0.5) * W) / row.length)) * 4;
      const want = letter === "#" ? [255, 255, 255] : letter === "a" ? [255, 45, 45] : [0, 0, 0];
      if (d[i] !== want[0] || d[i + 1] !== want[1] || d[i + 2] !== want[2]) cellsOk = false;
    }));
  }
  check("quilt cells match the pattern at quiet, mid and loud", cellsOk);
  check("designed cells ignore the signal", hashOf(px(quilt(), 12, 0.02)) === hashOf(px(quilt(), 12, 0.95)));
  const allSignal = Array.from({ length: 5 }, () => "~~~~~~~").join("/");
  check("an all-~ pattern equals the unpatterned grid", hashOf(px({ layers: [{ type: "grid", pattern: allSignal }] })) === hashOf(px({ layers: [{ type: "grid", cols: 7, rows: 5 }] })));
  const exact = (d: Uint8ClampedArray) => { for (let i = 0; i < d.length; i += 4) { const k = `${d[i]},${d[i + 1]},${d[i + 2]}`; if (k !== "0,0,0" && k !== "255,255,255" && k !== "255,45,45") return false; } return true; };
  check("solid pattern uses only bg, fg and accent", exact(px(quilt({ solid: true }), 12, 0.5, true)));
  const whole = [0, 1, 2, 3, 4, 5].map((i) => hashOf(px(quilt({ breaks: "3,2 r15" }), i)));
  check("patterned chunk render equals the whole", [2, 3, 4].every((i) => hashOf(px(quilt({ breaks: "3,2 r15" }), i)) === whole[i]));
  const clear = px({ background: "transparent", layers: [{ type: "grid", pattern: QUILT }] });
  check("a transparent patterned grid has alpha 0 in . cells", clear[(Math.floor(0.5 * H / 5) * W + Math.floor(2.5 * W / 7)) * 4 + 3] === 0);
  const ck = px({ layers: [{ type: "checker", pattern: "#./.#", size: 40 }] });
  const sq = (c: number, r: number) => ck[((r * 40 + 20) * W + c * 40 + 20) * 4];
  check("checker pattern tiles", sq(0, 0) === sq(2, 0) && sq(1, 1) === sq(3, 1) && sq(0, 0) !== sq(1, 0));

  // Breaks (#101).
  const plain = px(quilt({ solid: true }), 12, 0.5, true);
  const one = px(quilt({ solid: true, breaks: "3,2 r15" }), 12, 0.5, true);
  // Cell (3,2) spans x 137..182, y 72..108 at 7 x 5; the turned cell stays within 16 px of it.
  let outsideSame = true, insideDiffers = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, near = x >= 137 - 16 && x <= 183 + 16 && y >= 72 - 16 && y <= 108 + 16;
    const same = plain[i] === one[i] && plain[i + 1] === one[i + 1] && plain[i + 2] === one[i + 2];
    if (!near && !same) outsideSame = false;
    if (near && !same) insideDiffers = true;
  }
  check("a break leaves every other pixel unchanged", outsideSame && insideDiffers);
  check("break order does not matter", hashOf(px(quilt({ breaks: "1,1 r10; 3,2 dx0.5; 5,3 dy-0.25" }))) === hashOf(px(quilt({ breaks: "5,3 dy-0.25; 3,2 dx0.5; 1,1 r10" }))));
  check("a cell named twice adds", hashOf(px(quilt({ breaks: "3,2 r10; 3,2 r5" }))) === hashOf(px(quilt({ breaks: "3,2 r15" }))));
  check("breaks clamp", hashOf(px(quilt({ breaks: "3,2 r90" }))) === hashOf(px(quilt({ breaks: "3,2 r45" }))));
  check("solid pattern with a rotated break uses only bg, fg and accent", exact(px(quilt({ solid: true, breaks: "3,2 r15; 0,4 dx0.25; 6,0 r-30 dy0.3" }), 12, 0.5, true)));
}

// Image assets (spec 022): asset colours in creative mode, deterministic,
// chunk-stable, nothing without a bitmap, the legacy path intact; placement,
// flips, crop, opacity, nearest scaling; closed-form wrapping scroll; colour
// modes (palette pixels exact, asset outside creative = palette).
{
  const W = 320, H = 180;
  const ga = goldenAssets(createCanvas as GoldenApi["createCanvas"]) as Record<string, any>;
  const frameAt = (i: number, level = 0.5): SignalFrame => ({
    index: i, t: i / 30,
    values: Float64Array.from({ length: 16 }, () => level),
    spectrum: Float64Array.from({ length: 16 }, () => level),
    amplitude: level, energy: level * 0.8,
  });
  const SHA = "0".repeat(64);
  const decl = (id: string) => ({ [id]: { sha256: SHA, width: ga[id].width, height: ga[id].height } });
  const px = (layer: Record<string, unknown>, opts: { i?: number; level?: number; creative?: boolean; assets?: Record<string, unknown>; roles?: Record<string, string> } = {}): Uint8ClampedArray => {
    const id = (layer.asset as string) ?? "main";
    const spec = validateAnimSpec({ ...(opts.roles ? { roles: opts.roles } : {}), assets: decl(id), layers: [{ type: "image", drive: "none", ...layer }] }).spec as any;
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(opts.i ?? 12, opts.level ?? 0.5), spec, { reducedFlicker: true, creative: opts.creative ?? false, seed: 7, assets: (opts.assets ?? ga) as never });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const at = (d: Uint8ClampedArray, x: number, y: number) => `${d[(y * W + x) * 4]},${d[(y * W + x) * 4 + 1]},${d[(y * W + x) * 4 + 2]}`;
  const srcAt = (id: string, x: number, y: number) => { const c = ga[id].getContext("2d").getImageData(x, y, 1, 1).data; return `${c[0]},${c[1]},${c[2]}`; };
  // (a) fit none, scale 1, centred: creative asset pixels equal the source.
  const photo = px({ asset: "photo", fit: "none" }, { creative: true });
  const x0 = (W - 96) / 2, y0 = (H - 64) / 2;
  check("image draws the asset's own pixels in creative mode", [[3, 3], [50, 20], [90, 60]].every(([sx, sy]) => at(photo, x0 + sx, y0 + sy) === srcAt("photo", sx, sy)));
  check("image renders identically twice", hashOf(photo) === hashOf(px({ asset: "photo", fit: "none" }, { creative: true })));
  check("image draws nothing without a supplied bitmap", hashOf(px({ asset: "photo" }, { assets: {} })) === hashOf(new Uint8ClampedArray(W * H * 4).map((_, i) => (i % 4 === 3 ? 255 : 0))));
  check("image drive none ignores the signal", hashOf(px({ asset: "photo" }, { level: 0.02, creative: true })) === hashOf(px({ asset: "photo" }, { level: 0.95, creative: true })));
  // Legacy pre-loaded bitmap path (raw, unvalidated layer) still stretches full-frame.
  const legacyCtx = createCanvas(W, H).getContext("2d");
  drawSpec(legacyCtx, { width: W, height: H }, frameAt(0), { layers: [{ type: "image", _bitmap: ga.tile }] } as any, { reducedFlicker: true, creative: false, seed: 7 });
  const legacy = legacyCtx.getImageData(0, 0, W, H).data;
  check("the legacy _bitmap layer still renders full-frame", at(legacy, 1, 1) === srcAt("tile", 0, 0) && at(legacy, W - 2, H - 2) === srcAt("tile", 31, 31));
  // Placement (US2).
  const plain = px({ asset: "tile", fit: "none", scale: 2, x: 0.5, y: 0.5 }, { creative: true });
  const flipped = px({ asset: "tile", fit: "none", scale: 2, x: 0.5, y: 0.5, flip: "x" }, { creative: true });
  const bx = W / 2 - 32, by = H / 2 - 32;
  let mirrored = true;
  for (let y = 0; y < 64; y += 3) for (let x = 0; x < 64; x += 3) if (at(plain, bx + x, by + y) !== at(flipped, bx + 63 - x, by + y)) mirrored = false;
  check("flip x mirrors the image", mirrored);
  let blocks = true;
  for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) if (at(plain, bx + x, by + y) !== at(plain, bx + x + 1, by + y + 1)) blocks = false;
  check("nearest smoothing at scale 2 gives uniform 2 × 2 blocks", blocks);
  const contain = px({ asset: "photo", fit: "contain" }, { creative: true });
  check("fit contain keeps the aspect inside the frame", at(contain, 2, 90) === "0,0,0" && at(contain, W / 2, 90) !== "0,0,0");
  const cover = px({ asset: "photo", fit: "cover" }, { creative: true });
  check("fit cover fills the frame", at(cover, 1, 1) !== "0,0,0" && at(cover, W - 2, H - 2) !== "0,0,0");
  const left = px({ asset: "main", fit: "none", srcW: 0.5, srcH: 0.5, x: 0.5, y: 0.5 }, { creative: true });
  // The top-left quadrant (32 × 24, red with a transparent corner and part of the grey band), centred.
  check("a source rect draws only that region", at(left, W / 2 + 10, H / 2) === "200,48,48" && at(left, W / 2 + 20, H / 2) === "0,0,0" && at(left, W / 2, H / 2 + 16) === "0,0,0");
  check("opacity 0 draws nothing", hashOf(px({ asset: "photo", opacity: 0 }, { creative: true })) === hashOf(px({ asset: "photo" }, { assets: {} })));
  // Scrolling (US3): closed form, seamless period.
  const scroll = { asset: "tile", fit: "none", scale: 2, wrap: "xy", scrollX: 0.2 };
  check("a scrolling frame rendered alone equals the same frame in sequence", [0, 5, 17].map((i) => hashOf(px(scroll, { i, creative: true }))).every((h, k) => h === hashOf(px(scroll, { i: [0, 5, 17][k], creative: true }))));
  // One tile (64 px) at 0.2 frame widths per second (64 px/s) loops after 1 s = frame 30.
  check("a wrapping scroll returns to its first image after one tile", hashOf(px(scroll, { i: 0, creative: true })) === hashOf(px(scroll, { i: 30, creative: true })));
  check("a scrolling image moves", hashOf(px(scroll, { i: 0, creative: true })) !== hashOf(px(scroll, { i: 7, creative: true })));
  // Colour modes (US4).
  const roles = { r1: "#30a050" };
  const pal = px({ asset: "photo", colour: "palette", fit: "contain" }, { creative: true, roles });
  const allowed = new Set(["0,0,0", "255,255,255", "48,160,80"]);
  let exact = true;
  for (let i = 0; i < pal.length; i += 4) if (!allowed.has(`${pal[i]},${pal[i + 1]},${pal[i + 2]}`)) { exact = false; break; }
  check("palette mode draws only palette colours", exact);
  check("asset mode outside creative equals palette mode", hashOf(px({ asset: "photo", colour: "asset" }, { creative: false })) === hashOf(px({ asset: "photo", colour: "palette" }, { creative: false })));
  const own = px({ asset: "photo", colour: "asset" }, { creative: true });
  let nonPalette = false;
  for (let i = 0; i < own.length; i += 4) if (!["0,0,0", "255,255,255"].includes(`${own[i]},${own[i + 1]},${own[i + 2]}`)) { nonPalette = true; break; }
  check("asset mode in creative keeps the art's colours", nonPalette);
  const smoothPal = px({ asset: "photo", colour: "palette", smoothing: "smooth", fit: "contain", scale: 1.37 }, { creative: true, roles });
  let smoothExact = true;
  for (let i = 0; i < smoothPal.length; i += 4) if (!allowed.has(`${smoothPal[i]},${smoothPal[i + 1]},${smoothPal[i + 2]}`)) { smoothExact = false; break; }
  check("palette mode stays exact under smooth scaling", smoothExact);
}

// Clip sequences (spec 025): the clip owning a frame renders (as that clip
// alone would, at its clip-relative frame), gaps are background, frames alone
// equal frames in sequence, clip cameras start at the clip, clips get their own
// seeds; wipe and iris pixels are one shot's, fade pixels lie between them.
{
  const W = 320, H = 180;
  const frameAt = (i: number): SignalFrame => ({ index: i, t: i / 30, values: Float64Array.from({ length: 32 }, (_, k) => 0.5 + 0.3 * Math.sin(k + i / 4)), spectrum: Float64Array.from({ length: 32 }, (_, k) => 0.5 * (1 - k / 32)), amplitude: 0.5, energy: 0.4 });
  const render = (raw: any, i: number, seed = 7): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(i), validateAnimSpec(raw).spec as any, { reducedFlicker: true, creative: false, seed });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const A = [{ type: "grid", solid: true }], B = [{ type: "rings", thickness: 6 }], C = [{ type: "wave", thickness: 8 }];
  const seq = (t?: Record<string, unknown>) => ({ sequence: [{ from: 0, to: 20, layers: A }, { from: 20, to: 40, layers: B, ...(t ? { transition: t } : {}) }, { from: 45, to: 60, layers: C }] });
  // A frame shows only its own clip: changing the other clips' layers changes nothing.
  const other = { sequence: [{ from: 0, to: 20, layers: C }, { from: 20, to: 40, layers: B }, { from: 45, to: 60, layers: A }] };
  check("a sequence frame shows only the clip that owns it", hashOf(render(seq(), 25)) === hashOf(render(other, 25)) && hashOf(render(seq(), 5)) !== hashOf(render(other, 5)) && hashOf(render(seq(), 25)) !== hashOf(render(seq(), 5)));
  const bg = render({ sequence: [{ from: 0, to: 1, layers: A }] }, 42);
  let allBg = true;
  for (let i = 0; i < bg.length; i += 4) if (bg[i] !== 0 || bg[i + 1] !== 0 || bg[i + 2] !== 0) { allBg = false; break; }
  check("a frame outside every clip is background only", allBg && hashOf(render(seq(), 42)) === hashOf(bg));
  const whole = Array.from({ length: 60 }, (_, i) => hashOf(render(seq({ type: "fade", frames: 10 }), i)));
  check("sequence frames rendered alone equal the same frames in sequence", [3, 18, 21, 25, 29, 33, 47, 59].every((i) => hashOf(render(seq({ type: "fade", frames: 10 }), i)) === whole[i]));
  const camSeq = { sequence: [{ from: 0, to: 10, layers: A }, { from: 10, to: 40, layers: B, camera: { move: "zoom", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 20, zoom: 2, x: 0.5, y: 0.5 } } }] };
  const atStart = render(camSeq, 10), noCam = render({ sequence: [{ from: 0, to: 10, layers: A }, { from: 10, to: 40, layers: B }] }, 10);
  check("a clip camera starts at the clip's first frame", hashOf(atStart) === hashOf(noCam) && hashOf(render(camSeq, 25)) !== hashOf(render({ sequence: [{ from: 0, to: 10, layers: A }, { from: 10, to: 40, layers: B }] }, 25)));
  const em = [{ type: "emitter", shape: "spark", rate: 120 }];
  const twoClips = { sequence: [{ from: 0, to: 30, layers: em }, { from: 30, to: 60, layers: em }] };
  check("identical layers in two clips get their own seeds", hashOf(render(twoClips, 10)) !== hashOf(render(twoClips, 40)));
  // Transitions: compare against the two shots alone (the outgoing clip continuing).
  const shotA = (i: number) => render({ sequence: [{ from: 0, to: 100, layers: A }] }, i);
  const shotB = (i: number) => render({ sequence: [{ from: 0, to: 20, layers: A }, { from: 20, to: 100, layers: B }] }, i);
  for (const type of ["wipe", "iris", "fade"]) {
    let pure = true, between = true, mixed = 0;
    for (const i of [22, 25, 28]) {
      const t = render({ sequence: [{ from: 0, to: 20, layers: A }, { from: 20, to: 100, layers: B, transition: { type, frames: 10 } }] }, i);
      const a = shotA(i), b = shotB(i);
      for (let k = 0; k < t.length; k++) {
        if (type === "fade") { if (t[k] < Math.min(a[k], b[k]) || t[k] > Math.max(a[k], b[k])) between = false; }
        else if (k % 4 === 0) {
          const isA = t[k] === a[k] && t[k + 1] === a[k + 1] && t[k + 2] === a[k + 2] && t[k + 3] === a[k + 3];
          const isB = t[k] === b[k] && t[k + 1] === b[k + 1] && t[k + 2] === b[k + 2] && t[k + 3] === b[k + 3];
          if (!isA && !isB) pure = false;
          if (isB && !isA) mixed++;
        }
      }
    }
    if (type === "fade") check("fade pixels lie between the two clips' pixels", between);
    else check(`${type} pixels come wholly from one clip, and both clips show`, pure && mixed > 0);
  }
  const cut = { sequence: [{ from: 0, to: 20, layers: A }, { from: 20, to: 40, layers: B, transition: { type: "cut" } }] };
  check("a cut switches exactly at the clip's first frame", hashOf(render(cut, 19)) === hashOf(shotA(19)) && hashOf(render(cut, 20)) === hashOf(shotB(20)));
  const afterGap = render({ sequence: [{ from: 0, to: 10, layers: A }, { from: 20, to: 60, layers: B, transition: { type: "fade", frames: 10 } }] }, 22);
  const bOnly = render({ sequence: [{ from: 0, to: 10, layers: A }, { from: 20, to: 60, layers: B }] }, 22);
  let fromBg = true;
  for (let k = 0; k < afterGap.length; k += 4) if (afterGap[k] > bOnly[k]) fromBg = false;
  check("a transition after a gap blends from the background", fromBg && hashOf(afterGap) !== hashOf(bOnly));
  const clearFade = render({ background: "transparent", sequence: [{ from: 0, to: 20, layers: A }, { from: 20, to: 60, layers: B, transition: { type: "fade", frames: 10 } }] }, 25);
  let alphaMix = false;
  for (let k = 3; k < clearFade.length; k += 4) if (clearFade[k] > 0 && clearFade[k] < 255) { alphaMix = true; break; }
  check("a fade over a transparent background mixes alpha", alphaMix);
}

// Plugin slot (spec 024): a plugin layer renders deterministically with a
// bind, the camera and a transparent background; repeated layers get their own
// layerSeed; a throwing plugin draws nothing and is reported.
{
  registerPlugin(GOOD);
  registerPlugin(THROWER);
  const W = 320, H = 180;
  const frameAt = (i: number, level = 0.5): SignalFrame => ({ index: i, t: i / 30, values: new Float64Array(16).fill(level), spectrum: new Float64Array(16).fill(level), amplitude: level, energy: level * 0.8 });
  const render = (raw: any, i = 12, opts: Record<string, unknown> = {}): Uint8ClampedArray => {
    const v = validateAnimSpec(raw);
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(i), v.spec as any, { reducedFlicker: true, creative: false, seed: 7, ...opts });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const plugins = { good: { version: "1.0.0" }, thrower: { version: "1.0.0" } };
  const camSpec = { plugins, camera: { move: "zoom", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 30, zoom: 1.5, x: 0.5, y: 0.5 } }, layers: [{ type: "ext:good/starfield", bind: { count: { from: "amplitude", out: [20, 300] } } }] };
  check("a plugin layer with a bind and a camera renders identically twice", hashOf(render(camSpec)) === hashOf(render(camSpec)));
  const whole = [0, 1, 2, 3, 4, 5].map((i) => hashOf(render(camSpec, i)));
  check("a plugin layer's chunked render equals the whole", [2, 3, 4].every((i) => hashOf(render(camSpec, i)) === whole[i]));
  const clear = render({ plugins, background: "transparent", layers: [{ type: "ext:good/starfield" }] });
  let transparentOk = false;
  for (let i = 3; i < clear.length; i += 4) if (clear[i] === 0) { transparentOk = true; break; }
  check("a plugin layer works on a transparent background", transparentOk);
  const two = render({ plugins, layers: [{ type: "ext:good/starfield", count: 40 }] });
  const twice = render({ plugins, layers: [{ type: "ext:good/starfield", count: 40 }, { type: "ext:good/starfield", count: 40 }] });
  let extra = 0;
  for (let i = 0; i < two.length; i += 4) if (twice[i] !== two[i]) extra++;
  check("two identical plugin layers get different layerSeeds", extra > 0);
  const errors: string[] = [];
  const thrown = render({ plugins, layers: [{ type: "grid", solid: true }, { type: "ext:thrower/boom" }] }, 12, { onLayerError: (t: string) => errors.push(t) });
  const gridOnly = render({ layers: [{ type: "grid", solid: true }] });
  check("a throwing plugin layer draws nothing and is reported", hashOf(thrown) === hashOf(gridOnly) && errors.length === 1 && errors[0] === "ext:thrower/boom");
}

// Sprite sheets (spec 023): the cell shown is a closed form of time (16 of 16
// sampled frames), start offset, held frame, a frame cap, exact seeking; flip
// mirrors the cell, the source rect trims within it, palette mode per frame.
{
  const W = 320, H = 180;
  const ga = goldenAssets(createCanvas as GoldenApi["createCanvas"]) as Record<string, any>;
  const frameAt = (i: number): SignalFrame => ({ index: i, t: i / 30, values: new Float64Array(16).fill(0.5), spectrum: new Float64Array(16).fill(0.5), amplitude: 0.5, energy: 0.4 });
  const px = (layer: Record<string, unknown>, i: number, creative = true): Uint8ClampedArray => {
    const spec = validateAnimSpec({ assets: { sheet: { sha256: "0".repeat(64), width: 64, height: 16 } }, layers: [{ type: "image", asset: "sheet", sheetCols: 4, fps: 8, fit: "none", scale: 4, drive: "none", ...layer }] }).spec as any;
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(i), spec, { reducedFlicker: true, creative, seed: 7, assets: ga as never });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const COLOURS = ["200,48,48", "48,160,80", "48,80,200", "224,192,64"];
  const x0 = W / 2 - 32, y0 = H / 2 - 32;
  const cellOf = (d: Uint8ClampedArray, xo = 2) => { const k = ((y0 + 2) * W + x0 + xo) * 4; return COLOURS.indexOf(`${d[k]},${d[k + 1]},${d[k + 2]}`); };
  const indices = Array.from({ length: 16 }, (_, i) => i);
  check("sheet shows floor(t·fps) mod frames at 16 sampled frames", indices.every((i) => cellOf(px({}, i)) === Math.floor((i / 30) * 8) % 4), indices.map((i) => cellOf(px({}, i))).join(""));
  check("frameStart shifts the cycle", indices.every((i) => cellOf(px({ frameStart: 2 }, i)) === (2 + Math.floor((i / 30) * 8)) % 4));
  check("fps 0 holds frameStart", indices.every((i) => cellOf(px({ fps: 0, frameStart: 3 }, i)) === 3));
  check("frames caps the cycle", Array.from({ length: 40 }, (_, i) => cellOf(px({ frames: 3 }, i))).every((c) => c !== 3 && c >= 0));
  const whole = Array.from({ length: 11 }, (_, k) => hashOf(px({}, 30 + k)));
  check("a sheet frame rendered alone equals it in sequence", hashOf(px({}, 37)) === whole[7]);
  // Flip mirrors the cell, not the sheet: the flipped cell-0 frame shows cell 0's
  // colour everywhere and its leg square mirrored.
  const flat = px({}, 0), flipped = px({ flip: "x" }, 0);
  let mirrored = true;
  for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) {
    const a = ((y0 + y) * W + x0 + x) * 4, b = ((y0 + y) * W + x0 + 63 - x) * 4;
    if (flat[a] !== flipped[b] || flat[a + 1] !== flipped[b + 1] || flat[a + 2] !== flipped[b + 2]) mirrored = false;
  }
  check("flip mirrors the current cell", mirrored && cellOf(flipped) === 0);
  const half = px({ srcW: 0.5 }, 0);
  // Half the cell (8 px) at scale 4 is 32 px wide, centred: x0+16 .. x0+48.
  check("a source rect trims within the cell", cellOf(half, 14) === -1 && cellOf(half, 18) === 0 && cellOf(half, 50) === -1);
  let palOk = true;
  for (const i of [0, 4, 8, 12]) { const d = px({ colour: "palette" }, i); for (let k = 0; k < d.length; k += 4) if (!["0,0,0", "255,255,255"].includes(`${d[k]},${d[k + 1]},${d[k + 2]}`)) { palOk = false; break; } }
  check("palette mode maps every sheet frame", palOk);
}

// Dither (spec 021): exact stop colours inside the region only, greys in
// monochrome, a rising blend, solid single stops, chunk cells, drive, chunk
// stability, a continuous pattern across bands; caption margin; pixelAspect.
{
  const W = 320, H = 180;
  const frameAt = (i: number, level: number): SignalFrame => ({
    index: i, t: i / 30,
    values: Float64Array.from({ length: 64 }, () => level),
    spectrum: Float64Array.from({ length: 64 }, () => level),
    amplitude: level, energy: level * 0.8,
  });
  const px = (spec: any, i = 12, level = 0.5, creative = false, labels?: string[]): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, { ...frameAt(i, level), ...(labels ? { labels } : {}) }, validateAnimSpec(spec).spec as any, { reducedFlicker: true, creative, seed: 7 });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const roles = { s0: "#000014", s1: "#281444", s2: "#6c3468" };
  const band = (extra: Record<string, unknown> = {}) => ({ roles, layers: [{ type: "dither", colors: "s0,s1,s2", y0: 0.1, y1: 0.6, drive: "none", ...extra }] });
  const y0 = Math.round(0.1 * H), y1 = Math.round(0.6 * H);
  const d = px(band(), 12, 0.5, true);
  const inside = new Set(["0,0,20", "40,20,68", "108,52,104"]);
  let regionOk = true;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    if (y >= y0 && y < y1 ? !inside.has(k) : k !== "0,0,0") regionOk = false;
  }
  check("dither draws only its stop colours, only inside its region", regionOk);
  const grey = px(band(), 12, 0.5, false);
  let allGrey = true;
  for (let i = 0; i < grey.length; i += 4) if (grey[i] !== grey[i + 1] || grey[i + 1] !== grey[i + 2]) { allGrey = false; break; }
  check("dither in monochrome is grey", allGrey);
  // Share of s1 in the first half of the band (the s0→s1 blend) rises row by row.
  const share = (y: number) => { let c = 0; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i] === 40) c++; } return c; };
  const mid = Math.floor((y0 + y1) / 2);
  check("the blend rises across the band", share(y0 + 2) < share(Math.floor((y0 + mid) / 2)) && share(Math.floor((y0 + mid) / 2)) < share(mid - 2));
  const solid = px({ roles: { bar: "#0000a8" }, layers: [{ type: "dither", colors: "bar", y0: 0.7 }] }, 12, 0.5, true);
  let solidOk = true;
  for (let y = Math.round(0.7 * H); y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (solid[i] !== 0 || solid[i + 1] !== 0 || solid[i + 2] !== 168) solidOk = false; }
  check("a single stop is a solid band", solidOk);
  const ch = px(band({ chunk: 4, y0: 0, y1: 1 }), 12, 0.5, true);
  let cellsOk = true;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, j = ((y - (y % 4)) * W + (x - (x % 4))) * 4; if (ch[i] !== ch[j] || ch[i + 1] !== ch[j + 1] || ch[i + 2] !== ch[j + 2]) cellsOk = false; }
  check("chunk 4 makes uniform 4 × 4 cells", cellsOk);
  check("drive none ignores the signal", hashOf(px(band(), 12, 0.02, true)) === hashOf(px(band(), 12, 0.95, true)));
  check("drive level follows the signal", hashOf(px(band({ drive: "level" }), 12, 0.02, true)) !== hashOf(px(band({ drive: "level" }), 12, 0.95, true)));
  const whole = [0, 1, 2, 3, 4, 5].map((i) => hashOf(px(band({ drive: "level" }), i, 0.5, true)));
  check("dither chunk render equals the whole", [2, 3, 4].every((i) => hashOf(px(band({ drive: "level" }), i, 0.5, true)) === whole[i]));
  // A horizontal gradient split into a top and a bottom band equals one band
  // only when the matrix is indexed from the frame origin (the split row, 90,
  // is not a multiple of 8, so a region-relative pattern would restart).
  const split = px({ roles, layers: [{ type: "dither", colors: "s0,s1", direction: "horizontal", y1: 0.5, drive: "none" }, { type: "dither", colors: "s0,s1", direction: "horizontal", y0: 0.5, drive: "none" }] }, 12, 0.5, true);
  const one = px({ roles, layers: [{ type: "dither", colors: "s0,s1", direction: "horizontal", drive: "none" }] }, 12, 0.5, true);
  check("adjacent bands share one continuous pattern", hashOf(split) === hashOf(one));
  // Caption margin.
  const cap = (extra: Record<string, unknown>) => px({ layers: [{ type: "caption", box: "none", ...extra }] }, 12, 0.5, false, ["MARGIN TEST"]);
  check("caption margin 1 equals the default", hashOf(cap({ margin: 1 })) === hashOf(cap({})));
  const rowsOf = (img: Uint8ClampedArray) => { let top = -1, bot = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img[(y * W + x) * 4] > 0) { if (top < 0) top = y; bot = y; } return [top, bot]; };
  const fs0 = Math.max(18, Math.round(H / 26));
  const [t1, b1] = rowsOf(cap({})), [t0, b0] = rowsOf(cap({ margin: 0 }));
  check("caption margin 0 moves the text down by one font height", t0 - t1 === fs0 && b0 - b1 === fs0, `${t1}→${t0}, ${b1}→${b0}, fs ${fs0}`);
  // Pixel aspect never changes a pixel.
  check("pixelAspect does not change pixels", hashOf(px({ pixelAspect: 1.2, layers: [{ type: "grid" }] })) === hashOf(px({ layers: [{ type: "grid" }] })));
}

// Second tone (spec 019): `b` cells draw roles.fg2 in creative mode and the
// mid grey otherwise; they are designed cells, solid stays exact, and checker
// tiles them.
{
  const W = 320, H = 180;
  const TWO_TONE = "##.a.##/#b...b#/..###../#b...b#/##.a.##";
  const FG2 = "#d8c8a0";
  const frameAt = (i: number, level: number): SignalFrame => ({
    index: i,
    t: i / 30,
    values: Float64Array.from({ length: 64 }, (_, k) => level * ((Math.sin(k / 4 + i / 5) + 1) / 2)),
    spectrum: Float64Array.from({ length: 64 }, (_, k) => level * Math.max(0, 1 - k / 64)),
    amplitude: level,
    energy: level * 0.8,
  });
  const px = (spec: any, i = 12, level = 0.5, creative = false): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(i, level), validateAnimSpec(spec).spec as any, { reducedFlicker: true, creative, seed: 7 });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const spec = (extra: Record<string, unknown> = {}, roles?: Record<string, string>) =>
    ({ accent: "#ff2d2d", ...(roles ? { roles } : {}), layers: [{ type: "grid", pattern: TWO_TONE, ...extra }] });
  const rows = TWO_TONE.split("/");
  const cellsMatch = (d: Uint8ClampedArray, b: number[], a = [255, 45, 45]): boolean => {
    let ok = true;
    rows.forEach((row, r) => [...row].forEach((letter, c) => {
      const i = (Math.floor(((r + 0.5) * H) / rows.length) * W + Math.floor(((c + 0.5) * W) / row.length)) * 4;
      const want = letter === "#" ? [255, 255, 255] : letter === "a" ? a : letter === "b" ? b : [0, 0, 0];
      if (d[i] !== want[0] || d[i + 1] !== want[1] || d[i + 2] !== want[2]) ok = false;
    }));
    return ok;
  };
  check("b cells are exactly fg2 in creative mode at quiet, mid and loud",
    [0.02, 0.5, 0.95].every((level) => cellsMatch(px(spec({ solid: true }, { fg2: FG2 }), 12, level, true), [216, 200, 160])));
  // Outside creative mode the accent is the foreground too.
  check("b cells are mid grey in monochrome", cellsMatch(px(spec({ solid: true }, { fg2: FG2 }), 12, 0.5, false), [128, 128, 128], [255, 255, 255]));
  check("b cells are mid grey in creative mode without fg2", cellsMatch(px(spec({ solid: true }), 12, 0.5, true), [128, 128, 128]));
  const allowed = new Set(["0,0,0", "255,255,255", "255,45,45", "216,200,160"]);
  const solidBroken = px(spec({ solid: true, breaks: "1,1 r15" }, { fg2: FG2 }), 12, 0.5, true);
  let exact = true;
  for (let i = 0; i < solidBroken.length; i += 4) if (!allowed.has(`${solidBroken[i]},${solidBroken[i + 1]},${solidBroken[i + 2]}`)) { exact = false; break; }
  check("a solid two-tone pattern with a turned b cell uses only bg, fg, accent and fg2", exact);
  check("b cells ignore the signal", hashOf(px(spec(), 12, 0.02)) === hashOf(px(spec(), 12, 0.95)));
  const ck = px({ layers: [{ type: "checker", pattern: "b./.b", size: 40 }] });
  const sq = (c: number, r: number) => [0, 1, 2].map((k) => ck[((r * 40 + 20) * W + c * 40 + 20) * 4 + k]).join(",");
  check("checker tiles b squares in mid grey", sq(0, 0) === "128,128,128" && sq(2, 0) === "128,128,128" && sq(1, 1) === "128,128,128" && sq(1, 0) === "0,0,0");
  const whole = [0, 1, 2, 3, 4, 5].map((i) => hashOf(px(spec({ breaks: "1,1 r15" }, { fg2: FG2 }), i, 0.5, true)));
  check("two-tone chunk render equals the whole", [2, 3, 4].every((i) => hashOf(px(spec({ breaks: "1,1 r15" }, { fg2: FG2 }), i, 0.5, true)) === whole[i]));
}

// Palette roles (spec 020): the v2 hero draws only its role colours in
// creative mode, only greys otherwise, falls back per role, and legacy
// characters ignore roles entirely.
{
  const W = 320, H = 180;
  const frame: SignalFrame = {
    index: 12,
    t: 0.4,
    values: Float64Array.from({ length: 64 }, () => 0.3),
    spectrum: Float64Array.from({ length: 64 }, () => 0.3),
    amplitude: 0.3,
    energy: 0.24,
  };
  const px = (spec: any, creative: boolean): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frame, validateAnimSpec(spec).spec as any, { reducedFlicker: true, creative, seed: 7 });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const hero = (background: "black" | "white", roles?: Record<string, string>) =>
    ({ background, ...(roles ? { roles } : {}), layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] });
  const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  const allowed = new Set(["0,0,0", ...Object.values(HERO_ROLES).map(rgb)]);
  const coloured = px(hero("black", HERO_ROLES), true);
  let onlyRoles = true, rolesSeen = 0;
  const seen = new Set<string>();
  for (let i = 0; i < coloured.length; i += 4) {
    const k = `${coloured[i]},${coloured[i + 1]},${coloured[i + 2]}`;
    if (!allowed.has(k)) onlyRoles = false;
    else if (k !== "0,0,0") seen.add(k);
  }
  rolesSeen = seen.size;
  check("hero in creative mode draws only the background and its role colours", onlyRoles, `${rolesSeen} role colours seen`);
  check("hero in creative mode shows all ten role colours", rolesSeen === 10, `${rolesSeen}`);
  const grey = (d: Uint8ClampedArray) => { for (let i = 0; i < d.length; i += 4) if (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2]) return false; return true; };
  check("hero in monochrome is grey on black and on white", grey(px(hero("black"), false)) && grey(px(hero("white"), false)));
  check("roles are ignored outside creative mode", hashOf(px(hero("black", HERO_ROLES), false)) === hashOf(px(hero("black"), false)));
  check("hero renders identically twice", hashOf(px(hero("black", HERO_ROLES), true)) === hashOf(px(hero("black", HERO_ROLES), true)));
  const partial = px(hero("black", { hair: HERO_ROLES.hair }), true);
  let hairSeen = false, othersGrey = true;
  for (let i = 0; i < partial.length; i += 4) {
    const k = `${partial[i]},${partial[i + 1]},${partial[i + 2]}`;
    if (k === rgb(HERO_ROLES.hair)) hairSeen = true;
    else if (partial[i] !== partial[i + 1] || partial[i + 1] !== partial[i + 2]) othersGrey = false;
  }
  check("an unlisted role falls back to its grey", hairSeen && othersGrey);
  const mascot = (roles?: Record<string, string>) => ({ ...(roles ? { roles } : {}), layers: [{ type: "sprite", character: "mascot", motion: "static" }] });
  const raw = (roles: unknown) => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frame, { roles, layers: [sanitizeLayer({ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 })!] } as any, { reducedFlicker: true, creative: true, seed: 7 });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const messy = { ...HERO_ROLES, Bad: "#ffffff", fg: "#00ff00", gold: "yellow" };
  check("a raw roles map renders like its validated form", hashOf(raw(messy)) === hashOf(px({ roles: messy, layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] }, true)));
  check("legacy characters ignore roles", hashOf(px(mascot(HERO_ROLES), true)) === hashOf(px(mascot(), true)));
}

// 8. viseme bind source (spec 015): a mouth opens with the viseme index.
{
  const mk = (viseme?: number): SignalFrame => ({
    index: 0,
    t: 0,
    values: Float64Array.from({ length: 16 }, () => 0.5),
    spectrum: Float64Array.from({ length: 16 }, () => 0.5),
    amplitude: 0.5,
    energy: 0.4,
    ...(viseme !== undefined ? { viseme } : {}),
  });
  const renderV = (spec: any, frame: SignalFrame): string => {
    const canvas = createCanvas(320, 180);
    const ctx = canvas.getContext("2d");
    drawSpec(ctx, { width: 320, height: 180 }, frame, spec, { reducedFlicker: true, creative: false, seed: 7 });
    return crypto.createHash("sha256").update(ctx.getImageData(0, 0, 320, 180).data).digest("hex");
  };
  const boundRig = validateAnimSpec({ background: "black", layers: [{ type: "rig", rig: "host", drive: "none", bind: { mouthOpen: { from: "viseme", in: [0, 14], out: [0.1, 1] } } }] });
  const staticRig = validateAnimSpec({ background: "black", layers: [{ type: "rig", rig: "host", drive: "none", mouthOpen: 0 }] });
  check("viseme bind opens the mouth (0 vs 14)", renderV(boundRig.spec, mk(0)) !== renderV(boundRig.spec, mk(14)));
  check("absent viseme falls back to the static value", renderV(boundRig.spec, mk()) === renderV(staticRig.spec, mk()));
}

// 9. Pixel mode and tone2 (spec 026): whole-pixel, palette-exact frames from
// the primitives that honour pixelMode; fg2 only where tone2 says; pixelMode
// false equals no pixelMode.
{
  const ga = goldenAssets(createCanvas as GoldenApi["createCanvas"]) as Record<string, any>;
  const frameAt = (i: number, level: number, n = 64): SignalFrame => ({
    index: i, t: i / 30,
    values: Float64Array.from({ length: 16 }, () => level),
    spectrum: Float64Array.from({ length: n }, (_, k) => level * (1 - k / (2 * n))),
    amplitude: level, energy: level,
  });
  const render = (spec: any, W: number, H: number, o: { i?: number; level?: number; n?: number; creative?: boolean } = {}): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(o.i ?? 12, o.level ?? 0.5, o.n), validateAnimSpec(spec).spec as any, { reducedFlicker: true, creative: o.creative ?? false, seed: 7, assets: ga as never });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const ACCENT = "#ff2d2d", FG2 = "#d8c8a0";
  const MONO = new Set(["0,0,0", "255,255,255"]);
  const CREATIVE = new Set(["0,0,0", "255,255,255", "255,45,45", "216,200,160", "128,128,128"]);
  const offPalette = (d: Uint8ClampedArray, allowed: Set<string>): number => {
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (!allowed.has(`${d[i]},${d[i + 1]},${d[i + 2]}`)) n++;
    return n;
  };
  const LEVELS = [0.05, 0.5, 0.95];
  const exactAt = (spec: any, W: number, H: number, o: { n?: number; creative?: boolean; i?: number } = {}) =>
    LEVELS.every((level) => offPalette(render(spec, W, H, { ...o, level }), o.creative ? CREATIVE : MONO) === 0);
  const pm = (layers: unknown[], extra: Record<string, unknown> = {}) => ({ background: "black", pixelMode: true, ...extra, layers });

  // pixelMode false is no pixelMode, byte for byte (T008).
  const cam = { camera: { move: "pan", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 30, zoom: 1, x: 0.63, y: 0.5 } } };
  const plain = { background: "black", ...cam, layers: [{ type: "bars" }, { type: "rings" }, { type: "emitter", rate: 120 }] };
  check("pixelMode false renders exactly as no pixelMode", [3, 17].every((i) => hashOf(render({ ...plain, pixelMode: false }, 333, 181, { i })) === hashOf(render(plain, 333, 181, { i }))));

  // US1: bars, hbars and rings (T014). 40 bars at 9921 px is the 248.025 px pitch from #159.
  check("pixel mode: bars at a 248.025 px pitch have 0 pixels outside the palette", exactAt(pm([{ type: "bars" }], { accent: ACCENT }), 9921, 40, { n: 40, creative: true }));
  check("without pixel mode the same bars blend (the check can fail)", offPalette(render({ background: "black", accent: ACCENT, layers: [{ type: "bars" }] }, 9921, 40, { n: 40, creative: true }), CREATIVE) > 0);
  check("pixel mode: bars at a fractional pitch have 0 pixels outside the palette", exactAt(pm([{ type: "bars" }]), 333, 181) && exactAt(pm([{ type: "bars", baseline: "middle" }]), 333, 181));
  check("pixel mode: hbars have 0 pixels outside the palette", exactAt(pm([{ type: "hbars" }]), 333, 181));
  check("pixel mode: rings have 0 pixels outside the palette", exactAt(pm([{ type: "rings" }]), 333, 181) && exactAt(pm([{ type: "rings", count: 12, thickness: 9 }]), 333, 181) && exactAt(pm([{ type: "rings", count: 3, thickness: 32 }], { accent: ACCENT }), 333, 181, { creative: true }));
  check("without pixel mode the same rings blend (the check can fail)", offPalette(render({ background: "black", layers: [{ type: "rings", count: 12, thickness: 9 }] }, 333, 181), MONO) > 0);
  const full = render(pm([{ type: "bars", heightFrac: 1 }]), 333, 181, { level: 1 });
  const lit = (d: Uint8ClampedArray, W: number, x: number, y: number) => d[(y * W + x) * 4] > 0;
  check("pixel-mode bars still fill the width (last bar ends one gap short of the edge)", lit(full, 333, 331, 180) && !lit(full, 333, 332, 180) && lit(full, 333, 0, 180));
  const sizeOf = (d: Uint8ClampedArray, W: number) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
  check("pixel-mode rings are non-empty outlines", sizeOf(render(pm([{ type: "rings", thickness: 4 }]), 333, 181), 333) > 0);
  for (const [name, spec] of [["bars", pm([{ type: "bars" }])], ["rings", pm([{ type: "rings", count: 12, thickness: 9 }])]] as const) {
    const whole = [3, 4, 5, 6].map((i) => hashOf(render(spec, 333, 181, { i })));
    check(`pixel mode: ${name} renders identically twice and a chunk equals the whole`, [5, 6].every((i, k) => hashOf(render(spec, 333, 181, { i })) === whole[2 + k]) && whole.every((h, k) => h === hashOf(render(spec, 333, 181, { i: 3 + k }))));
  }

  // US2: camera, image, emitter, particles (T021).
  const panned = pm([{ type: "bars" }], cam);
  check("pixel mode: a camera pan leaves no blended column (16 frames)", Array.from({ length: 16 }, (_, k) => k * 2).every((i) => offPalette(render(panned, 333, 181, { i }), MONO) === 0));
  check("without pixel mode the same pan blends (the check can fail)", Array.from({ length: 16 }, (_, k) => k * 2).some((i) => offPalette(render({ background: "black", ...cam, layers: [{ type: "bars" }] }, 333, 181, { i }), MONO) > 0));
  for (const shape of ["dust", "petal", "spark", "snow", "ember"]) {
    const em = pm([{ type: "emitter", shape, rate: 200, size: 24, burst: 0.4 }]);
    check(`pixel mode: emitter ${shape} has 0 pixels outside the palette`, exactAt(em, 320, 180, { i: 60 }) && sizeOf(render(em, 320, 180, { i: 60 }), 320) > 0);
  }
  check("pixel mode: particles have 0 pixels outside the palette", exactAt(pm([{ type: "particles", count: 500 }]), 333, 181) && sizeOf(render(pm([{ type: "particles", count: 500 }]), 333, 181), 333) > 0);
  const SHA = "0".repeat(64);
  const img = (smoothing: string, pixel: boolean) => ({ background: "black", ...(pixel ? { pixelMode: true } : {}), assets: { photo: { sha256: SHA, width: ga.photo.width, height: ga.photo.height } }, layers: [{ type: "image", asset: "photo", fit: "none", scale: 3, smoothing, drive: "none" }] });
  check("pixel mode: a smooth image draws as nearest", hashOf(render(img("smooth", true), 320, 180, { creative: true })) === hashOf(render(img("nearest", false), 320, 180, { creative: true })));
  check("pixel mode: the smooth image differs without pixel mode (the check can fail)", hashOf(render(img("smooth", false), 320, 180, { creative: true })) !== hashOf(render(img("nearest", false), 320, 180, { creative: true })));
  const emit = pm([{ type: "emitter", shape: "petal", rate: 200, size: 24 }]);
  check("pixel mode: emitter renders identically twice and in any order", [60, 61, 62].map((i) => hashOf(render(emit, 320, 180, { i }))).join() === [62, 61, 60].map((i) => hashOf(render(emit, 320, 180, { i }))).reverse().join());

  // US3: tone2 (T027).
  const W3 = 333, H3 = 181, N3 = 64;
  const barOf = (x: number): number => { for (let i = 0; i < N3; i++) if (x >= Math.round((i * W3) / N3) && x < Math.round(((i + 1) * W3) / N3)) return i; return -1; };
  const rgb = (d: Uint8ClampedArray, i: number) => `${d[i]},${d[i + 1]},${d[i + 2]}`;
  const toneOk = (tone2: string, want: (i: number) => string, creative: boolean, fg2Key: string) => LEVELS.every((level) => {
    const d = render(pm([{ type: "bars", tone2 }], { accent: ACCENT, roles: { fg2: FG2 } }), W3, H3, { level, creative });
    for (let y = 0; y < H3; y++) for (let x = 0; x < W3; x++) {
      const k = rgb(d, (y * W3 + x) * 4);
      if (k === "0,0,0") continue;
      if (k !== want(barOf(x))) return false;
    }
    return d.some((_, i) => i % 4 === 0 && rgb(d, i) === fg2Key);
  });
  const acc = (creative: boolean) => (creative ? "255,45,45" : "255,255,255");
  check("tone2 alternate: odd bars are exactly fg2, nowhere else, in creative mode", toneOk("alternate", (i) => (i === 0 ? acc(true) : i % 2 === 1 ? "216,200,160" : "255,255,255"), true, "216,200,160"));
  check("tone2 alternate: odd bars are mid grey in monochrome", toneOk("alternate", (i) => (i === 0 ? acc(false) : i % 2 === 1 ? "128,128,128" : "255,255,255"), false, "128,128,128"));
  check("tone2 peak: only the peak bar is fg2", toneOk("peak", (i) => (i === 0 ? "216,200,160" : "255,255,255"), true, "216,200,160"));
  const ringsOk = LEVELS.every((level) => {
    const count = 6, thick = 6, f = frameAt(12, level);
    const d = render(pm([{ type: "rings", tone2: "alternate", count, thickness: thick }], { accent: ACCENT, roles: { fg2: FG2 } }), W3, H3, { level, creative: true });
    const maxR = Math.min(W3, H3) * 0.45, cx = Math.round(W3 / 2), cy = Math.round(H3 / 2);
    const radii = Array.from({ length: count }, (_, k) => Math.round((((k + 1) / count + f.t * 0.1) % 1) * maxR * (0.6 + 0.4 * f.amplitude)));
    let fg2Seen = false;
    for (let y = 0; y < H3; y++) for (let x = 0; x < W3; x++) {
      const k = rgb(d, (y * W3 + x) * 4);
      if (k !== "216,200,160") continue;
      fg2Seen = true;
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (!radii.some((R, j) => (j + 1) % 2 === 0 && Math.abs(dist - R) <= thick / 2)) return false;
    }
    return fg2Seen && offPalette(d, CREATIVE) === 0;
  });
  check("tone2 alternate rings: fg2 only on even rings, palette-exact in pixel mode", ringsOk);
  check("tone2 none equals no tone2", hashOf(render({ background: "black", layers: [{ type: "bars", tone2: "none" }, { type: "rings", tone2: "none" }] }, 320, 180)) === hashOf(render({ background: "black", layers: [{ type: "bars" }, { type: "rings" }] }, 320, 180)));
  const nonPixelTone = { background: "black", roles: { fg2: FG2 }, layers: [{ type: "rings", tone2: "alternate", count: 4 }] };
  check("tone2 rings outside pixel mode render identically twice", hashOf(render(nonPixelTone, 320, 180, { creative: true })) === hashOf(render(nonPixelTone, 320, 180, { creative: true })));
}

// 10. Arcade HUD (spec 027): versus-bars lengths follow coords and stay
// palette-exact; hud-score text comes only from labels.
{
  const W = 400, H = 200;
  const frameAt = (level: number, data: { coords?: Array<{ x: number; y: number }>; labels?: string[] } = {}): SignalFrame => ({
    index: 12, t: 0.4,
    values: Float64Array.from({ length: 16 }, () => level),
    spectrum: Float64Array.from({ length: 64 }, (_, k) => level * (1 - k / 128)),
    amplitude: level, energy: level * 0.8, ...data,
  });
  const render = (spec: any, f: SignalFrame, creative = false): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, f, validateAnimSpec(spec).spec as any, { reducedFlicker: true, creative, seed: 7 });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const rgb = (d: Uint8ClampedArray, x: number, y: number) => { const i = (y * W + x) * 4; return `${d[i]},${d[i + 1]},${d[i + 2]}`; };
  const vb = (extra: Record<string, unknown> = {}) => ({ background: "black", accent: "#e02020", layers: [{ type: "versus-bars", angle: 0, height: 0.1, y: 0.1, ...extra }] });
  const HIT = [{ x: 0.4, y: 0.6 }, { x: 0.8, y: 0.8 }];
  // Geometry with angle 0: bar rows 20..39; the left bar spans outer = 16 to inner = 176; interior 17..174 (158 px).
  const row = 30, i0 = 17, len = 176 - 1 - i0;
  const run = (d: Uint8ClampedArray, colour: string, from: number, to: number) => { let n = 0; for (let x = from; x < to; x++) if (rgb(d, x, row) === colour) n++; return n; };
  const hit = render(vb({ drive: "none" }), frameAt(0.3, { coords: HIT }), true);
  check("versus-bars: the left fill is 40% of the bar (±1 px)", Math.abs(run(hit, "255,255,255", i0, 175) - Math.round(0.4 * len)) <= 1);
  check("versus-bars: the left tail covers 40% to 60% (±1 px)", Math.abs(run(hit, "224,32,32", i0, 175) - (Math.round(0.6 * len) - Math.round(0.4 * len))) <= 1);
  check("versus-bars: the right bar mirrors, 80% fill and no tail", Math.abs(run(hit, "255,255,255", W - 175, W - i0) - Math.round(0.8 * len)) <= 1 && run(hit, "224,32,32", W - 175, W - i0) === 0);
  const allowed = new Set(["0,0,0", "255,255,255", "224,32,32", "128,128,128"]);
  const exact = (d: Uint8ClampedArray) => { for (let i = 0; i < d.length; i += 4) if (!allowed.has(`${d[i]},${d[i + 1]},${d[i + 2]}`)) return false; return true; };
  check("versus-bars: every pixel is bg, fg, accent or mid grey (angled, both modes, three levels)", [0.05, 0.5, 0.95].every((lv) => exact(render(vb({ angle: 30 }), frameAt(lv, { coords: HIT }), true)) && exact(render(vb({ angle: 30 }), frameAt(lv, { coords: HIT })))));
  check("versus-bars: the tail is mid grey in monochrome", run(render(vb({ drive: "none" }), frameAt(0.3, { coords: HIT })), "128,128,128", i0, 175) > 0);
  check("versus-bars: a loud frame flashes the tail (drive level)", hashOf(render(vb(), frameAt(0.95, { coords: HIT }))) !== hashOf(render(vb(), frameAt(0.3, { coords: HIT }))));
  check("versus-bars: drive none ignores the signal level", hashOf(render(vb({ drive: "none" }), frameAt(0.95, { coords: HIT }))) === hashOf(render(vb({ drive: "none" }), frameAt(0.3, { coords: HIT }))));
  check("versus-bars: one coords entry leaves the right bar full", run(render(vb(), frameAt(0.3, { coords: [HIT[0]] })), "255,255,255", W - 175, W - i0) === len);
  check("versus-bars: out-of-range coords are clamped", hashOf(render(vb(), frameAt(0.3, { coords: [{ x: -2, y: 9 }, { x: 5, y: 5 }] }))) === hashOf(render(vb(), frameAt(0.3, { coords: [{ x: 0, y: 1 }, { x: 1, y: 1 }] }))));
  check("versus-bars: renders identically twice", hashOf(render(vb(), frameAt(0.5, { coords: HIT }))) === hashOf(render(vb(), frameAt(0.5, { coords: HIT }))));

  const hs = (extra: Record<string, unknown> = {}) => ({ background: "black", layers: [{ type: "hud-score", ...extra }] });
  const SCORES = ["12340", "50000", "2"];
  check("hud-score: labels change the frame", hashOf(render(hs(), frameAt(0.3, { labels: SCORES }))) !== hashOf(render(hs(), frameAt(0.3, { labels: ["99999", "50000", "2"] }))));
  check("hud-score: drive none ignores the signal", hashOf(render(hs({ drive: "none" }), frameAt(0.95, { labels: SCORES }))) === hashOf(render(hs({ drive: "none" }), frameAt(0.05, { labels: SCORES }))));
  check("hud-score: drive level inverts 1UP on a loud frame", hashOf(render(hs(), frameAt(0.95, { labels: SCORES }))) !== hashOf(render(hs(), frameAt(0.05, { labels: SCORES }))));
  const lit = (d: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
  check("hud-score: no labels draws only the captions", lit(render(hs(), frameAt(0.3))) > 0 && hashOf(render(hs({ captions: false }), frameAt(0.3))) === hashOf(render(hs({ captions: false }), frameAt(0.3, { labels: [] }))) && lit(render(hs({ captions: false, drive: "none" }), frameAt(0.3))) === 0);
  check("hud-score: long values are cut (12, timer 3)", hashOf(render(hs(), frameAt(0.3, { labels: ["1234567890123456", "x", "y"] }))) === hashOf(render(hs(), frameAt(0.3, { labels: ["123456789012", "x", "y"] }))) && hashOf(render(hs({ layout: "versus" }), frameAt(0.3, { labels: ["12345", "A", "B"] }))) === hashOf(render(hs({ layout: "versus" }), frameAt(0.3, { labels: ["123", "A", "B"] }))));
}

// 11. Palette profiles (spec 028): gameboy-dmg lands solid scenes on the four
// DMG greens; genesis puts every channel on the 9-bit grid; a profile without
// creative mode changes nothing; dither matrix 2 is a checkerboard.
{
  const ga = goldenAssets(createCanvas as GoldenApi["createCanvas"]) as Record<string, any>;
  const frameAt = (level: number, i = 12): SignalFrame => ({
    index: i, t: i / 30,
    values: Float64Array.from({ length: 64 }, (_, k) => level * (Math.sin(k) + 1) / 2),
    spectrum: Float64Array.from({ length: 64 }, (_, k) => level * (1 - k / 64)),
    amplitude: level, energy: level * 0.8,
  });
  const render = (spec: any, W: number, H: number, o: { level?: number; i?: number; creative?: boolean } = {}): Uint8ClampedArray => {
    const ctx = createCanvas(W, H).getContext("2d");
    drawSpec(ctx, { width: W, height: H }, frameAt(o.level ?? 0.5, o.i), validateAnimSpec(spec).spec as any, { reducedFlicker: true, creative: o.creative ?? true, seed: 3, assets: ga as never });
    return ctx.getImageData(0, 0, W, H).data;
  };
  const hashOf = (d: Uint8ClampedArray) => crypto.createHash("sha256").update(d).digest("hex");
  const colours = (d: Uint8ClampedArray) => { const s = new Set<string>(); for (let i = 0; i < d.length; i += 4) s.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); return s; };
  const DMG = new Set(["15,56,15", "48,98,48", "139,172,15", "155,188,12"]);
  const gbScene = (background: string) => ({ background, profile: "gameboy-dmg", pixelMode: true, layers: [
    { type: "checker", pattern: "b", size: 16 }, { type: "tetris" }, { type: "bars", heightFrac: 0.3 }, { type: "rings", count: 4 },
    { type: "dither", colors: "fg2,accent", y0: 0.85, matrix: "2", drive: "none" },
    { type: "sprite", character: "hero", motion: "static", scale: 3, x: 0.25, y: 0.9, reactive: false },
  ] });
  for (const background of ["white", "black"]) {
    check(`gameboy-dmg (${background}): a solid 160x144 scene is exactly the four DMG greens`, [0.05, 0.5, 0.95].every((level) => {
      const c = colours(render(gbScene(background), 160, 144, { level }));
      return c.size === 4 && [...c].every((k) => DMG.has(k));
    }));
  }
  check("a profile without creative mode renders exactly as no profile", ["gameboy-dmg", "genesis"].every((profile) => {
    const { profile: _p, ...plain } = { ...gbScene("white"), profile };
    return hashOf(render({ ...plain, profile }, 160, 144, { creative: false })) === hashOf(render(plain, 160, 144, { creative: false }));
  }));
  const accentOf = (spec: any) => { const d = render(spec, 64, 64); return `${d[0]},${d[1]},${d[2]}`; };
  check("gameboy-dmg: the spec's accent wins over the profile's", accentOf({ background: "white", profile: "gameboy-dmg", accent: "#ff0000", layers: [{ type: "dither", colors: "accent", drive: "none" }] }) === "255,0,0");
  check("genesis: the accent snaps to the 9-bit grid (#e02020 -> #db2424)", accentOf({ profile: "genesis", accent: "#e02020", layers: [{ type: "dither", colors: "accent", drive: "none" }] }) === "219,36,36");
  const GRID = new Set([0, 36, 73, 109, 146, 182, 219, 255]);
  const onGrid = (d: Uint8ClampedArray) => { for (let i = 0; i < d.length; i += 4) if (!GRID.has(d[i]) || !GRID.has(d[i + 1]) || !GRID.has(d[i + 2])) return false; return true; };
  const gen = (extra: unknown[] = []) => ({ profile: "genesis", pixelMode: true, accent: "#e02020", roles: { sea: "#2050c8" }, assets: { photo: { sha256: "0".repeat(64), width: ga.photo.width, height: ga.photo.height } }, layers: [{ type: "image", asset: "photo", fit: "cover", drive: "none" }, { type: "dither", colors: "sea,accent", y0: 0.7, matrix: "2", drive: "none" }, ...extra] });
  check("genesis: an image scene has every channel on the 9-bit grid", [0.05, 0.95].every((level) => onGrid(render(gen([{ type: "grid", solid: true, pattern: "#a.b/.b#a/a#b." }, { type: "bars", heightFrac: 0.3 }]), 320, 224, { level }))));
  check("genesis: the image differs from its unsnapped colours (the check can fail)", !onGrid(render({ ...gen(), profile: undefined }, 320, 224)));
  // dither matrix 2: the band at the half level alternates its two stops cell by cell.
  const d2 = render({ background: "black", layers: [{ type: "dither", colors: "bg,fg", matrix: "2", drive: "none" }] }, 64, 65, { creative: false });
  const at = (x: number, y: number) => d2[(y * 64 + x) * 4];
  check("dither matrix 2: the half-level band is a strict checkerboard", [31, 32, 33].every((y) => Array.from({ length: 63 }, (_, x) => x).every((x) => at(x, y) !== at(x + 1, y))) && Array.from({ length: 64 }, (_, x) => x).every((x) => at(x, 32) !== at(x, 33)));
  check("dither matrix 2 renders identically twice", hashOf(render({ layers: [{ type: "dither", matrix: "2" }] }, 160, 90)) === hashOf(render({ layers: [{ type: "dither", matrix: "2" }] }, 160, 90)));
  // Every primitive's default layer stays inside the palette rule (bg, fg, accent, and
  // each role with bg and fg) under the profile's palette, in both arrangements.
  // `image` is exempt: in creative mode it draws the art's own colours by design.
  // `tunnel` stacks translucent accent strokes; canvas rounding at each layer drifts
  // up to 3 levels off this nearly collinear triangle (it cancels on black and white),
  // so it is held to at most 4 such pixels rather than exempted.
  const outside: string[] = [];
  let tunnelDrift = 0;
  for (const background of ["white", "black"]) {
    const palette = profilePalette("gameboy-dmg", background, background === "white" ? "black" : "white", false, undefined, {});
    for (const prim of PRIMITIVES) {
      const layer = sanitizeLayer({ type: prim.type });
      if (!layer) continue;
      const ctx = createCanvas(160, 144).getContext("2d");
      drawSpec(ctx, { width: 160, height: 144 }, { ...frameAt(0.6), labels: ["GOLDEN 0123"], coords: [{ x: 0.25, y: 0.4 }, { x: 0.6, y: 0.55 }] }, { background, profile: "gameboy-dmg", layers: [layer] } as any, { reducedFlicker: true, creative: true, seed: 3, assets: ga as never });
      if (prim.type === "image") continue;
      const v = paletteViolation(ctx.getImageData(0, 0, 160, 144).data, palette as any);
      if (v && prim.type === "tunnel") tunnelDrift = Math.max(tunnelDrift, v.count);
      else if (v) outside.push(`${prim.type} (${background})`);
    }
  }
  check("gameboy-dmg: every primitive's default layer stays inside the palette rule", outside.length === 0, outside.join(", "));
  check("gameboy-dmg: tunnel's compositing drift stays at most 4 pixels", tunnelDrift <= 4, `${tunnelDrift} pixels`);
  const gbWhole = [3, 4, 5].map((i) => hashOf(render(gbScene("white"), 160, 144, { i })));
  check("gameboy-dmg: frames render alone and in any order", [5, 4, 3].map((i) => hashOf(render(gbScene("white"), 160, 144, { i }))).reverse().join() === gbWhole.join());
}

if (failures > 0) {
  console.error(`\ndeterminism gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\ndeterminism gate passed");
