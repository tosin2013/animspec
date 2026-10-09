/**
 * Package gate (specs/004-publishable-npm-package). Proves the built package
 * reproduces the committed golden hashes — the M1 gate ("the private product
 * renders from the package with identical hashes"). Builds the library, imports
 * the built `dist/index.js`, and renders the same reference cases the source
 * tree does, comparing against `golden/<type>/hashes.json`.
 *
 * Run: npx tsx scripts/verify-package.ts
 */
import { execSync } from "node:child_process";
import { createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { processorType } from "./lib/referenceSets.js";
import { computeHashes } from "./lib/goldenHashes.js";

// 1. Build the package.
execSync("npm run build", { stdio: "inherit" });

// 2. Import the built package's public surface.
const distUrl = pathToFileURL(path.resolve("dist", "index.js")).href;
const pkg = (await import(distUrl)) as {
  drawSpec: (ctx: unknown, dims: unknown, frame: unknown, spec: unknown, opts: unknown, caption?: string) => void;
  PRIMITIVES: ReadonlyArray<{ type: string }>;
  sanitizeLayer: (raw: unknown) => Record<string, unknown> | null;
};

const api = {
  createCanvas: (w: number, h: number) => createCanvas(w, h),
  drawSpec: pkg.drawSpec,
  PRIMITIVES: pkg.PRIMITIVES,
  sanitizeLayer: pkg.sanitizeLayer,
};

// 3. Render every reference case through the package and compare.
const type = processorType();
if (!type) {
  console.error("  no reference set for this machine — exact comparison not made");
  process.exit(1);
}
const golden = JSON.parse(fs.readFileSync(path.join("golden", type, "hashes.json"), "utf8")) as Record<string, string>;
const hashes = computeHashes(api);

let failures = 0;
for (const [key, hash] of Object.entries(hashes)) {
  if (golden[key] !== hash) {
    failures++;
    console.error(`  FAIL  ${key} differs from the golden hash`);
  }
}
for (const key of Object.keys(golden)) {
  if (!(key in hashes)) {
    failures++;
    console.error(`  FAIL  ${key} is missing from the package render`);
  }
}

if (failures > 0) {
  console.error(`\npackage gate FAILED (${failures} case(s))`);
  process.exit(1);
}
console.log(`PASS  package reproduces the golden hashes (${Object.keys(hashes).length} cases)`);
