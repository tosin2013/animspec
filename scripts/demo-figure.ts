/**
 * Figure demo (issue #70 follow-up): renders a documentary thought-experiment
 * stage to an animated GIF — six silhouettes appear one by one in a split
 * arrangement, a type-reveal poses the question, and the highlight sweeps the
 * figures. Deterministic: the same seed and frame count reproduce the exact
 * bytes. Generator-only: never imported by `src/`.
 *
 *   npx tsx scripts/demo-figure.ts
 *   → docs/public/demo/figure-dilemma.gif
 */
import fs from "fs";
import path from "path";
import { createCanvas, GifEncoder } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";

const W = 640;
const H = 360;
const FPS = 30;
const SECONDS = 4;
const SEED = 9;
const OUT = path.join("docs", "public", "demo", "figure-dilemma.gif");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const encoder = new GifEncoder(W, H, { repeat: 0, quality: 10 });

for (let i = 0; i < FPS * SECONDS; i++) {
  const t = i / FPS;
  // The highlight sweeps the figures once everyone has appeared.
  const highlight = i < 66 ? 0 : 1 + (Math.floor((i - 66) / 9) % 6);
  const frame = {
    index: i,
    t,
    values: Float64Array.from({ length: 16 }, () => 0.5),
    spectrum: Float64Array.from({ length: 16 }, (_, k) => Math.max(0, 1 - k / 16)),
    amplitude: 0.5,
    energy: 0.5,
    labels: ["Ana", "Ben", "Cal", "Dot", "Eli", "Fay"],
  };
  drawSpec(ctx, { width: W, height: H }, frame, {
    background: "black",
    layers: [
      { type: "type-reveal", text: "who will act?", framesPerUnit: 8, fontSize: 44, y: 0.2 },
      { type: "figure", count: 6, stance: "stand", arrangement: "split", highlight, labels: true, reveal: 0.35 },
    ],
  }, { reducedFlicker: true, creative: true, seed: SEED });
  const rgba = ctx.getImageData(0, 0, W, H).data;
  encoder.addFrame(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), W, H, {
    delay: Math.round(1000 / FPS),
  });
}

const gif = encoder.finish();
fs.writeFileSync(OUT, gif);
console.log(`wrote ${OUT} (${gif.byteLength} bytes, ${FPS * SECONDS} frames at ${FPS} fps)`);
