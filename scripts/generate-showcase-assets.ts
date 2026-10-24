/**
 * Write the parallax-forest showcase planes (spec 022) to
 * showcase/assets/parallax-forest/. Run once when the art changes:
 *
 *   npx tsx scripts/generate-showcase-assets.ts
 *
 * The PNGs are committed, and the showcase declares each with the sha256 of
 * its file bytes, so the declared digest is the same on every machine.
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const out = path.join("showcase", "assets", "parallax-forest");
fs.mkdirSync(out, { recursive: true });

const plane = (w: number, h: number, paint: (c: any) => void) => { const cv = createCanvas(w, h); paint(cv.getContext("2d")); return cv; };
const sky = plane(320, 180, (c) => { for (let y = 0; y < 180; y++) { c.fillStyle = `rgb(${40 + y / 3},${90 + y / 2},${200 - y / 6})`; c.fillRect(0, y, 320, 1); } });
const mountains = plane(320, 180, (c) => {
  c.fillStyle = "#5a6a8c";
  c.beginPath(); c.moveTo(0, 130);
  for (let x = 0; x <= 320; x += 40) c.lineTo(x, x % 80 === 0 ? 70 : 115);
  c.lineTo(320, 130); c.lineTo(320, 180); c.lineTo(0, 180); c.closePath(); c.fill();
});
const trees = plane(160, 180, (c) => {
  c.fillStyle = "#1e5a32";
  for (let x = 0; x < 160; x += 32) { c.beginPath(); c.moveTo(x + 4, 150); c.lineTo(x + 16, 92); c.lineTo(x + 28, 150); c.closePath(); c.fill(); }
  c.fillStyle = "#4a2e1a"; for (let x = 0; x < 160; x += 32) c.fillRect(x + 14, 150, 4, 10);
});
const ground = plane(64, 180, (c) => {
  for (let x = 0; x < 64; x += 8) { c.fillStyle = (x / 8) % 2 ? "#8a5a2a" : "#a06a34"; c.fillRect(x, 158, 8, 22); }
  c.fillStyle = "#3a8a2a"; c.fillRect(0, 154, 64, 5);
});

for (const [id, cv] of Object.entries({ sky, mountains, trees, ground })) {
  fs.writeFileSync(path.join(out, `${id}.png`), cv.toBuffer("image/png"));
  console.log(`  wrote ${path.join(out, `${id}.png`)}`);
}
