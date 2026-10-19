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
import { computeHashes, renderCases, orderIndependenceMismatches, type GoldenApi } from "./lib/goldenHashes";
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
const api: GoldenApi = { createCanvas: createCanvas as GoldenApi["createCanvas"], drawSpec, PRIMITIVES, sanitizeLayer };
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
  const renderCam = (spec: any, i: number): string => {
    const canvas = createCanvas(320, 180);
    const ctx = canvas.getContext("2d");
    drawSpec(ctx, { width: 320, height: 180 }, frameAt(i), spec, { reducedFlicker: true, creative: false, seed: 7 });
    return crypto.createHash("sha256").update(ctx.getImageData(0, 0, 320, 180).data).digest("hex");
  };
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
