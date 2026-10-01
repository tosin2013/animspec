/**
 * Gate kit — shared helpers for the primitive vetting gates
 * (specs/001-primitive-vetting-gates). Everything here is deterministic: closed-form
 * frames, fixed seeds, no ambient input. Gate scripts import from here; `src/` never does.
 */
import { createCanvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { createRequire } from "node:module";
import { syncBuiltinESMExports } from "node:module";
import { PRIMITIVES, sanitizeLayer, type PrimitiveDef } from "../../src/primitives/registry";
import type { SignalFrame } from "../../src/types";

// ---- probe layers (data-model.md "Probe layer") --------------------------

export interface ProbeLayer {
  layer: Record<string, unknown>;
  /** Which param was varied, or "default". */
  variation: string;
}

const KNOWN_ICON = "heart";
const UNKNOWN_ICON = "zz-unknown";

/**
 * The validated default layer, plus one-at-a-time variations: every other enum
 * value, each boolean flipped, each number at its min and max, and each string
 * set to a known icon name and to an unknown name. Every layer passes through
 * `sanitizeLayer` (rule: probes are what a real spec goes through).
 */
export function probeLayers(def: PrimitiveDef): ProbeLayer[] {
  const probes: ProbeLayer[] = [];
  const push = (spec: Record<string, unknown>, variation: string) => {
    const layer = sanitizeLayer({ type: def.type, ...spec });
    if (layer) probes.push({ layer, variation });
  };
  push({}, "default");
  for (const [k, spec] of Object.entries(def.params)) {
    if (spec.type === "enum") for (const v of spec.values) if (v !== spec.default) push({ [k]: v }, `${k}=${v}`);
    if (spec.type === "boolean") push({ [k]: !spec.default }, `${k}=!${spec.default}`);
    if (spec.type === "number") { push({ [k]: spec.min }, `${k}=${spec.min}`); push({ [k]: spec.max }, `${k}=${spec.max}`); }
    if (spec.type === "string") { push({ [k]: KNOWN_ICON }, `${k}=${KNOWN_ICON}`); push({ [k]: UNKNOWN_ICON }, `${k}=${UNKNOWN_ICON}`); }
  }
  return probes;
}

/** Total probe count across the registry (for the runner header). */
export function totalProbes(defs: PrimitiveDef[] = PRIMITIVES): number {
  return defs.reduce((n, d) => n + probeLayers(d).length, 0);
}

// ---- fixed-time signal frames (data-model.md "Signal probe") -------------

export const GOLDEN_LABEL = "GOLDEN 0123";
export const OTHER_LABEL = "OTHER 9876";

/**
 * A closed-form SignalFrame at the reference times (index 0, 12, 47), scaled by
 * `level` the same way `goldenFrames()` in scripts/lib/goldenHashes.ts scales
 * its frames: values and spectrum shaped by fixed formulas, amplitude and energy
 * proportional to level. Same inputs ⇒ same pixels, anywhere.
 */
export function signalFrame(timeIndex: 0 | 12 | 47, level: number, label: string): SignalFrame {
  const mk = (fn: (i: number) => number) => Float64Array.from({ length: 256 }, (_, i) => level * fn(i));
  return {
    index: timeIndex,
    t: timeIndex / 30,
    values: mk((i) => (Math.sin(i / 5 + timeIndex / 7) + 1) / 2),
    spectrum: mk((i) => Math.max(0, 1 - i / 256)),
    amplitude: level,
    energy: level * 0.8,
    labels: [label],
    coords: [
      { x: 0.25, y: 0.4 },
      { x: 0.6, y: 0.55 },
      { x: 0.8, y: 0.3 },
    ],
  };
}

// ---- rendering ------------------------------------------------------------

export interface RenderOpts {
  dims: { width: number; height: number };
  frame: SignalFrame;
  palette: { bg: string; fg: string; accent: string };
  /** Primitive definitions drawn before the one under test (layered cases). */
  under?: PrimitiveDef[];
  seed?: number;
}

/**
 * Render one primitive definition directly — NOT through `getPrimitive` — so
 * fixture definitions can be rendered too. Creates a canvas, fills the
 * background, draws any `under` layers, then calls `def.draw` with a fixed
 * DrawContext. Returns the raw RGBA pixels.
 */
export function renderProbe(def: PrimitiveDef, layer: Record<string, unknown>, opts: RenderOpts): Uint8ClampedArray {
  const { dims, frame, palette, under, seed = 12345 } = opts;
  const canvas = createCanvas(dims.width, dims.height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, dims.width, dims.height);
  const drawCtx = { reducedFlicker: true, seed, text: frame.labels?.[0] };
  for (const u of under ?? []) {
    const ul = sanitizeLayer({ type: u.type });
    if (ul) u.draw(ctx, dims, frame, ul, palette, drawCtx);
  }
  def.draw(ctx, dims, frame, layer, palette, drawCtx);
  return ctx.getImageData(0, 0, dims.width, dims.height).data;
}

// ---- gate results (data-model.md "Gate result") ---------------------------

export type GateName = "purity" | "palette" | "reactivity" | "budget";

export interface GateResult {
  primitive: string;
  gate: GateName;
  pass: boolean;
  /** What was observed, e.g. "32400 ops", "readFileSync". */
  measured: string;
  /** The limit or rule, e.g. "≤ 3000 ops". */
  allowed: string;
  /** The probe and conditions that produced the result. */
  case: string;
}

// ---- IO guard (research.md R1, purity gate) -------------------------------

/**
 * The CJS module objects to patch. ESM namespace objects are read-only, so the
 * guard patches the CommonJS exports and calls `syncBuiltinESMExports()` so that
 * `import ... from "node:fs"` bindings (and fixture code) see the wrappers.
 */
const require_ = createRequire(import.meta.url);
const fsCjs = require_("node:fs") as Record<string, any>;
const fsPromises = fsCjs.promises as Record<string, any>;

/**
 * File entry points that get wrapped, on `fs` and on `fs.promises`. File calls
 * are recorded and then forwarded to the real function, so the gate scripts can
 * still read their own sources while a primitive draws.
 */
const FS_GUARDED = [
  "readFile", "writeFile", "appendFile", "open",
  "exists", "stat", "lstat", "readdir", "access",
  "readFileSync", "writeFileSync", "appendFileSync", "openSync",
  "existsSync", "statSync", "lstatSync", "readdirSync", "accessSync",
  "createReadStream", "createWriteStream",
] as const;

/** Network/DNS/child-process entry points: recorded and blocked, never forwarded. */
const NET_GUARDED: Array<{ mod: string; name: string }> = [
  { mod: "node:net", name: "connect" },
  { mod: "node:net", name: "createConnection" },
  { mod: "node:http", name: "request" },
  { mod: "node:http", name: "get" },
  { mod: "node:https", name: "request" },
  { mod: "node:https", name: "get" },
  { mod: "node:dns", name: "lookup" },
  { mod: "node:dns", name: "resolve" },
  { mod: "node:child_process", name: "spawn" },
  { mod: "node:child_process", name: "exec" },
  { mod: "node:child_process", name: "execFile" },
  { mod: "node:child_process", name: "fork" },
];

export interface IoGuardOutcome<T> {
  result?: T;
  error?: unknown;
  /** Names of guarded entry points called while `fn` ran. */
  calls: string[];
}

/**
 * Wrap file and network entry points while `fn` runs and record every guarded
 * call. File calls are forwarded to the real function; network, DNS,
 * child-process and `fetch` calls are NOT forwarded — the wrapper records the
 * call and throws `Error("blocked by purity gate")`, so the suite never makes a
 * real connection. An error thrown by `fn` comes back alongside the recorded
 * names. Always restores in `finally`.
 */
export function withIoGuard<T>(fn: () => T): IoGuardOutcome<T> {
  const calls: string[] = [];
  const blocked = (name: string): never => {
    calls.push(name);
    throw new Error("blocked by purity gate");
  };

  const undos: Array<() => void> = [];

  // fs (+ fs.promises): record, then forward.
  for (const name of FS_GUARDED) {
    for (const owner of [fsCjs, fsPromises] as Array<Record<string, any>>) {
      const orig = owner[name];
      if (typeof orig !== "function") continue;
      owner[name] = function (this: unknown, ...args: unknown[]) {
        calls.push(name);
        return (orig as (...a: unknown[]) => unknown).apply(this, args);
      };
      undos.push(() => { owner[name] = orig; });
    }
  }

  // network / DNS / child process: record, then block. Patched on the CJS
  // exports; `syncBuiltinESMExports()` propagates to the ESM bindings that
  // fixture code imports.
  for (const { mod, name } of NET_GUARDED) {
    const owner = require_(mod) as Record<string, any>;
    const orig = owner[name];
    if (typeof orig !== "function") continue;
    owner[name] = function (...args: unknown[]) { return blocked(name); };
    undos.push(() => { owner[name] = orig; });
  }

  // fetch: record and return a rejected promise. The rejection is attached a
  // no-op catch BEFORE the wrapper returns it, so a caller that ignores the
  // promise cannot crash the process with an unhandled rejection — the gate
  // failure surfaces through the recorded call instead.
  const fetchOrig = globalThis.fetch;
  globalThis.fetch = (async (...args: unknown[]) => {
    calls.push("fetch");
    const rejection = Promise.reject(new Error("blocked by purity gate"));
    rejection.catch(() => {}); // observed; the gate reads `calls`, not this promise
    return rejection as never;
  }) as typeof fetch;
  undos.push(() => { globalThis.fetch = fetchOrig; });

  syncBuiltinESMExports();
  try {
    const result = fn();
    return { result, calls };
  } catch (error) {
    return { error, calls };
  } finally {
    for (const undo of undos) undo();
    syncBuiltinESMExports();
  }
}
