/**
 * Font data generator (specs/002-cross-machine-frames, contracts/fonts.md).
 *
 * Turns each `.ttf` under `assets/fonts/` into a TypeScript module holding the
 * bytes as base64 under `src/fonts/`, so the library registers its fonts from
 * memory and drawing never touches the filesystem (purity rule).
 *
 *   npm run fonts:generate            # rewrite src/fonts/*.ts
 *   npm run fonts:generate -- --check # regenerate in memory, compare, fail if stale
 */
import fs from "node:fs";
import url from "node:url";
import path from "node:path";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HERE, "..", "assets", "fonts");
const OUT_DIR = path.join(HERE, "..", "src", "fonts");

/** Source file to generated module, in a fixed order. */
const MODULES: Array<[ttf: string, module: string]> = [
  ["DejaVuSansMono.ttf", "dejavuSansMono.ts"],
  ["JetBrainsMono-Regular.ttf", "jetbrainsMono.ts"],
  ["IBMPlexMono-Regular.ttf", "ibmPlexMono.ts"],
];

function serialise(ttf: string, base64: string): string {
  return [
    `/**`,
    ` * GENERATED FILE — do not edit by hand.`,
    ` * Regenerate with: npm run fonts:generate`,
    ` * Source: assets/fonts/${ttf}.`,
    ` */`,
    ``,
    `export const DATA: string =`,
    `  "${base64}";`,
    ``,
  ].join("\n");
}

/** Build every module's exact committed content in memory. */
export function generateFontData(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [ttf, module] of MODULES) {
    const bytes = fs.readFileSync(path.join(FONT_DIR, ttf));
    out[module] = serialise(ttf, bytes.toString("base64"));
  }
  return out;
}

/**
 * Freshness check: regenerate in memory and compare with the committed files.
 * True when they match; prints and returns false on a difference.
 */
export function checkFontData(): boolean {
  const fresh = generateFontData();
  for (const [module, content] of Object.entries(fresh)) {
    const file = path.join(OUT_DIR, module);
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
      console.error(`  FAIL  font data is stale — run: npm run fonts:generate`);
      return false;
    }
  }
  return true;
}

// ---- CLI (only when run directly, so gates can import checkFontData) ----

const isMain = process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--check")) {
    process.exit(checkFontData() ? 0 : 1);
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const fresh = generateFontData();
    for (const [module, content] of Object.entries(fresh)) fs.writeFileSync(path.join(OUT_DIR, module), content);
    console.log(`wrote ${path.relative(process.cwd(), OUT_DIR)} (${Object.keys(fresh).length} modules)`);
  }
}
