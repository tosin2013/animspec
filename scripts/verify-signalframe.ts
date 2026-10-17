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
 *
 *   npm run verify:signalframe
 */
import crypto from "crypto";
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";
import { sanitizeLayer } from "../src/primitives/registry";
import {
  encodeSignalTrack,
  decodeSignalTrack,
  SIGNAL_TRACK_MAGIC,
  SIGNAL_TRACK_HEADER_SIZE,
  type SignalTrack,
} from "../src/signalframe/index";
import type { SignalFrame } from "../src/types";

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

if (failures > 0) {
  console.error(`\nsignalframe gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nsignalframe gate passed");
