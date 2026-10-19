/**
 * SignalFrame track format gate (specs/008-signalframe-format). Offline, exits
 * non-zero on failure.
 *
 *   1. Round-trip: encode a synthetic track, decode it, and assert every field
 *      is bit-identical (floats are little-endian float64, so lossless).
 *   2. Render equality: rendering the original frames and the decoded frames
 *      produces byte-identical hashes — the "identical frames" outcome.
 *   3. Reject corrupt input: bad magic, unsupported version, truncated data,
 *      a length mismatch, and an out-of-range sidecar index.
 *   4. Conformance fixture (spec 011): the committed
 *      golden/signalframe/sample.asft (+ .ndjson) is byte-identical to what
 *      the encoder produces for the sample track, its SHA-256 matches the
 *      pinned hash, and its decoded values are the pinned ones.
 *   5. Per-frame reader (spec 011): readSignalFrame equals the whole-track
 *      decode for every frame, from any view, and rejects the same corrupt
 *      input; an unknown sidecar field is ignored (the v1 rule).
 *
 *   npm run verify:signalframe
 *   npx tsx scripts/verify-signalframe.ts --write-fixture   # (re)write the
 *   committed fixture; only for an intended change, stated like golden:update
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";
import { sanitizeLayer } from "../src/primitives/registry";
import {
  encodeSignalTrack,
  decodeSignalTrack,
  readSignalTrackHeader,
  readSignalFrame,
  indexSignalTrackSidecar,
  SIGNAL_TRACK_MAGIC,
  SIGNAL_TRACK_HEADER_SIZE,
  type SignalTrack,
} from "../src/signalframe/index";
import type { SignalFrame } from "../src/types";

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, "golden", "signalframe");
const SAMPLE_ASFT = path.join(FIXTURE_DIR, "sample.asft");
const SAMPLE_NDJSON = path.join(FIXTURE_DIR, "sample.asft.ndjson");
/** SHA-256 of the committed sample.asft; changes only with an intended fixture change. */
const PINNED_SAMPLE_SHA256 = "c91ff5ab293f2d8789812ad20ef123f8812f1aaf3fc17af5ffca71731604712a";

const DIMS = { width: 320, height: 180 };
const SEED = 12345;

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures++; }
};

const hashRgba = (rgba: Uint8ClampedArray) => crypto.createHash("sha256").update(rgba).digest("hex");

function render(frame: SignalFrame): string {
  const canvas = createCanvas(DIMS.width, DIMS.height);
  const ctx = canvas.getContext("2d");
  const spec = {
    background: "black" as const,
    layers: [
      { type: "grid" },
      { type: "wave" },
      { type: "caption" },
      { type: "particles" },
      { type: "noise" },
    ],
  };
  drawSpec(ctx, DIMS, frame, spec, { reducedFlicker: true, creative: false, seed: SEED });
  return hashRgba(ctx.getImageData(0, 0, DIMS.width, DIMS.height).data);
}

/** A synthetic track whose frames touch values, spectrum, amplitude, energy, labels and coords. */
function syntheticTrack(): SignalTrack {
  const fps = 30;
  const n = 12;
  const frames: SignalFrame[] = [];
  for (let i = 0; i < n; i++) {
    const level = 0.05 + 0.9 * (0.5 + 0.5 * Math.sin(i / 2.3));
    const frame: SignalFrame = {
      index: i,
      t: i / fps,
      values: Float64Array.from({ length: 64 }, (_, k) => level * ((Math.sin(k / 5 + i / 7) + 1) / 2)),
      spectrum: Float64Array.from({ length: 64 }, (_, k) => level * Math.max(0, 1 - k / 64)),
      amplitude: level,
      energy: level * 0.8,
    };
    if (i === 2) frame.labels = ["hello", "world 123"];
    if (i === 7) frame.labels = ["Ω é ñ 日本語"];
    if (i === 3) frame.coords = [{ x: 0.25, y: 0.75 }, { x: 0.5, y: 0.5 }];
    if (i === 8) frame.coords = [{ x: 12.5, y: -40.125 }];
    frames.push(frame);
  }
  return { fps, frames };
}

