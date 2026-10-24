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
import { PRIMITIVES, PRIMITIVE_ROLES, sanitizeLayer, sanitizeBind, buildVocabPrompt, buildJsonSchema, VOCABULARY_VERSION, getPrimitive, externalPrimitives, paramSpecProblems, type PrimitiveDef } from "../src/primitives/registry";
import { registerPlugin, registeredPlugins } from "../src/plugins";
import { isSpdxExpression } from "../src/spdx";
import { checkSpdxData } from "./generate-spdx";
import { GOOD } from "./fixtures/plugins/index";
import { FONTS, resolveFontFamily } from "../src/fonts/index";
import { select, selectDetailed, selectFrom, KITS, type SelectVocab } from "../src/primitives/selector";
import { validateAnimSpec } from "../src/specValidator";
import { drawSpec } from "../src/specInterpreter";
import type { SignalFrame } from "../src/types";
import { renderProbe, signalFrame } from "./lib/gateKit";
import { processorType, decodeFrame, comparePixels } from "./lib/referenceSets";
import { renderThumbnail } from "./lib/thumbnails";
import { SHOWCASE, preloadShowcaseAssets, renderShowcase, showcaseFile } from "./lib/showcase";
import {
  formatProblem,
  replacementProblems,
  characterProblems,
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
import { BAD_CHARACTERS } from "./fixtures/badCharacters";
import { CHARACTERS, declaredRoles } from "../src/primitives/sprites";

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
// The builders have no full-vocabulary default (spec 004); called without a
// selection they must fail with a message that says what to pass (issue #112).
const throwsSelectionMessage = (fn: () => unknown, name: string) => {
  try { fn(); return false; } catch (e) { return e instanceof TypeError && e.message.startsWith(`${name}(selection) needs a selection`); }
};
check("buildJsonSchema() without a selection throws a clear message", throwsSelectionMessage(() => (buildJsonSchema as (s?: unknown) => unknown)(), "buildJsonSchema"));
check("buildVocabPrompt() without a selection throws a clear message", throwsSelectionMessage(() => (buildVocabPrompt as (s?: unknown) => unknown)(), "buildVocabPrompt"));
// Every bind source the validator accepts is named in its error message, so a
// rejected binding tells the author all the choices (viseme and beat were
// missing from the message until 0.4.0).
{
  const grid = PRIMITIVES.find((p) => p.type === "grid")!;
  const sources: Array<[string, string]> = [["amplitude", "amplitude"], ["energy", "energy"], ["band:3", "band:<n>"], ["osc", "osc"], ["viseme", "viseme"], ["beat", "beat"]];
  const message = sanitizeBind(grid, { cols: { from: "nope" } }).error ?? "";
  const binding = (from: string) => (from === "osc" ? { from, period: 2 } : { from });
  const unnamed = sources.filter(([from, name]) => !sanitizeBind(grid, { cols: binding(from) }).bind || !message.includes(name)).map(([, name]) => name);
  check("every accepted bind source is named in the unknown-source message", unnamed.length === 0, unnamed.join(", "));
}
check("json schema does not list vocabulary", !("vocabulary" in schema.properties));
// Palette roles (spec 020): the schema describes the roles map, every role a
// character declares is a name the schema accepts, and the prompt names them.
check("json schema describes roles", "roles" in schema.properties);
const roleNamePattern = new RegExp(schema.properties.roles.propertyNames.pattern);
const allRoles = [...declaredRoles(), ...PRIMITIVE_ROLES];
check("every declared role name fits the schema's role-name pattern", allRoles.every((r) => roleNamePattern.test(r)), allRoles.filter((r) => !roleNamePattern.test(r)).join(", "));
check("vocab prompt names hero and its roles", vocab.includes("hero") && declaredRoles().every((r) => vocab.includes(r)));

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
// The exact-composition snapshot that spec 003 T025 added (`29 primitives: 24 core,
// 5 extended, 0 contrib, 0 legacy`) is removed: it pinned the tier counts, so it
// blocked the first intentional composition change — adding a `contrib` primitive
// is impossible with it in place — and spec 003's own task note said it "is removed
// by whoever first changes a tier on purpose". The vocabulary record (recordProblems)
// already requires a VOCABULARY_VERSION bump for any vocabulary change, so the
// composition stays enforced without the hard number.
// 7. Replacement: legacy names a replacement and renders identically.
checkNone("no replacement problems in the registry", replacementProblems(PRIMITIVES));
checkNone("no replacement problems in the fixture vocab", replacementProblems(SELECTION_VOCAB.primitives));
for (const f of REPLACEMENT_BAD) {
  checkCaught(`replacement rule catches "${f.name}"`, replacementProblems(f.primitives), f.subject);
}
// Characters (spec 020): sizes consistent; v2 letters declared and bounded.
checkNone("characters are well-formed", characterProblems(CHARACTERS));
for (const f of BAD_CHARACTERS) {
  checkCaught(`character rule catches "${f.name}"`, characterProblems(f.chars), f.subject);
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

// 9b. The pattern grammar stays in the prompt models see (spec 018): the
// prompt lists param names only, so the descriptions carry the letters.
{
  const prompt = buildVocabPrompt(PRIMITIVES.filter((p) => p.type === "grid" || p.type === "checker"));
  check("the prompt carries the grid pattern grammar", ["pattern", "breaks", "# fg", "~ spectrum"].every((t) => prompt.includes(t)) && prompt.split("\n").length === 2);
}

// 10. Gallery: one thumbnail per primitive.
const galleryOk = PRIMITIVES.every((p) => fs.existsSync(path.join("gallery", `${p.type}.png`)));
check("gallery has a thumbnail for every primitive", galleryOk);
// Each committed thumbnail is still what the library draws. Stale means more
// than 1% of pixels differ by more than 8/255 (Principle I's per-channel step,
// measured by comparePixels). A stale file differs almost everywhere; rounding
// between processor types touches a few edge pixels, so either type may have
// generated the committed files. This is a freshness check, not the cross-type
// gate: that lives in verify-determinism over the reference cases. The check is
// proven to bite: a thumbnail compared with another primitive's file fails.
const STEP = 8;
const STALE_SHARE = 0.01;
const staleShare = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
  let off = 0;
  for (let i = 0; i < a.length; i += 4) if (comparePixels(a.subarray(i, i + 4), b.subarray(i, i + 4)).maxDelta > STEP) off++;
  return off / (a.length / 4);
};
if (galleryOk) {
  const stale: string[] = [];
  for (const p of PRIMITIVES) {
    const rgba = renderThumbnail(p.type);
    if (!rgba) continue;
    const { rgba: committed } = await decodeFrame(fs.readFileSync(path.join("gallery", `${p.type}.png`)));
    const share = staleShare(rgba, committed);
    if (share > STALE_SHARE) stale.push(`${p.type} (${(share * 100).toFixed(1)}% of pixels)`);
  }
  check("every gallery thumbnail is fresh", stale.length === 0, `stale: ${stale.join(", ")} — run npm run gallery:generate && npm run site:generate`);
  const wrong = await decodeFrame(fs.readFileSync(path.join("gallery", "dots.png")));
  check("the freshness check rejects a stale thumbnail (fixture)", staleShare(renderThumbnail("grid")!, wrong.rgba) > STALE_SHARE);
}

// 10b. Showcase: every case validates cleanly and has its file; each still is
// fresh by the same rule. (Loops are GIFs, quantised by the
// encoder, so only their presence is checked, as for the gallery loops.)
{
  const missing = SHOWCASE.filter((c) => !fs.existsSync(path.join("showcase", showcaseFile(c)))).map((c) => c.name);
  check("showcase has a file for every case", missing.length === 0, `missing: ${missing.join(", ")} — run npm run showcase:generate`);
  const stale: string[] = [];
  await preloadShowcaseAssets(); // spec 022: decode showcase image assets first
  for (const c of SHOWCASE) {
    const frames = renderShowcase(c);
    if (c.kind !== "still" || missing.includes(c.name)) continue;
    const { rgba } = await decodeFrame(fs.readFileSync(path.join("showcase", showcaseFile(c))));
    const share = staleShare(frames[0], rgba);
    if (share > STALE_SHARE) stale.push(`${c.name} (${(share * 100).toFixed(1)}% of pixels)`);
  }
  check("every showcase still is fresh", stale.length === 0, `stale: ${stale.join(", ")} — run npm run showcase:generate && npm run site:generate`);
}

// 11. Vocabulary record matches the registry, and VOCABULARY.md is fresh.
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

// Plugin slot (spec 024): core is well-formed by the shared rule; plugins
// register namespaced and external; registration refuses bad input; models
// never see externals unless named; SPDX licences and data.
{
  const coreBad = PRIMITIVES.flatMap((p) => paramSpecProblems(p).map((m) => `${p.type}: ${m}`));
  check("every core primitive passes the shared param rules", coreBad.length === 0, coreBad.join("; "));
  check("SPDX data is up to date", checkSpdxData());
  const spdxOk = ["MIT", "Apache-2.0", "MIT OR Apache-2.0", "GPL-2.0-or-later WITH Classpath-exception-2.0", "(MIT AND BSD-3-Clause)", "LicenseRef-acme-1"];
  const spdxBad = ["Apache 2", "MIT OR", "Foo-1.0", ""];
  check("SPDX expressions are recognised", spdxOk.every(isSpdxExpression) && !spdxBad.some(isSpdxExpression), [...spdxOk.filter((x) => !isSpdxExpression(x)), ...spdxBad.filter(isSpdxExpression)].join(", "));
  registerPlugin(GOOD);
  registerPlugin(GOOD); // same version: a no-op
  const ext = getPrimitive("ext:good/starfield");
  check("a registered plugin primitive is namespaced and external", !!ext && ext.tier === "external" && registeredPlugins().some((r) => r.id === "good" && r.version === "1.0.0"));
  const throws = (fn: () => void, needle: string) => { try { fn(); return false; } catch (e) { return String((e as Error).message).includes(needle); } };
  check("registration refuses a second version of a plugin", throws(() => registerPlugin({ ...GOOD, version: "2.0.0" }), "already registered at version 1.0.0"));
  check("registration refuses a bad id", throws(() => registerPlugin({ ...GOOD, id: "Bad Id" }), "plugin id must be"));
  check("registration refuses a licence that is not SPDX", throws(() => registerPlugin({ ...GOOD, id: "lic", licence: "Apache 2" }), "valid SPDX license expression"));
  check("registration refuses malformed params", throws(() => registerPlugin({ ...GOOD, id: "badparam", primitives: [{ ...GOOD.primitives[0], params: { n: { type: "number", min: 5, max: 1, default: 3 } } }] }), "min ≤ default ≤ max"));
  registerPlugin({ ...GOOD, id: "shadow", primitives: [{ ...GOOD.primitives[0], type: "grid" }] });
  check("a plugin type named like a core type cannot shadow it", getPrimitive("grid") === PRIMITIVES.find((p) => p.type === "grid") && getPrimitive("ext:shadow/grid")?.tier === "external");
  let offered = 0;
  for (let i = 0; i < 1000; i++) {
    const kit = [undefined, ...Object.keys(KITS)][i % (Object.keys(KITS).length + 1)];
    offered += select(kit, (i % 10) / 9, i).filter((p) => p.type.startsWith("ext:")).length;
  }
  check("1000 selections with plugins registered offer no external primitive", offered === 0, `${offered}`);
  const named = buildVocabPrompt([...select(undefined, 0.3, 1), ...externalPrimitives()]);
  check("a prompt that names externals labels them", named.includes("ext:good/starfield") && named.includes("[external]") && !buildVocabPrompt(select(undefined, 0.3, 1)).includes("[external]"));
}

if (failures > 0) {
  console.error(`\nregistry gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nregistry gate passed");
