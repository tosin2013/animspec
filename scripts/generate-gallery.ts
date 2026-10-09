/**
 * `npm run gallery:generate` — render one reference thumbnail per primitive into
 * `gallery/`, drawn from each primitive's validated default layer at a fixed
 * frame. The output is committed and checked by the registry gate. No file or
 * network access in the render, and the output does not depend on the working
 * directory.
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { PRIMITIVES, sanitizeLayer } from "../src/primitives/registry.js";
import { drawSpec } from "../src/specInterpreter.js";
import { goldenFrames } from "./lib/goldenHashes.js";
import { encodeFrame } from "./lib/referenceSets.js";

const DIMS = { width: 320, height: 180 };
const frame = goldenFrames().mid;

const dir = path.join("gallery");
fs.mkdirSync(dir, { recursive: true });

let written = 0;
for (const p of PRIMITIVES) {
  const layer = sanitizeLayer({ type: p.type }) as { type: string; [k: string]: unknown } | null;
  if (!layer) continue;
  const canvas = createCanvas(DIMS.width, DIMS.height);
  const ctx = canvas.getContext("2d");
  drawSpec(ctx, DIMS, frame, { layers: [layer] }, { reducedFlicker: true, creative: false, seed: 12345 });
  const rgba = ctx.getImageData(0, 0, DIMS.width, DIMS.height).data;
  const png = await encodeFrame(rgba, DIMS.width, DIMS.height);
  fs.writeFileSync(path.join(dir, `${p.type}.png`), png);
  written++;
}
console.log(`gallery: wrote ${written} thumbnails to gallery/`);
