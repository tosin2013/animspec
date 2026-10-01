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
  paletteViolation,
  probeLayers,
  renderProbe,
  signalFrame,
  totalProbes,
  withIoGuard,
} from "./lib/gateKit";
import { checkIconData } from "./generate-icons";
import { goldenFrames } from "./lib/goldenHashes";

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

// ---- palette gate (user story 2) ------------------------------------------

const PROBE_BACKGROUNDS = ["black", "white"] as const;
const PALETTE_MODES = [
  { mode: "monochrome (accent = fg)", accent: null },
  { mode: "accent red", accent: "#ff0000" },
  { mode: "accent blue", accent: "#0000ff" },
] as const;

/** Layered cases: the bars and rings definitions, rendered before the probe. */
const UNDER_TYPES = ["bars", "rings"] as const;

/**
 * Every pixel is a mix of background, foreground and accent. Every probe layer
 * is rendered on both backgrounds, in monochrome and with two probe accents, at
 * the three golden signal levels; in the accent modes the default layer is also
 * rendered layered over the bars and rings definitions (which paint accent
 * colour), and with reducedFlicker off — the path where flash's accent inversion
 * hid, so the gate must exercise it (user story 2 review).
 *
 * Attribution: a layered failure is attributed to the primitive under test only
 * when the under-layer complies on its own; if the under-layer itself violates
 * the palette, the under-layer is the offender (it is or will be failing in its
 * own right) and the primitive under test is not blamed for it.
 */
function runPaletteGate(defs: PrimitiveDef[]): GateResult[] {
  const results: GateResult[] = [];
  const frames = goldenFrames();
  const byType = new Map(PRIMITIVES.map((p) => [p.type, p]));
  const underDefs = UNDER_TYPES.map((t) => byType.get(t)!).filter(Boolean);
  const paletteFor = (background: string, accent: string | null) =>
    ({ bg: background, fg: background === "black" ? "white" : "black", accent: accent ?? (background === "black" ? "white" : "black") });

  for (const def of defs) {
    const probes = probeLayers(def).length > 0 ? probeLayers(def) : [{ layer: {}, variation: "default" }];
    let measured = "";
    let failedCase = "";

    // -- all probe layers, reducedFlicker on --------------------------------
    for (const { layer, variation } of probes) {
      for (const background of PROBE_BACKGROUNDS) {
        for (const { mode, accent } of PALETTE_MODES) {
          const palette = paletteFor(background, accent);
          for (const level of Object.keys(frames)) {
            const rgba = renderProbe(def, layer, { dims: PROBE_DIMS, frame: frames[level], palette });
            const v = paletteViolation(rgba, palette);
            if (v) {
              measured = `pixel ${v.pixel.join(",")}`;
              failedCase = `${variation}, ${background} bg, ${mode}, ${level}`;
              break;
            }
          }
          if (measured) break;
        }
        if (measured) break;
      }
      if (measured) break;
    }

    // -- default layer, reducedFlicker OFF (accent modes only) --------------
    // Every gate used to render with reducedFlicker on only, so flash's
    // full-strength accent inversion (the exact bug this story fixes) was
    // never exercised. The default layer in the two accent modes, alone and
    // layered, covers that path.
    if (!measured) {
      const defaultLayer = probes[0].layer;
      for (const background of PROBE_BACKGROUNDS) {
        for (const { mode, accent } of PALETTE_MODES) {
          if (accent === null) continue; // monochrome: reducedFlicker-off path is the pinned flash:full case
          const palette = paletteFor(background, accent);
          const cases: Array<{ under?: PrimitiveDef[]; tag: string }> = [
            { tag: "" },
            ...underDefs.map((u) => ({ under: [u], tag: `, layered over ${u.type}` })),
          ];
          for (const level of Object.keys(frames)) {
            for (const c of cases) {
              const rgba = renderProbe(def, defaultLayer, { dims: PROBE_DIMS, frame: frames[level], palette, under: c.under, reducedFlicker: false });
              const v = paletteViolation(rgba, palette);
              if (v) {
                // Attribution: does the under-layer violate the palette on its
                // own, under the same conditions? If so, it is the offender.
                if (c.under) {
                  const underViolates = c.under.some((u) => {
                    const uRgba = renderProbe(u, sanitizeLayer({ type: u.type })!, {
                      dims: PROBE_DIMS, frame: frames[level], palette, reducedFlicker: false,
                    });
                    return paletteViolation(uRgba, palette) !== null;
                  });
                  if (underViolates) continue; // the under-layer's failure, not this primitive's
                }
                measured = `pixel ${v.pixel.join(",")} (reducedFlicker off)`;
                failedCase = `default, ${background} bg, ${mode}, ${level}${c.tag}`;
                break;
              }
            }
            if (measured) break;
          }
          if (measured) break;
        }
        if (measured) break;
      }
    }

    results.push(
      measured
        ? { primitive: def.type, gate: "palette", pass: false, measured, allowed: "mix of bg/fg/accent", case: failedCase }
        : { primitive: def.type, gate: "palette", pass: true, measured: "", allowed: "", case: "" },
    );
  }
  return results;
}

// ---- registered gates ------------------------------------------------------

const GATES: Partial<Record<GateName, GateFn>> = {
  purity: runPurityGate,
  palette: runPaletteGate,
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