/**
 * The committed sample track (spec 011): small enough to inspect, varied
 * enough that a stride or order mix-up cannot pass. Definition lives here; the
 * committed bytes under golden/signalframe/ are produced by the encoder from
 * it and never edited by hand.
 */
function sampleTrack(): SignalTrack {
  const fps = 30;
  const levels = [0.1, 0.35, 0.7, 0.95];
  const frames: SignalFrame[] = levels.map((level, i) => ({
    index: i,
    t: i / fps,
    values: Float64Array.from({ length: 4 }, (_, k) => Math.round(level * ((Math.sin(k / 3 + i) + 1) / 2) * 1000) / 1000),
    spectrum: Float64Array.from({ length: 4 }, (_, k) => Math.round(level * (1 - k / 4) * 0.9 * 1000) / 1000),
    amplitude: level,
    energy: level * 0.8,
  }));
  frames[2].labels = ["chunk", "sample 042"];
  frames[2].coords = [{ x: 0.25, y: 0.5 }, { x: 1, y: 0 }];
  frames[2].viseme = 14;
  frames[2].beat = 0.875;
  frames[0].beat = 0.125; // a beat-only frame (no viseme) exercises the sentinels
  return { fps, frames };
}

// --write-fixture: (re)generate the committed bytes from the sample track.
// Only for an intended fixture change, the way golden:update is used.
if (process.argv.includes("--write-fixture")) {
  const encodedSample = encodeSignalTrack(sampleTrack());
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(SAMPLE_ASFT, encodedSample.data);
  if (encodedSample.sidecar !== null) fs.writeFileSync(SAMPLE_NDJSON, encodedSample.sidecar);
  console.log(`wrote ${SAMPLE_ASFT} (${encodedSample.data.byteLength} bytes) and ${SAMPLE_NDJSON}`);
  console.log(`sha256 ${crypto.createHash("sha256").update(encodedSample.data).digest("hex")}`);
  process.exit(0);
}

// ---- 1. round-trip ---------------------------------------------------------

const track = syntheticTrack();
const encoded = encodeSignalTrack(track);
const decoded = decodeSignalTrack(encoded);

check("magic tag", SIGNAL_TRACK_MAGIC === "ASFT");
check("header size is 32", SIGNAL_TRACK_HEADER_SIZE === 32);
check("encoded length matches header + stride", encoded.data.byteLength === SIGNAL_TRACK_HEADER_SIZE + track.frames.length * (16 + 8 * (64 + 64)));
check("fps round-trips", decoded.fps === track.fps);
check("frame count round-trips", decoded.frames.length === track.frames.length);

const sameFloat64 = (a: Float64Array, b: Float64Array) => a.length === b.length && a.every((v, k) => v === b[k]);
const sameCoords = (a: { x: number; y: number }[] | undefined, b: { x: number; y: number }[] | undefined) =>
  (!a && !b) || (!!a && !!b && a!.length === b!.length && a!.every((c, k) => c.x === b![k].x && c.y === b![k].y));
const sameLabels = (a: string[] | undefined, b: string[] | undefined) =>
  (!a && !b) || (!!a && !!b && a!.length === b!.length && a!.every((s, k) => s === b![k]));

let fieldsOk = true;
for (let i = 0; i < track.frames.length; i++) {
  const a = track.frames[i], b = decoded.frames[i];
  fieldsOk &&= a.index === b.index;
  fieldsOk &&= a.t === b.t;
  fieldsOk &&= a.amplitude === b.amplitude;
  fieldsOk &&= a.energy === b.energy;
  fieldsOk &&= sameFloat64(a.values, b.values);
  fieldsOk &&= sameFloat64(a.spectrum, b.spectrum);
  fieldsOk &&= sameLabels(a.labels, b.labels);
  fieldsOk &&= sameCoords(a.coords, b.coords);
  fieldsOk &&= a.viseme === b.viseme;
  fieldsOk &&= a.beat === b.beat;
}
check("every field round-trips bit-identically", fieldsOk);

