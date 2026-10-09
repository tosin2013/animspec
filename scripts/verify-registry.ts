/**
 * Registry consistency gate (ADR 0018 / issue #37). Proves the primitive
 * registry is the single, well-formed source of truth: every primitive is
 * complete, tiered, and renders; prompt/schema are generated from it; the
 * selector is deterministic and respects tiers; replacement and vocabulary
 * rules are enforced, each proven against a fixture that breaks it. No
 * LLM/network. Exits non-zero on failure.
 *
 * Run: npx tsx scripts/verify-registry.ts
 */
import { createCanvas } from "@napi-rs/canvas";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PRIMITIVES, sanitizeLayer, buildVocabPrompt, buildJsonSchema, VOCABULARY_VERSION, type PrimitiveDef } from "../src/primitives/registry";
import { FONTS, resolveFontFamily } from "../src/fonts/index";
import { select, selectDetailed, selectFrom, KITS, type SelectVocab } from "../src/primitives/selector";
import { validateAnimSpec } from "../src/specValidator";
import { drawSpec } from "../src/specInterpreter";
import type { SignalFrame } from "../src/types";
import { renderProbe, signalFrame } from "./lib/gateKit";
import { processorType } from "./lib/referenceSets";
import {
  formatProblem,
  replacementProblems,
  tierProblems,
  recordProblems,
  renderVocabularyDoc,
  type Problem,
  type VocabularyRecord,
} from "./lib/vocabularyRules";
import {
  SELECTION_VOCAB,
  SMALL_VOCAB,
  REPLACEMENT_BAD,
  OLD_AS_CORE,
  TIER_BAD,
  fixtureContrib,
  fixtureOld,
} from "./fixtures/tierFixtures";

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures++; }
};

/** Passes when `problems` is empty, else fails and prints each, indented. */
const checkNone = (name: string, problems: Problem[]) => {
  if (problems.length === 0) console.log(`  PASS  ${name}`);
  else {
    console.error(`  FAIL  ${name}`);
    for (const p of problems) console.error(`     ${formatProblem(p)}`);
    failures++;
  }
};

/** Passes only when at least one problem names exactly `subject`. */
const checkCaught = (name: string, problems: Problem[], subject: string) => {
  if (problems.some((p) => p.subject === subject)) console.log(`  PASS  ${name}`);
  else { console.error(`  FAIL  ${name} — rule did not catch its fixture (${subject})`); failures++; }
};

console.log(`primitive registry (${PRIMITIVES.length} primitives)`);

// ---- shared render context ------------------------------------------------
const dims = { width: 320, height: 180 };
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

// 1. Size + well-formedness + uniqueness.
check("registry has >= 20 primitives", PRIMITIVES.length >= 20, `${PRIMITIVES.length}`);
const types = new Set<string>();
let wellFormed = true;
for (const p of PRIMITIVES) {
  if (!p.type || !p.category || !p.description || !p.tier || typeof p.draw !== "function" || typeof p.params !== "object") { wellFormed = false; console.error("   malformed:", p.type); }
  if (types.has(p.type)) { wellFormed = false; console.error("   duplicate:", p.type); }
  types.add(p.type);
}
check("every primitive is well-formed + unique", wellFormed);

// 2. Prompt + schema are generated from the registry (contain every type).
const vocab = buildVocabPrompt(PRIMITIVES);
check("vocab prompt mentions every type", PRIMITIVES.every((p) => vocab.includes(p.type)));
const schema = buildJsonSchema(PRIMITIVES);
const schemaTypes = (schema.properties.layers.items.properties.type.enum as readonly string[]);
check("json schema enumerates every type", PRIMITIVES.every((p) => schemaTypes.includes(p.type)));
const schemaFontEnum = (schema.properties.font.enum as readonly string[]);
check("json schema font enum equals the keys of FONTS", JSON.stringify([...schemaFontEnum].sort()) === JSON.stringify(Object.keys(FONTS).sort()));
check("json schema does not list vocabulary", !("vocabulary" in schema.properties));

