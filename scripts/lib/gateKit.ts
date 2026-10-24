/**
 * Gate kit — shared helpers for the primitive vetting gates
 * (specs/001-primitive-vetting-gates). The checks themselves live in
 * verify/core.ts (spec 024), bound here to this checkout's `src/`, so the
 * repository's gates and the published plugin verifier share one
 * implementation. Everything is deterministic: closed-form frames, fixed
 * seeds, no ambient input. Gate scripts import from here; `src/` never does.
 */
import { createCanvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { resolveFontFamily } from "../../src/fonts/index";
import { PRIMITIVES, PRIMITIVE_ROLES, getPrimitive, sanitizeLayer, type PrimitiveDef } from "../../src/primitives/registry";
import { registerPlugin, type Plugin } from "../../src/plugins";
import { declaredRoles } from "../../src/primitives/sprites";
import { drawSpec, type AnimSpec } from "../../src/specInterpreter";
import {
  makeVerifier,
  countOperations,
  paletteViolation,
  rgbOf,
  withIoGuard,
  signalFrame,
  GOLDEN_LABEL,
  OTHER_LABEL,
  BUDGET_DIMS,
  type CheckedPrimitive,
  type VerifyLib,
} from "../../verify/core";

export { countOperations, paletteViolation, rgbOf, withIoGuard, signalFrame, GOLDEN_LABEL, OTHER_LABEL };
export type { GateName, GateResult, ProbeLayer, RenderOpts, IoGuardOutcome } from "../../verify/core";

/** This checkout's library, as the checks see it. */
export const SRC_LIB: VerifyLib = {
  PRIMITIVES: PRIMITIVES as unknown as CheckedPrimitive[],
  sanitizeLayer,
  drawSpec: drawSpec as VerifyLib["drawSpec"],
  resolveFontFamily,
  roleNames: () => [...declaredRoles(), ...PRIMITIVE_ROLES],
  createCanvas: (w, h) => createCanvas(w, h),
  registerPlugin: (p) => registerPlugin(p as unknown as Plugin),
  getPrimitive: (t) => getPrimitive(t) as unknown as CheckedPrimitive | undefined,
};

/** The checks, bound to `src/` (verify/core.ts makeVerifier). */
export const V = makeVerifier(SRC_LIB);
export const { probeAssets, probeLayers, renderProbe, measureBudget } = V;

/** Total probe count across the registry (for the runner header). */
export function totalProbes(defs: PrimitiveDef[] = PRIMITIVES): number {
  return defs.reduce((n, d) => n + probeLayers(d as unknown as CheckedPrimitive).length, 0);
}

/**
 * The same measurement for a whole composition (issue #93): every layer of a
 * validated spec, with its camera, drawn through `drawSpec` at 1920×1080 on the
 * loud reference frame. Operations are counted exactly on the main context;
 * time is the median of five draws after a warm-up.
 */
export function measureCompositionBudget(spec: AnimSpec, opts: { creative: boolean }): { operations: number; milliseconds: number } {
  const frame = signalFrame(47, 0.95, GOLDEN_LABEL);
  const specOpts = { reducedFlicker: true, creative: opts.creative, seed: 12345, assets: probeAssets() as never };
  const fresh = () => createCanvas(BUDGET_DIMS.width, BUDGET_DIMS.height).getContext("2d") as CanvasRenderingContext2D;

  const counted = countOperations(fresh());
  drawSpec(counted.ctx, BUDGET_DIMS, frame, spec, specOpts);
  const operations = counted.count();

  const ctx = fresh();
  const timeOne = () => {
    const t0 = process.hrtime.bigint();
    drawSpec(ctx, BUDGET_DIMS, frame, spec, specOpts);
    ctx.getImageData(0, 0, 1, 1);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  timeOne(); // warm-up
  const samples = [timeOne(), timeOne(), timeOne(), timeOne(), timeOne()].sort((x, y) => x - y);
  return { operations, milliseconds: samples[2] };
}