check("sidecar present for label/coord frames", encoded.sidecar !== null && encoded.sidecar.split("\n").filter((l) => l.trim()).length === 4);
check("no sidecar when nothing is optional", encodeSignalTrack({ fps: 30, frames: track.frames.map((f) => ({ ...f, labels: undefined, coords: undefined })) }).sidecar === null);

// ---- 2. render equality ----------------------------------------------------

let rendersMatch = true;
for (let i = 0; i < track.frames.length; i++) {
  if (render(track.frames[i]) !== render(decoded.frames[i])) { rendersMatch = false; break; }
}
check("original and decoded frames render byte-identically", rendersMatch);

// ---- 3. corrupt input ------------------------------------------------------

const bad = (mutate: (b: Uint8Array) => void) => {
  const b = encoded.data.slice();
  mutate(b);
  return b;
};
const throws = (name: string, fn: () => unknown) => {
  try { fn(); check(`rejects ${name}`, false); }
  catch { check(`rejects ${name}`, true); }
};

throws("bad magic", () => decodeSignalTrack({ data: bad((b) => { b[0] = 0x00; }), sidecar: encoded.sidecar }));
throws("unsupported version", () => decodeSignalTrack({ data: bad((b) => { new DataView(b.buffer, b.byteOffset).setUint16(4, 99, true); }), sidecar: encoded.sidecar }));
throws("truncated header", () => decodeSignalTrack({ data: encoded.data.slice(0, 10), sidecar: encoded.sidecar }));
throws("truncated body", () => decodeSignalTrack({ data: encoded.data.slice(0, encoded.data.byteLength - 8), sidecar: encoded.sidecar }));
throws("trailing bytes", () => decodeSignalTrack({ data: (() => { const c = new Uint8Array(encoded.data.byteLength + 8); c.set(encoded.data); return c; })(), sidecar: encoded.sidecar }));
throws("out-of-range sidecar index", () => decodeSignalTrack({ data: encoded.data, sidecar: '{"index":999,"labels":["x"]}\n' }));
throws("malformed sidecar line", () => decodeSignalTrack({ data: encoded.data, sidecar: "not json\n" }));
throws("sidecar labels non-string", () => decodeSignalTrack({ data: encoded.data, sidecar: '{"index":0,"labels":[1,2]}\n' }));

// ---- 4. committed conformance fixture (spec 011) ---------------------------

const sample = sampleTrack();
const sampleEncoded = encodeSignalTrack(sample);
check(
  "committed fixture exists",
  fs.existsSync(SAMPLE_ASFT) && fs.existsSync(SAMPLE_NDJSON),
  "run: npx tsx scripts/verify-signalframe.ts --write-fixture",
);