// Vocabulary never changes what is drawn.
const hashSpec = (spec: Record<string, unknown>): string => {
  const canvas = createCanvas(dims.width, dims.height);
  const ctx = canvas.getContext("2d");
  drawSpec(ctx, dims, frame, spec as never, { reducedFlicker: true, creative: false, seed: 12345 });
  return crypto.createHash("sha256").update(ctx.getImageData(0, 0, dims.width, dims.height).data).digest("hex");
};
const baseSpec = validateAnimSpec({ layers: [{ type: "grid" }, { type: "wave" }, { type: "caption" }] }).spec as unknown as Record<string, unknown>;
const specNoVocab = { ...baseSpec } as Record<string, unknown>;
delete specNoVocab.vocabulary;
const spec999 = validateAnimSpec({ vocabulary: 999, layers: [{ type: "grid" }, { type: "wave" }, { type: "caption" }] }).spec as unknown as Record<string, unknown>;
check("vocabulary does not change what is drawn", hashSpec(baseSpec) === hashSpec(specNoVocab) && hashSpec(baseSpec) === hashSpec(spec999));

// 3. Selector: deterministic, tier-respecting, and honors kits.
const BREADTHS = [0, 0.25, 0.5, 0.75, 1];

function selectionViolation(vocab: SelectVocab, kitName: string | undefined, named: string[]): string | null {
  const kitList = kitName && kitName !== "auto" ? vocab.kits[kitName] : undefined;
  for (let seed = 0; seed < 200; seed++) {
    for (const b of BREADTHS) {
      const { primitives } = selectFrom(vocab, kitName, b, seed, named);
      for (const p of primitives) {
        if (!kitList) {
          if (p.tier !== "core") return `${p.type} (${p.tier}) kit=<none> breadth=${b} seed=${seed}`;
        } else if (!(p.tier === "core" || (p.tier === "extended" && kitList.includes(p.type)))) {
          return `${p.type} (${p.tier}) kit=${kitName} breadth=${b} seed=${seed}`;
        }
      }
      if (!primitives.some((p) => p.type === "caption")) return `no caption kit=${kitName} breadth=${b} seed=${seed}`;
    }
  }
  return null;
}

const noKitBad = selectionViolation({ primitives: PRIMITIVES, kits: KITS }, undefined, []);
check("1000 selections with no kit: core only", noKitBad === null, noKitBad ?? "");
let perKitBad: string | null = null;
for (const k of Object.keys(KITS)) {
  const bad = selectionViolation({ primitives: PRIMITIVES, kits: KITS }, k, []);
  if (bad) { perKitBad = `${k}: ${bad}`; break; }
}
check(`1000 selections per kit (${Object.keys(KITS).length} kits): tiers respected`, perKitBad === null, perKitBad ?? "");

// The same tier checks over the fixture vocabulary (contrib + legacy present).
const selNoKitBad = selectionViolation(SELECTION_VOCAB, undefined, []);
check("fixture vocab: 1000 selections with no kit: core only", selNoKitBad === null, selNoKitBad ?? "");
let selPerKitBad: string | null = null;
for (const k of Object.keys(SELECTION_VOCAB.kits)) {
  const bad = selectionViolation(SELECTION_VOCAB, k, []);
  if (bad) { selPerKitBad = `${k}: ${bad}`; break; }
}
check("fixture vocab: 1000 selections per kit: tiers respected", selPerKitBad === null, selPerKitBad ?? "");

// Determinism, with named primitives.
const d1 = selectDetailed("data-viz", 0.5, 7, ["grid"]).primitives.map((p) => p.type).join(",");
const d2 = selectDetailed("data-viz", 0.5, 7, ["grid"]).primitives.map((p) => p.type).join(",");
check("selector is deterministic (same inputs = same subset)", d1 === d2);

