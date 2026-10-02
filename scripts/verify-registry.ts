/**
 * Registry consistency gate (ADR 0018 / issue #37). Proves the primitive
 * registry is the single, well-formed source of truth: every primitive is
 * complete and renders; prompt/schema are generated from it; the selector is
 * deterministic. No LLM/network. Exits non-zero on failure.
 *
 * Run: npx tsx scripts/verify-registry.ts
 */
import { createCanvas } from "@napi-rs/canvas";
import { PRIMITIVES, sanitizeLayer, buildVocabPrompt, buildJsonSchema } from "../src/primitives/registry";
import { FONTS, resolveFontFamily } from "../src/fonts/index";
import { select } from "../src/primitives/selector";
import type { SignalFrame } from "../src/types";

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures++; };
};

console.log(`primitive registry (${PRIMITIVES.length} primitives)`);

// 1. Size + well-formedness + uniqueness.
check("registry has >= 20 primitives", PRIMITIVES.length >= 20, `${PRIMITIVES.length}`);
const types = new Set<string>();
let wellFormed = true;
for (const p of PRIMITIVES) {
  if (!p.type || !p.category || !p.description || typeof p.draw !== "function" || typeof p.params !== "object") { wellFormed = false; console.error("   malformed:", p.type); }
  if (types.has(p.type)) { wellFormed = false; console.error("   duplicate:", p.type); }
  types.add(p.type);
}
check("every primitive is well-formed + unique", wellFormed);

// 2. Prompt + schema are generated from the registry (contain every type).
const vocab = buildVocabPrompt(PRIMITIVES);
check("vocab prompt mentions every type", PRIMITIVES.every((p) => vocab.includes(p.type)));
const schemaTypes = (buildJsonSchema(PRIMITIVES).properties.layers.items.properties.type.enum as readonly string[]);
check("json schema enumerates every type", PRIMITIVES.every((p) => schemaTypes.includes(p.type)));
const schemaFontEnum = (buildJsonSchema(PRIMITIVES).properties.font.enum as readonly string[]);
check("json schema font enum equals the keys of FONTS", JSON.stringify([...schemaFontEnum].sort()) === JSON.stringify(Object.keys(FONTS).sort()));

// 3. Selector is deterministic and honors kits.
const a = select("auto", 0.3, 0).map((p) => p.type).join(",");
const b = select("auto", 0.3, 0).map((p) => p.type).join(",");
check("selector is deterministic (same inputs = same subset)", a === b);
const dataviz = select("data-viz", 0, 0).map((p) => p.type);
check("kit selection includes its kit + caption", dataviz.includes("grid") && dataviz.includes("caption"));
check("auto subset is ~15-20", (() => { const n = select("auto", 0.5, 0).length; return n >= 12 && n <= 22; })());

// 4. Validator (registry sanitize): unknown dropped, known clamped.
check("sanitizeLayer drops unknown types", sanitizeLayer({ type: "nope" }) === null);
const g = sanitizeLayer({ type: "grid", cols: 999999 }) as any;
check("sanitizeLayer clamps params", g !== null && g.cols <= 200);

// 5. Every primitive renders without throwing.
const dims = { width: 320, height: 180 };
const canvas = createCanvas(dims.width, dims.height);
const ctx = canvas.getContext("2d");
const frame: SignalFrame = {
  index: 12,
  t: 0.4,
  values: Float64Array.from({ length: 256 }, (_, i) => (Math.sin(i / 5) + 1) / 2),
  spectrum: Float64Array.from({ length: 256 }, (_, i) => Math.max(0, 1 - i / 256)),
  amplitude: 0.5,
  energy: 0.4,
  labels: ["TEST LABEL"],
};
const palette = { bg: "black", fg: "white", accent: "#ff2d2d" };
const dctx = { reducedFlicker: true, seed: 12345, text: "TEST LABEL", font: resolveFontFamily() };
let allDraw = true;
for (const p of PRIMITIVES) {
  try {
    ctx.fillStyle = "black"; ctx.fillRect(0, 0, dims.width, dims.height);
    p.draw(ctx, dims, frame, { type: p.type }, palette, dctx);
  } catch (e) {
    allDraw = false;
    console.error(`   ${p.type} threw:`, e instanceof Error ? e.message : e);
  }
}
check("every primitive renders without throwing", allDraw);

if (failures > 0) {
  console.error(`\nregistry gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nregistry gate passed");
