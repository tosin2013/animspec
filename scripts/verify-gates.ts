/**
 * Primitive vetting gates (specs/001-primitive-vetting-gates). Offline, exits non-zero
 * on failure. Runs each registered gate over every primitive's probe layers, plus a
 * fixture self-test that proves each gate really rejects a rule-breaking primitive.
 *
 * Output format per contracts/gates.md: header, freshness + fixture lines, failing
 * lines, one tally per gate, then the summary.
 *
 *   npm run verify:gates
 */
import { PRIMITIVES, sanitizeLayer, type PrimitiveDef } from "../src/primitives/registry";
import { BAD_PRIMITIVES } from "./fixtures/badPrimitives";
import {
  type GateName,
  type GateResult,
  GOLDEN_LABEL,
  V,
  measureCompositionBudget,
  rgbOf,
  renderProbe,
  signalFrame,
  totalProbes,
} from "./lib/gateKit";
import type { CheckedPrimitive } from "../verify/core";
import { GOOD, RANDOM, OFFPALETTE, FILEREAD, HEAVY } from "./fixtures/plugins/index";
import { checkIconData } from "./generate-icons";
import { COMPOSITE_SPECS, goldenFrames } from "./lib/goldenHashes";
import { validateAnimSpec } from "../src/specValidator";
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec, type AnimSpec } from "../src/specInterpreter";

/** A gate takes the primitive definitions and returns one or more results per primitive. */
type GateFn = (defs: PrimitiveDef[]) => GateResult[];

// ---- the gates (checks in verify/core.ts, shared with the plugin verifier) ----

const PALETTE_MONO_BLACK = { bg: "black", fg: "white", accent: "white" };
const PROBE_DIMS = { width: 320, height: 180 };
const asChecked = (def: PrimitiveDef) => def as unknown as CheckedPrimitive;

/**
 * The four explicit icon layers from T011, used for the working-directory check
 * (FR-007). Keys are the primitive types with icon params.
 */
const ICON_CWD_LAYERS: Record<string, Array<Record<string, unknown>>> = {
  led: [
    { type: "led", icon: "heart", scroll: false, effect: "static", reactive: false },
    { type: "led", icon: "zz-unknown", scroll: false, effect: "static", reactive: false },
  ],
  sprite: [
    { type: "sprite", character: "none", icon: "heart", motion: "static", reactive: false },
    { type: "sprite", character: "none", icon: "zz-unknown", motion: "static", reactive: false },
  ],
};

/** Measurements of the real registry from the last budget run, for the info lines. */
const budgetReport = new Map<string, { operations: number; milliseconds: number }>();
const registryTypes = new Set(PRIMITIVES.map((p) => p.type));

const runPurityGate: GateFn = (defs) => defs.map((def) => V.checkPurity(asChecked(def), ICON_CWD_LAYERS[def.type]));
const runPaletteGate: GateFn = (defs) => defs.map((def) => V.checkPalette(asChecked(def)));
const runReactivityGate: GateFn = (defs) => defs.map((def) => V.checkReactivity(asChecked(def)));
const runBudgetGate: GateFn = (defs) => defs.map((def) => V.checkBudget(asChecked(def), (m) => { if (registryTypes.has(def.type)) budgetReport.set(def.type, m); }));

// ---- registered gates ------------------------------------------------------

const GATES: Partial<Record<GateName, GateFn>> = {
  purity: runPurityGate,
  palette: runPaletteGate,
  reactivity: runReactivityGate,
  budget: runBudgetGate,
};

// ---- pre-flight checks (not gate tallies; failures fail the whole run) -----

const preFlightFails: string[] = [];

console.log(`vetting gates (${PRIMITIVES.length} primitives, ${totalProbes()} probes)`);

// Icon-data freshness (contracts/icon-data.md): its own check, not a gate.
// checkIconData() prints its own FAIL line when stale.
if (checkIconData()) console.log("  ok    icon data is up to date");
else preFlightFails.push("icon data is stale");

/**
 * Run every registered gate over the BAD_PRIMITIVES entries for that gate. A gate
 * may have more than one fixture. A fixture passing its own gate means the gate is
 * blind, which fails the whole run.
 */
