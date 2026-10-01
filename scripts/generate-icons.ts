/**
 * Icon bitmap generator (specs/001-primitive-vetting-gates, contracts/icon-data.md).
 *
 * Rasterises every pixelarticons SVG at heights 11 and 14 and writes
 * `src/primitives/iconData.ts` — the committed data module the pure lookup in
 * `src/primitives/icons.ts` reads, so drawing never touches the filesystem.
 *
 *   npm run icons:generate            # rewrite src/primitives/iconData.ts
 *   npm run icons:generate -- --check # regenerate in memory, compare, fail if stale
 */
import fs from "node:fs";
import url from "node:url";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const HEIGHTS = [11, 14] as const;

const ICON_DIR = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "pixelarticons",
  "svg",
);
const OUT_FILE = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
  "src",
  "primitives",
  "iconData.ts",
);

/** Record<string, Record<height, [width, bits]>>, written read-only as tuples. */
type IconEntry = Record<number, readonly [width: number, bits: string]>;

/** Luminance threshold, identical to the previous file-based loader. */
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Rasterise one SVG at one height into [width, row-major hex-packed bits]. */
function rasterise(svg: string, height: number): [number, string] {
  const r = new Resvg(svg, {
    fitTo: { mode: "height", value: height },
    background: "white",
    font: { loadSystemFonts: false },
  }).render();
  const { pixels, width, height: h } = r;
  let bits = "";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      bits += lum(pixels[i], pixels[i + 1], pixels[i + 2]) < 128 ? "1" : "0";
    }
  }
  // Hex-pack the row-major bit string, padded to a whole number of digits.
  let packed = "";
  for (let i = 0; i < bits.length; i += 4) packed += parseInt(bits.slice(i, i + 4).padEnd(4, "0"), 2).toString(16);
  return [width, packed];
}

/** Build the full ICON_DATA structure in memory. */
export function generateIconData(): Record<string, IconEntry> {
  const names = fs
    .readdirSync(ICON_DIR)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.slice(0, -4).toLowerCase())
    .sort();
  const out: Record<string, IconEntry> = {};
  for (const name of names) {
    const svg = fs.readFileSync(path.join(ICON_DIR, `${name}.svg`), "utf8").replace(/currentColor/g, "#000000");
    const entry: IconEntry = {};
    for (const h of HEIGHTS) entry[h] = rasterise(svg, h);
    out[name] = entry;
  }
  return out;
}

/** Serialise the data module exactly as it is committed. */
function serialise(data: Record<string, IconEntry>): string {
  const lines = [
    `/**`,
    ` * GENERATED FILE — do not edit by hand.`,
    ` * Regenerate with: npm run icons:generate`,
    ` * Source: the pixelarticons SVG set, rasterised at heights ${HEIGHTS.join(" and ")}.`,
    ` */`,
    ``,
    `export type IconBitmap = readonly [width: number, bits: string];`,
    ``,
    `export const ICON_DATA: Record<string, Record<number, readonly [width: number, bits: string]>> = {`,
  ];
  for (const [name, entry] of Object.entries(data)) {
    const parts = Object.entries(entry)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([h, [w, bits]]) => `${h}: [${w}, "${bits}"] as const`);
    lines.push(`  "${name}": { ${parts.join(", ")} },`);
  }
  lines.push(`};`, ``);
  return lines.join("\n");
}

/**
 * Freshness check: regenerate in memory and compare with the committed file.
 * True when they match; prints and returns false on a difference.
 */
export function checkIconData(): boolean {
  const fresh = serialise(generateIconData());
  const committed = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf8") : "";
  if (fresh === committed) return true;
  console.error(`  FAIL  icon data is stale — run: npm run icons:generate`);
  return false;
}

// ---- CLI (only when run directly, so verify-gates can import checkIconData) ----

const isMain = process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes("--check");
  if (check) {
    process.exit(checkIconData() ? 0 : 1);
  } else {
    fs.writeFileSync(OUT_FILE, serialise(generateIconData()));
    console.log(`wrote ${path.relative(process.cwd(), OUT_FILE)} (${Object.keys(generateIconData()).length} icons at heights ${HEIGHTS.join(" and ")})`);
  }
}