// Named primitives (fixture vocabulary).
check(
  "naming fixture-contrib adds it",
  selectFrom(SELECTION_VOCAB, undefined, 0.5, 7, ["fixture-contrib"]).primitives.some((p) => p.type === "fixture-contrib"),
);
check(
  "naming fixture-old refuses it (legacy)",
  selectFrom(SELECTION_VOCAB, undefined, 0.5, 7, ["fixture-old"]).refused.some((r) => r.type === "fixture-old" && r.reason === "legacy; replaced by fixture-new"),
);
check(
  "naming fixture-extended with its kit keeps it",
  selectFrom(SELECTION_VOCAB, "fixture-kit", 0.5, 7, ["fixture-extended"]).primitives.some((p) => p.type === "fixture-extended"),
);
check(
  "naming fixture-extended without its kit refuses it",
  selectFrom(SELECTION_VOCAB, undefined, 0.5, 7, ["fixture-extended"]).refused.some((r) => r.type === "fixture-extended" && r.reason === "extended; offered only through its kit"),
);
const baseSel = selectFrom(SELECTION_VOCAB, undefined, 0.5, 7, []).primitives.map((p) => p.type);
const nopeSel = selectFrom(SELECTION_VOCAB, undefined, 0.5, 7, ["nope"]);
check("naming an unknown primitive refuses it", nopeSel.refused.some((r) => r.type === "nope" && r.reason === "not a primitive"));
check("a refused name leaves the rest of the selection unchanged", JSON.stringify(nopeSel.primitives.map((p) => p.type)) === JSON.stringify(baseSel));

// Prompt + schema describe exactly the selection, for one selection per kit.
let promptSchemaOk = true;
for (const k of Object.keys(KITS)) {
  const sel = select(k, 0.5, 7);
  if (buildVocabPrompt(sel).split("\n").filter(Boolean).length !== sel.length) { promptSchemaOk = false; break; }
  const en = buildJsonSchema(sel).properties.layers.items.properties.type.enum as readonly string[];
  if (JSON.stringify(en) !== JSON.stringify(sel.map((p) => p.type))) { promptSchemaOk = false; break; }
}
check("prompt and schema describe exactly the selection", promptSchemaOk);

// A small vocabulary is never filled from another tier.
const smallTypes = ["bars", "caption", "grid", "text", "wave"].join(",");
let smallOk = true;
for (let seed = 0; seed < 200; seed++) {
  const selTypes = selectFrom(SMALL_VOCAB, undefined, 1, seed, []).primitives.map((p) => p.type).sort().join(",");
  if (selTypes !== smallTypes) { smallOk = false; break; }
}
check("small vocab is never filled from another tier", smallOk);

// The unkitted selection stays in the ~15-20 band.
check("auto subset is ~15-20", (() => { const n = select("auto", 0.5, 0).length; return n >= 12 && n <= 22; })());

// 4. Validator (registry sanitize): unknown dropped, known clamped.
check("sanitizeLayer drops unknown types", sanitizeLayer({ type: "nope" }) === null);
const g = sanitizeLayer({ type: "grid", cols: 999999 }) as { cols: number };
check("sanitizeLayer clamps params", g !== null && g.cols <= 200);

// 5. Every primitive renders without throwing.
const canvas = createCanvas(dims.width, dims.height);
const ctx = canvas.getContext("2d");
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

// 6. Tiers: exactly one valid tier, kits honest, every extended listed.
checkNone("every primitive has a valid tier and kits offer only what tiers allow", tierProblems(PRIMITIVES, KITS));
checkNone("fixture vocab has no tier problems", tierProblems(SELECTION_VOCAB.primitives, SELECTION_VOCAB.kits));
for (const f of TIER_BAD) {
  checkCaught(`tier rule catches "${f.name}"`, tierProblems(f.primitives, f.kits), f.subject);
}
const coreCount = PRIMITIVES.filter((p) => p.tier === "core").length;
const extCount = PRIMITIVES.filter((p) => p.tier === "extended").length;
const contribCount = PRIMITIVES.filter((p) => p.tier === "contrib").length;
const legacyCount = PRIMITIVES.filter((p) => p.tier === "legacy").length;
check(
  `29 primitives: ${coreCount} core, ${extCount} extended, ${contribCount} contrib, ${legacyCount} legacy`,
  coreCount === 24 && extCount === 5 && contribCount === 0 && legacyCount === 0,
);

