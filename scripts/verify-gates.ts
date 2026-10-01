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
import os from "node:os";
import crypto from "node:crypto";
import { PRIMITIVES, sanitizeLayer, type PrimitiveDef } from "../src/primitives/registry";
import { BAD_PRIMITIVES } from "./fixtures/badPrimitives";
import {
  type GateName,
  type GateResult,
  GOLDEN_LABEL,
  probeLayers,
  renderProbe,
  signalFrame,
  totalProbes,
  withIoGuard,
} from "./lib/gateKit";
import { checkIconData } from "./generate-icons";

/** A gate takes the primitive definitions and returns one or more results per primitive. */
type GateFn = (defs: PrimitiveDef[]) => GateResult[];

// ---- purity gate (user story 1) -------------------------------------------

const PALETTE_MONO_BLACK = { bg: "black", fg: "white", accent: "white" };
const PROBE_DIMS = { width: 320, height: 180 };

const hashRgba = (data: Uint8ClampedArray) => crypto.createHash("sha256").update(data).digest("hex");

/**
 * No file or network access in draw, and output does not depend on the working
 * directory. Every probe layer is rendered inside a runtime IO guard; an error that
 * is not an IO call (the gate only forwards and records file calls, and blocks
 * network ones) is reported as a failure in its own right. The icon layers for
 * led and sprite are rendered once per working directory and compared (FR-007).
 */
function runPurityGate(defs: PrimitiveDef[]): GateResult[] {
  const frame = signalFrame(12, 0.5, GOLDEN_LABEL);
  const results: GateResult[] = [];
  for (const def of defs) {
    // Registry entries go through sanitizeLayer (rule: probes are what a real
    // spec goes through). Fixtures — not in the registry — get a bare layer.
    const probes = probeLayers(def).length > 0
      ? probeLayers(def)
      : [{ layer: {}, variation: "default" }];
    let seen: string[] = [];
    let failedCase = "";
    let reported = false;
    for (const { layer, variation } of probes) {
      const { error, calls } = withIoGuard(() =>
        renderProbe(def, layer, { dims: PROBE_DIMS, frame, palette: PALETTE_MONO_BLACK }));
      if (calls.length > 0) {
        seen = calls;
        failedCase = variation;
        break;
      }
      // A throw with no guarded call is an ordinary crash on a non-default probe
      // — verify-registry only exercises the default layer, so report it here
      // rather than silently recording the primitive as passing.
      if (error !== undefined) {
        results.push({
          primitive: def.type, gate: "purity", pass: false,
          measured: `threw: ${error instanceof Error ? error.message : String(error)}`,
          allowed: "renders without throwing",
          case: variation,
        });
        reported = true;
        break;
      }
    }
    if (reported) continue;
    if (seen.length > 0) {
      results.push({
        primitive: def.type, gate: "purity", pass: false,
        measured: [...new Set(seen)].join(", "),
        allowed: "no file or network access in draw",
        case: failedCase,
      });
      continue;
    }
    // Working-directory independence: render exactly the four icon layers from
    // T011, once in the original directory and once from a temporary directory,
    // changing back INSIDE the loop so every pair is compared (FR-007). Written
    // out explicitly rather than filtered from the probes: sprite's default
    // character is "mascot", so probe-derived layers never reach the icon
    // lookup, and led's string probes include text layers that do not either.
    let cwdDependent = false;
    const iconLayers = ICON_CWD_LAYERS[def.type];
    if (iconLayers) {
      const originalCwd = process.cwd();
      try {
        for (const raw of iconLayers) {
          const layer = sanitizeLayer(raw)!;
          const iconName = String(raw.icon);
          const here = hashRgba(renderProbe(def, layer, { dims: PROBE_DIMS, frame, palette: PALETTE_MONO_BLACK }));
          process.chdir(os.tmpdir());
          const there = hashRgba(renderProbe(def, layer, { dims: PROBE_DIMS, frame, palette: PALETTE_MONO_BLACK }));
          process.chdir(originalCwd);
          if (here !== there) {
            cwdDependent = true;
            failedCase = `icon ${iconName} (hash differs between working directories)`;
            break;
          }
        }
      } finally {
        process.chdir(originalCwd);
      }
    }
    results.push(
      cwdDependent
        ? {
            primitive: def.type, gate: "purity", pass: false,
            measured: "output depends on the working directory",
            allowed: "identical output from any working directory",
            case: failedCase,
          }
        : { primitive: def.type, gate: "purity", pass: true, measured: "", allowed: "", case: "" },
    );
  }
  return results;
}

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

// ---- registered gates ------------------------------------------------------

const GATES: Partial<Record<GateName, GateFn>> = {
  purity: runPurityGate,
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
  console.log(`  ok    fixtures: each gate rejects its rule-breaking fixture (${fixture.rejected}/${fixture.total})`);
}

// ---- gates over the real registry -----------------------------------------

const failures: GateResult[] = [];

for (const [gate, run] of Object.entries(GATES) as [GateName, GateFn][]) {
  const results = run(PRIMITIVES);
  const passed = results.filter((r) => r.pass).length;
  for (const r of results) if (!r.pass) {
    failures.push(r);
    console.error(`  FAIL  ${r.gate}  ${r.primitive}  ${r.measured} (allowed ${r.allowed}) — ${r.case}`);
  }
  console.log(`  ${passed === results.length ? "ok" : "FAIL"}  ${gate}  ${passed}/${results.length}`);
}

// ---- summary ---------------------------------------------------------------

const cleanCount = PRIMITIVES.length - new Set(failures.map((f) => f.primitive)).size;
console.log(`\n${cleanCount}/${PRIMITIVES.length} primitives pass every gate`);
const totalFails = preFlightFails.length + failures.length;
if (totalFails > 0) {
  console.error(`vetting gates FAILED (${totalFails} result(s))`);
  process.exit(1);
}
console.log("vetting gates passed");

export {};