if (fs.existsSync(SAMPLE_ASFT) && fs.existsSync(SAMPLE_NDJSON)) {
  const committed = fs.readFileSync(SAMPLE_ASFT);
  const committedSidecar = fs.readFileSync(SAMPLE_NDJSON, "utf8");
  const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);

  check("fixture bytes equal the encoder's output", bytesEqual(committed, sampleEncoded.data));
  check("fixture sidecar equals the encoder's sidecar", committedSidecar === sampleEncoded.sidecar);
  const sha = crypto.createHash("sha256").update(committed).digest("hex");
  check(
    "fixture SHA-256 matches the pinned hash",
    sha === PINNED_SAMPLE_SHA256,
    `got ${sha} — an intended fixture change updates PINNED_SAMPLE_SHA256 and says so`,
  );

  const header = readSignalTrackHeader(committed);
  check(
    "fixture header fields",
    header.version === 1 && header.fps === 30 && header.frameCount === 4 && header.valuesLen === 4 && header.spectrumLen === 4 && header.stride === 80 && header.flags === 1,
  );
  const committedTrack = decodeSignalTrack({ data: committed, sidecar: committedSidecar });
  let pinnedOk = true;
  for (let i = 0; i < sample.frames.length; i++) {
    const a = sample.frames[i], b = committedTrack.frames[i];
    pinnedOk &&= a.index === b.index && a.t === b.t && a.amplitude === b.amplitude && a.energy === b.energy;
    pinnedOk &&= sameFloat64(a.values, b.values) && sameFloat64(a.spectrum, b.spectrum);
    pinnedOk &&= sameLabels(a.labels, b.labels) && sameCoords(a.coords, b.coords);
    pinnedOk &&= a.viseme === b.viseme && a.beat === b.beat;
  }
  check("fixture decodes to the pinned values", pinnedOk);

  // ---- 5. per-frame reader (spec 011) ---------------------------------------

  let perFrameOk = true;
  for (let n = 0; n < header.frameCount; n++) {
    const whole = committedTrack.frames[n];
    const viaString = readSignalFrame(committed, header, n, committedSidecar);
    const viaIndex = readSignalFrame(committed, header, n, indexSignalTrackSidecar(committedSidecar, header.frameCount));
    for (const f of [viaString, viaIndex]) {
      perFrameOk &&= f.index === whole.index && f.t === whole.t && f.amplitude === whole.amplitude && f.energy === whole.energy;
      perFrameOk &&= sameFloat64(f.values, whole.values) && sameFloat64(f.spectrum, whole.spectrum);
      perFrameOk &&= sameLabels(f.labels, whole.labels) && sameCoords(f.coords, whole.coords);
    }
  }
  check("every frame reads per-frame exactly as whole-track", perFrameOk);

  // A view with a non-zero byteOffset (a memory-mapped file) reads the same.
  const padded = new Uint8Array(13 + committed.byteLength + 5);
  padded.set(committed, 13);
  const view = padded.subarray(13, 13 + committed.byteLength);
  const viewHeader = readSignalTrackHeader(view);
  const frameInView = readSignalFrame(view, viewHeader, 2, committedSidecar);
  const frameDirect = readSignalFrame(committed, header, 2, committedSidecar);
  check(
    "reads work on a view with a non-zero byteOffset",
    viewHeader.frameCount === header.frameCount &&
      frameInView.amplitude === frameDirect.amplitude &&
      sameFloat64(frameInView.values, frameDirect.values) &&
      sameLabels(frameInView.labels, frameDirect.labels),
  );

  throws("per-frame: n past the end", () => readSignalFrame(committed, header, header.frameCount, null));
  throws("per-frame: negative n", () => readSignalFrame(committed, header, -1, null));
  throws("per-frame: non-integer n", () => readSignalFrame(committed, header, 1.5, null));
  throws("per-frame: truncated bytes", () => readSignalFrame(committed.subarray(0, committed.byteLength - 8), header, 1, null));
  throws("per-frame: header from another track", () => readSignalFrame(committed, readSignalTrackHeader(encoded.data), 0, null));
  throws("per-frame: wrong-shaped labels", () => readSignalFrame(committed, header, 2, '{"index":2,"labels":[1,2]}\n'));
  throws("per-frame: malformed sidecar line", () => readSignalFrame(committed, header, 2, "not json\n"));

  // The v1 sidecar rule: an unknown field is ignored, recognised ones are not.
  const withUnknown = committedSidecar.trimEnd().split("\n")
    .map((l) => JSON.stringify({ ...(JSON.parse(l) as object), ttl_seconds: 30 }))
    .join("\n") + "\n";
  const plain = readSignalFrame(committed, header, 2, committedSidecar);
  const unknown = readSignalFrame(committed, header, 2, withUnknown);
  check(
    "unknown sidecar field is ignored (v1 rule)",
    unknown.amplitude === plain.amplitude && sameLabels(unknown.labels, plain.labels) && sameCoords(unknown.coords, plain.coords),
  );
}

if (failures > 0) {
  console.error(`\nsignalframe gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nsignalframe gate passed");