// 7. Replacement: legacy names a replacement and renders identically.
checkNone("no replacement problems in the registry", replacementProblems(PRIMITIVES));
checkNone("no replacement problems in the fixture vocab", replacementProblems(SELECTION_VOCAB.primitives));
for (const f of REPLACEMENT_BAD) {
  checkCaught(`replacement rule catches "${f.name}"`, replacementProblems(f.primitives), f.subject);
}
let replRenders = true;
for (const level of [0, 0.5, 1]) {
  const fr = signalFrame(12, level, "TEST LABEL");
  const a = renderProbe(OLD_AS_CORE, { type: "fixture-old" }, { dims, frame: fr, palette, seed: 12345 });
  const b = renderProbe(fixtureOld, { type: "fixture-old" }, { dims, frame: fr, palette, seed: 12345 });
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) { replRenders = false; break; }
}
check("replaced fixture renders identically as core and as legacy", replRenders);
check("fixture-old reports legacy + replacedBy", fixtureOld.tier === "legacy" && fixtureOld.replacedBy === "fixture-new");

// 8. Any tier renders, and the validator/interpreter never read tiers.
let anyTierRenders = true;
for (const def of [fixtureContrib, fixtureOld]) {
  try {
    renderProbe(def, { type: def.type }, { dims, frame, palette, seed: 12345 });
  } catch {
    anyTierRenders = false;
  }
}
check("contrib and legacy fixtures render without throwing", anyTierRenders);
const readsTier = (p: string) => /\btier\b/.test(fs.readFileSync(path.join(p), "utf8"));
check("validator does not read tiers", !readsTier("src/specValidator.ts"), "src/specValidator.ts");
check("interpreter does not read tiers", !readsTier("src/specInterpreter.ts"), "src/specInterpreter.ts");

// 9. Reference cases exist for every primitive of every tier.
const machineType = processorType();
if (machineType) {
  const goldenKeys = Object.keys(JSON.parse(fs.readFileSync(path.join("golden", machineType, "hashes.json"), "utf8")));
  let everyTierCovered = true;
  for (const p of PRIMITIVES) {
    for (const lvl of ["quiet", "mid", "loud"]) {
      if (!goldenKeys.includes(`${p.type}@${lvl}`)) { everyTierCovered = false; break; }
    }
    if (!everyTierCovered) break;
  }
  check("every primitive of every tier has reference cases", everyTierCovered);
}

// 10. Vocabulary record matches the registry, and VOCABULARY.md is fresh.
const recordPath = path.join("golden", "vocabulary.json");
const record: VocabularyRecord | null = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, "utf8")) : null;
checkNone(`vocabulary matches the record for version ${VOCABULARY_VERSION}`, recordProblems(record, VOCABULARY_VERSION, PRIMITIVES));
if (record) {
  const docPath = path.join("VOCABULARY.md");
  const committed = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
  check("VOCABULARY.md is up to date", committed === renderVocabularyDoc(record, PRIMITIVES), "run npm run vocab:record");

  // Record fixtures, built in memory from the real record.
  const wave = PRIMITIVES.find((p) => p.type === "wave")!;
  const waveChanged = PRIMITIVES.map((p) => (p.type === "wave" ? { ...p, params: { ...p.params, extra: { type: "boolean" as const, default: false } } } : p));
  checkCaught("record: a changed primitive without a version rise is caught", recordProblems(record, VOCABULARY_VERSION, waveChanged), "wave");
  checkCaught("record: a raised version without a record is caught", recordProblems(record, VOCABULARY_VERSION + 1, PRIMITIVES), "golden/vocabulary.json");
  const badNumbering: VocabularyRecord = {
    versions: [record.versions[0], { version: 3, hash: "stub", summary: "stub" }],
    current: { version: 3, primitives: record.current.primitives },
  };
  check("record: non-sequential version numbers are caught", recordProblems(badNumbering, VOCABULARY_VERSION, PRIMITIVES).some((pr) => pr.subject === "golden/vocabulary.json" && pr.message.startsWith("versions are not numbered")));
  const alteredCurrent: VocabularyRecord = { ...record, current: { ...record.current, primitives: record.current.primitives.map((p) => (p.type === "wave" ? { ...p, params: {} } : p)) } };
  checkCaught("record: a current snapshot altered without its hash is caught", recordProblems(alteredCurrent, VOCABULARY_VERSION, PRIMITIVES), "golden/vocabulary.json");
}

if (failures > 0) {
  console.error(`\nregistry gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nregistry gate passed");