function fixtureSelfTest(): { rejected: number; total: number; blind: string[] } {
  const entries = BAD_PRIMITIVES.filter((f) => GATES[f.gate]);
  let rejected = 0;
  const blind: string[] = [];
  for (const entry of entries) {
    const results = GATES[entry.gate]!([entry.def]);
    if (results.some((r) => !r.pass)) rejected++;
    else blind.push(`${entry.gate}|${entry.def.type}`);
  }
  return { rejected, total: entries.length, blind };
}

const fixture = fixtureSelfTest();
if (fixture.blind.length > 0) {
  for (const b of fixture.blind) {
    const [gate, type] = b.split("|");
    console.error(`  FAIL  fixtures: ${gate} did not reject ${type}`);
    preFlightFails.push(`${gate} did not reject ${type}`);
  }
} else {
  console.log(`  ok    fixtures: each gate rejects its rule-breaking fixtures (${fixture.rejected}/${fixture.total})`);
}

// grid's solid mode (issue #98): every pixel is exactly bg, fg or accent, with
// no anti-aliased or translucent mix. The default translucent grid must fail
// the same test, which proves the check can see a mix.
function offPaletteExact(layer: Record<string, unknown>, palette: { bg: string; fg: string; accent: string }): number {
  const grid = PRIMITIVES.find((p) => p.type === "grid")!;
  const allowed = new Set([palette.bg, palette.fg, palette.accent].map((c) => rgbOf(c).join(",")));
  let off = 0;
  for (const level of [0.5, 1]) {
    const rgba = renderProbe(grid, sanitizeLayer(layer)!, { dims: PROBE_DIMS, frame: signalFrame(12, level, GOLDEN_LABEL), palette });
    for (let i = 0; i < rgba.length; i += 4) if (!allowed.has(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`)) off++;
  }
  return off;
}
{
  const palettes = [PALETTE_MONO_BLACK, { bg: "white", fg: "black", accent: "black" }, { bg: "black", fg: "white", accent: "#ff2d2d" }];
  const solidOff = palettes.reduce((n, pal) => n + offPaletteExact({ type: "grid", solid: true }, pal), 0);
  const defaultOff = offPaletteExact({ type: "grid" }, PALETTE_MONO_BLACK);
  if (solidOff === 0 && defaultOff > 0) console.log("  ok    grid solid: every pixel is exactly bg, fg or accent");
  else {
    const why = solidOff > 0 ? `${solidOff} mixed pixel(s) in solid mode` : "the check did not see the default grid's translucent mix";
    console.error(`  FAIL  grid solid: ${why}`);
    preFlightFails.push(`grid solid: ${why}`);
  }
}

// Transparent background (spec 017): for every primitive and both inks, the
// transparent frame laid over its source background gives back the solid
// render, within 1 per channel (FR-007, FR-009, SC-002).
{
  const render = (spec: AnimSpec, level: number): Uint8ClampedArray => {
    const ctx = createCanvas(PROBE_DIMS.width, PROBE_DIMS.height).getContext("2d");
    drawSpec(ctx, PROBE_DIMS, signalFrame(12, level, GOLDEN_LABEL), spec, { reducedFlicker: true, creative: false, seed: 12345 });
    return ctx.getImageData(0, 0, PROBE_DIMS.width, PROBE_DIMS.height).data;
  };
  const failing: string[] = [];
  for (const def of PRIMITIVES) {
    const layer = sanitizeLayer({ type: def.type });
    if (!layer) continue;
    for (const ink of ["light", "dark"] as const) {
      const under = ink === "light" ? 0 : 255;
      let worst = 0;
      for (const level of [0.02, 0.5, 0.95]) {
        const solid = render({ background: ink === "light" ? "black" : "white", layers: [layer] } as AnimSpec, level);
        const clear = render({ background: "transparent", ink, layers: [layer] } as AnimSpec, level);
        for (let i = 0; i < solid.length; i += 4) {
          const a = clear[i + 3] / 255;
          for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(clear[i + k] * a + under * (1 - a) - solid[i + k]));
        }
      }
      if (worst > 1) failing.push(`${def.type} (${ink} ink, off by ${worst.toFixed(1)})`);
    }
  }
  if (failing.length === 0) console.log(`  ok    transparency: ${PRIMITIVES.length}/${PRIMITIVES.length} primitives match their solid render over the matching background (light, dark)`);
  else {
    for (const f of failing) console.error(`  FAIL  transparency: ${f}`);
    preFlightFails.push(...failing.map((f) => `transparency: ${f}`));
  }
}

// Plugin verifier (spec 024): the same checks, on plugins. The good fixture
// passes all five; each faulty fixture fails exactly the check it targets.
{
  const expect: Array<[string, typeof GOOD, string | null]> = [["good", GOOD, null], ["random", RANDOM, "determinism"], ["offpalette", OFFPALETTE, "palette"], ["fileread", FILEREAD, "purity"], ["heavy", HEAVY, "budget"]];
  for (const [name, plugin, failing] of expect) {
    const r = V.verifyPlugin(plugin as never);
    const failed = r.primitives.flatMap((p) => p.checks.filter((c) => !c.pass).map((c) => c.name));
    const ok = failing === null ? r.ok && failed.length === 0 : failed.length === 1 && failed[0] === failing;
    if (ok) console.log(`  ok    plugin verifier: ${name} ${failing === null ? "passes every check" : `fails only ${failing}`}`);
    else { console.error(`  FAIL  plugin verifier: ${name} failed [${failed.join(", ")}], expected ${failing ?? "none"}`); preFlightFails.push(`plugin verifier: ${name}`); }
  }
}

// ---- gates over the real registry -----------------------------------------

const failures: GateResult[] = [];

for (const [gate, run] of Object.entries(GATES) as [GateName, GateFn][]) {
  const results = run(PRIMITIVES);
  const passed = results.filter((r) => r.pass).length;
  for (const r of results) if (!r.pass) {
    failures.push(r);
    console.error(`  FAIL  ${r.gate.padEnd(10)}  ${r.primitive}  ${r.measured} (allowed ${r.allowed}) — ${r.case}`);
  }
  console.log(`  ${passed === results.length ? "ok  " : "FAIL"}  ${gate.padEnd(10)}  ${passed}/${results.length}`);
}

// Time (and operation count) for every primitive, on every run, pass or fail.
if (budgetReport.size > 0) {
  const rows = [...budgetReport.entries()];
  const byTime = [...rows].sort((x, y) => y[1].milliseconds - x[1].milliseconds);
  const byOps = [...rows].sort((x, y) => y[1].operations - x[1].operations);
  console.log(`  info  time per 1080p frame (ms): ${byTime.map(([t, m]) => `${t} ${m.milliseconds.toFixed(1)}`).join(", ")}`);
  console.log(`  info  drawing operations per 1080p frame: ${byOps.map(([t, m]) => `${t} ${m.operations}`).join(", ")}`);
}

// ---- whole-composition budget (issue #93) ------------------------------------
//
// The per-primitive budget above measures one default layer. This gate measures
// whole specs at the validator's layer cap: the two 12-layer reference
// composites, the same dark composite under a parallax camera with spread
// depths, and the twelve primitives with the most drawing operations stacked
// together. That last case is chosen from the budget measurements, so it
// follows the vocabulary as it grows. Limits hold at 1920x1080 on the loud
// frame; operations are exact, time is the median of five draws.
const MAX_COMPOSITION_OPERATIONS = 12000;
const MAX_COMPOSITION_MILLISECONDS = 200;
const compositionFails: string[] = [];
{
  const dark = COMPOSITE_SPECS["composite:layers12-dark"];
  const heaviest = [...budgetReport.entries()].sort((a, b) => b[1].operations - a[1].operations || a[0].localeCompare(b[0])).slice(0, 12).map(([type]) => ({ type }));
  const cases: Array<{ name: string; spec: unknown; creative: boolean }> = [
    { name: "composite:layers12-dark", spec: dark.spec, creative: dark.creative },
    { name: "composite:layers12-light", spec: COMPOSITE_SPECS["composite:layers12-light"].spec, creative: COMPOSITE_SPECS["composite:layers12-light"].creative },
    {
      name: "layers12-dark under a parallax camera",
      creative: true,
      spec: {
        ...dark.spec,
        camera: { move: "parallax", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 100, zoom: 1.3, x: 0.7, y: 0.5 } },
        layers: dark.spec.layers.map((l, i) => ({ ...l, depth: i / (dark.spec.layers.length - 1) })),
      },
    },
    // Spec 017: the lift pass runs over the whole frame, so one case pays for it.
    { name: "composite:layers12-dark with a transparent background", spec: { ...dark.spec, background: "transparent" }, creative: dark.creative },
    // Spec 025: a transition frame renders two shots; frame 47 is 8 frames into a 30-frame fade.
    { name: "sequence fade, 12 + 12 layers", creative: dark.creative, spec: { background: dark.spec.background, accent: (dark.spec as any).accent, sequence: [{ from: 0, to: 40, layers: dark.spec.layers }, { from: 40, to: 100, layers: [...dark.spec.layers].reverse(), transition: { type: "fade", frames: 30 } }] } },
    // Spec 026: pixel mode at its heaviest (ring bitmaps at full thickness, a dense emitter).
    { name: "pixel mode: bars, hbars, rings, emitter, particles", creative: true, spec: { background: "black", accent: "#ff2d2d", pixelMode: true, roles: { fg2: "#d8c8a0" }, layers: [{ type: "bars", tone2: "alternate" }, { type: "hbars" }, { type: "rings", count: 12, thickness: 32, tone2: "alternate" }, { type: "rings", count: 12, thickness: 1 }, { type: "emitter", shape: "petal", rate: 200, size: 40, burst: 0.3 }, { type: "particles", count: 500 }] } },
    { name: `heaviest 12 by operations (${heaviest.map((l) => l.type).join(", ")})`, creative: true, spec: { background: "black", accent: "#ff2d2d", layers: heaviest } },
  ];
  const report: string[] = [];
  const failed = new Set<string>();
  for (const c of cases) {
    const v = validateAnimSpec(c.spec);
    if (!v.valid || !v.spec) { failed.add(c.name); compositionFails.push(`${c.name}: does not validate (${v.errors.join("; ")})`); continue; }
    const m = measureCompositionBudget(v.spec, { creative: c.creative });
    report.push(`${c.name.split(" (")[0]} ${m.operations} ops ${m.milliseconds.toFixed(1)} ms`);
    if (m.operations > MAX_COMPOSITION_OPERATIONS || m.milliseconds > MAX_COMPOSITION_MILLISECONDS) failed.add(c.name);
    if (m.operations > MAX_COMPOSITION_OPERATIONS) compositionFails.push(`${c.name}: ${m.operations} ops (allowed ≤ ${MAX_COMPOSITION_OPERATIONS})`);
    if (m.milliseconds > MAX_COMPOSITION_MILLISECONDS) compositionFails.push(`${c.name}: ${m.milliseconds.toFixed(1)} ms (allowed ≤ ${MAX_COMPOSITION_MILLISECONDS})`);
  }
  for (const f of compositionFails) console.error(`  FAIL  composition  ${f}`);
  console.log(`  ${compositionFails.length === 0 ? "ok  " : "FAIL"}  composition ${cases.length - failed.size}/${cases.length}  (≤ ${MAX_COMPOSITION_OPERATIONS} ops, ≤ ${MAX_COMPOSITION_MILLISECONDS} ms per 1080p frame)`);
  console.log(`  info  composition per 1080p frame: ${report.join("; ")}`);
}

// ---- summary ---------------------------------------------------------------

const cleanCount = PRIMITIVES.length - new Set(failures.map((f) => f.primitive)).size;
console.log(`\n${cleanCount}/${PRIMITIVES.length} primitives pass every gate`);
const totalFails = preFlightFails.length + failures.length + compositionFails.length;
if (totalFails > 0) {
  console.error(`vetting gates FAILED (${totalFails} result(s))`);
  process.exit(1);
}
console.log("vetting gates passed");

export {};
