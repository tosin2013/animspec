/**
 * `npm run gallery:generate` — render one reference thumbnail per primitive into
 * `gallery/`, drawn from each primitive's validated default layer at a fixed
 * frame (scripts/lib/thumbnails.ts). The output is committed, and the registry
 * gate re-renders it and fails when a committed thumbnail is stale. No file or
 * network access in the render, and the output does not depend on the working
 * directory.
 */
import fs from "node:fs";
import path from "node:path";
import { PRIMITIVES } from "../src/primitives/registry.js";
import { encodeFrame } from "./lib/referenceSets.js";
import { renderThumbnail, THUMBNAIL_DIMS } from "./lib/thumbnails.js";

const dir = path.join("gallery");
fs.mkdirSync(dir, { recursive: true });

let written = 0;
for (const p of PRIMITIVES) {
  const rgba = renderThumbnail(p.type);
  if (!rgba) continue;
  const png = await encodeFrame(rgba, THUMBNAIL_DIMS.width, THUMBNAIL_DIMS.height);
  fs.writeFileSync(path.join(dir, `${p.type}.png`), png);
  written++;
}
console.log(`gallery: wrote ${written} thumbnails to gallery/`);
