/**
 * `animspec/verify` (spec 024): the plugin verifier, published beside the
 * library. It runs the same checks the repository's gates run on core
 * primitives (verify/core.ts) against a plugin's primitives, bound to the
 * built package, so a host such as Motion Studio admits plugins on the same
 * terms as core.
 *
 *   import { verifyPlugin } from "animspec/verify";
 *   const report = verifyPlugin(myPlugin); // { ok, plugin, primitives: [{ type, checks }] }
 *
 * The purity check is a test, not a sandbox: it catches accidental file or
 * network access during probe renders in this process. Run plugins you do not
 * fully trust in an isolated worker.
 */
import { createCanvas } from "@napi-rs/canvas";
import {
  PRIMITIVES,
  sanitizeLayer,
  drawSpec,
  getPrimitive,
  registerPlugin,
  resolveFontFamily,
  declaredRoles,
  PRIMITIVE_ROLES,
} from "../dist/index.js";
import { makeVerifier, type CheckedPrimitive, type PluginReport, type VerifiedPlugin, type VerifyLib } from "./core.js";

export type { PluginReport, PluginCheck, VerifiedPlugin, GateName } from "./core.js";

const lib: VerifyLib = {
  PRIMITIVES: PRIMITIVES as unknown as CheckedPrimitive[],
  sanitizeLayer,
  drawSpec: drawSpec as VerifyLib["drawSpec"],
  resolveFontFamily,
  roleNames: () => [...declaredRoles(), ...PRIMITIVE_ROLES],
  createCanvas: (w, h) => createCanvas(w, h),
  registerPlugin: (p) => registerPlugin(p as never),
  getPrimitive: (t) => getPrimitive(t) as unknown as CheckedPrimitive | undefined,
};

const verifier = makeVerifier(lib);

/** Run the core checks against a plugin and return the report. Registration errors throw. */
export function verifyPlugin(plugin: VerifiedPlugin): PluginReport {
  return verifier.verifyPlugin(plugin);
}
