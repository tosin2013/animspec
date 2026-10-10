/**
 * `npm run loops:generate` — render one animated GIF loop per primitive into
 * `loops/`, drawn from each primitive's validated default layer at a fixed
 * seed while the synthetic signal sweeps quiet to loud and back. The frames
 * use the same closed-form shape as the gate frames in
 * `scripts/lib/goldenHashes.ts` (goldenFrames), swept over the level, so the
 * loops show exactly the reactivity the gates test. The output is committed,
 * copied into the site by `generate-site.ts`, and staleness-checked by
 * `npm run site:check`. No clock, no randomness, no network.
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas, GifEncoder } from "@napi-rs/canvas";
import { PRIMITIVES, sanitizeLayer } from "../src/primitives/registry.js";
import { drawSpec } from "../src/specInterpreter.js";

type Frame = {
  index: number;
  t: number;
  values: Float64Array;
  spectrum: Float64Array;
  amplitude: number;
  energy: number;
  labels?: string[];
};

const DIMS = { width: 320, height: 180 };
const SEED = 12345;
const FRAMES = 12;
const DELAY_MS = 160;
const QUIET = 0.02;
const LOUD = 0.95;

/** One synthetic frame at a swept level, same shape as goldenFrames' mk(). */
function frameAt(index: number, level: number): Frame {
  return {
    index,
    t: index / 30,
    values: Float64Array.from(
      { length: 256 },
      (_, i) => level * (Math.sin(i / 5 + index / 7) + 1) / 2,
    ),
    spectrum: Float64Array.from(
      { length: 256 },
      (_, i) => level * Math.max(0, 1 - i / 256),
    ),
    amplitude: level,
    energy: level * 0.8,
    labels: ["GOLDEN 0123"],
  };
}

/** Quiet to loud and back, closed-form so every machine sweeps identically. */
function levelAt(i: number): number {
  return QUIET + (LOUD - QUIET) * Math.sin((Math.PI * i) / (FRAMES - 1));
}

const dir = path.join("loops");
fs.mkdirSync(dir, { recursive: true });

let written = 0;
let bytes = 0;
for (const p of PRIMITIVES) {
  const layer = sanitizeLayer({ type: p.type }) as { type: string; [k: string]: unknown } | null;
  if (!layer) continue;
  const canvas = createCanvas(DIMS.width, DIMS.height);
  const ctx = canvas.getContext("2d");
  const encoder = new GifEncoder(DIMS.width, DIMS.height, {
    repeat: 0,
    quality: 10,
  });
  for (let i = 0; i < FRAMES; i++) {
    const frame = frameAt(i, levelAt(i));
    drawSpec(ctx, DIMS, frame, { layers: [layer] }, {
      reducedFlicker: true,
      creative: false,
      seed: SEED,
    });
    const rgba = ctx.getImageData(0, 0, DIMS.width, DIMS.height).data;
    encoder.addFrame(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), DIMS.width, DIMS.height, {
      delay: DELAY_MS,
    });
  }
  const gif = encoder.finish();
  fs.writeFileSync(path.join(dir, `${p.type}.gif`), gif);
  written++;
  bytes += gif.byteLength;
}

console.log(
  `loops: wrote ${written} loops to loops/ (${FRAMES} frames each, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB total)`,
);