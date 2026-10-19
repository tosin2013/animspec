/**
 * Talking-rig demo (issue #68 follow-up): renders a short animated GIF of the
 * `rig` primitive working — mouth driven by a synthetic speech envelope, the
 * seeded blink, a head tilt and a pose sweep — so the primitive can be seen,
 * not just described.
 *
 * Deterministic: the same seed and frame count reproduce the exact bytes.
 * Generator-only: never imported by `src/`.
 *
 *   npx tsx scripts/demo-rig.ts
 *   → docs/public/demo/rig-talking.gif
 */
import fs from "fs";
import path from "path";
import { createCanvas, GifEncoder } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";

const W = 640;
const H = 360;
const FPS = 30;
const SECONDS = 3;
const SEED = 12;
const OUT = path.join("docs", "public", "demo", "rig-talking.gif");

/**
 * A synthetic "spoken sentence" envelope: syllable bursts inside word groups,
 * with short pauses — pure function of t, so the demo replays byte-for-byte.
 */
const amplitudeAt = (t: number): number => {
  const syllable = Math.sin(t * 2 * Math.PI * 3.2);
  const wordGroup = 0.55 + 0.45 * Math.sin(t * 2 * Math.PI * 0.9);
  const pause = Math.sin(t * 2 * Math.PI * 0.55) > -0.35 ? 1 : 0.08;
  return Math.max(0, Math.min(1, (0.35 + 0.35 * syllable) * wordGroup * pause + 0.06));
};

/** Pose and head tilt across the three seconds: talk, then point, then cheer. */
const stageAt = (i: number): { pose: string; headAngle: number } => {
  if (i < 30) return { pose: "talk", headAngle: -6 };
  if (i < 60) return { pose: "point", headAngle: 4 };
  return { pose: "cheer", headAngle: -10 + 5 * Math.sin(i / 4) };
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const encoder = new GifEncoder(W, H, { repeat: 0, quality: 10 });

for (let i = 0; i < FPS * SECONDS; i++) {
  const t = i / FPS;
  const level = amplitudeAt(t);
  const { pose, headAngle } = stageAt(i);
  const frame = {
    index: i,
    t,
    values: Float64Array.from({ length: 16 }, (_, k) => level * ((Math.sin(k / 3 + t) + 1) / 2)),
    spectrum: Float64Array.from({ length: 16 }, (_, k) => level * Math.max(0, 1 - k / 16)),
    amplitude: level,
    energy: level * 0.8,
  };
  drawSpec(ctx, { width: W, height: H }, frame, {
    background: "black",
    layers: [{ type: "rig", rig: "host", pose, headAngle, scale: 0.6, y: 0.92 }],
  }, { reducedFlicker: true, creative: false, seed: SEED });
  const rgba = ctx.getImageData(0, 0, W, H).data;
  encoder.addFrame(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), W, H, {
    delay: Math.round(1000 / FPS),
  });
}

const gif = encoder.finish();
fs.writeFileSync(OUT, gif);
console.log(`wrote ${OUT} (${gif.byteLength} bytes, ${FPS * SECONDS} frames at ${FPS} fps)`);
