import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { customIcons } from "./customIcons";

/**
 * LED-sign icon source (ADR 0018, Increment 5b). Turns an icon NAME into a 1-bit
 * bitmap for the dot-matrix — from a community bitmap (customIcons) if present,
 * else the pixelarticons font (~1000 icons) rasterized via resvg. Cached; pure +
 * synchronous (resvg render is sync), so it works inside a per-frame draw call.
 *
 * This is what makes the LED sign scale like text: icons become a library, not
 * hardcoded arrays. (Iconify's 200k+ is a documented future long-tail — #42.)
 */
const cache = new Map<string, boolean[][] | null>();
const ICON_DIR = path.join(process.cwd(), "node_modules", "pixelarticons", "svg");

/** Bitmap for `name` at ~`size` rows tall; null if the name is unknown. */
export function getIconBitmap(name: string, size = 12): boolean[][] | null {
  const key = `${name}@${size}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let grid: boolean[][] | null = null;
  const clean = name.trim().toLowerCase();

  if (customIcons[clean]) {
    grid = customIcons[clean].map((row) => row.split("").map((ch) => ch === "1" || ch === "#"));
  } else {
    try {
      const file = path.join(ICON_DIR, `${clean}.svg`);
      if (fs.existsSync(file)) {
        const svg = fs.readFileSync(file, "utf8").replace(/currentColor/g, "#000000");
        const r = new Resvg(svg, { fitTo: { mode: "height", value: size }, background: "white" }).render();
        const { pixels, width, height } = r;
        grid = [];
        for (let y = 0; y < height; y++) {
          const row: boolean[] = [];
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            row.push(lum < 128);
          }
          grid.push(row);
        }
      }
    } catch {
      grid = null;
    }
  }

  cache.set(key, grid);
  return grid;
}
