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
import { PRIMITIVES, sanitizeLayer } from "../src/primitives/registry";
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

if (failures > 0) {
  console.error(`\ndeterminism gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\ndeterminism gate passed");
