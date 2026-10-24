/**
 * Write the showcase image assets: the parallax-forest planes (spec 022) to
 * showcase/assets/parallax-forest/ and the walk-cycle sprite sheet (spec 023)
 * to showcase/assets/sheet-walk/. Run once when the art changes:
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

// Walk cycle (spec 023): 8 cells of 32 × 40, legs and arms swinging, on a
// transparent background.
const sheetOut = path.join("showcase", "assets", "sheet-walk");
fs.mkdirSync(sheetOut, { recursive: true });
const walk = plane(256, 40, (c) => {
  for (let i = 0; i < 8; i++) {
    const ox = i * 32, swing = Math.round(5 * Math.sin((2 * Math.PI * i) / 8));
    c.fillStyle = "#2d4a8c"; c.fillRect(ox + 13 + swing, 26, 4, 12); // far leg
    c.fillStyle = "#3a5ca8"; c.fillRect(ox + 15 - swing, 26, 4, 12); // near leg
    c.fillStyle = "#5a3418"; c.fillRect(ox + 12 + swing, 37, 6, 3); c.fillRect(ox + 14 - swing, 37, 6, 3); // boots
    c.fillStyle = "#a02828"; c.fillRect(ox + 12, 12, 8, 15); // tunic
    c.fillStyle = "#f0c8a0"; c.fillRect(ox + 10 - swing, 14, 3, 10); c.fillRect(ox + 19 + swing, 14, 3, 10); // arms
    c.fillStyle = "#f0c8a0"; c.fillRect(ox + 11, 2, 10, 10); // head
    c.fillStyle = "#8a4a20"; c.fillRect(ox + 11, 1, 10, 4); // hair
    c.fillStyle = "#201010"; c.fillRect(ox + 18, 6, 2, 2); // eye
  }
});
fs.writeFileSync(path.join(sheetOut, "walk.png"), walk.toBuffer("image/png"));
console.log(`  wrote ${path.join(sheetOut, "walk.png")}`);
