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
  /** Passed through to draw. Default true; the palette gate also renders with it off. */
  reducedFlicker?: boolean;
}

/**
 * Render one primitive definition directly — NOT through `getPrimitive` — so
 * fixture definitions can be rendered too. Creates a canvas, fills the
 * background, draws any `under` layers, then calls `def.draw` with a fixed
 * DrawContext. Returns the raw RGBA pixels.
 */
export function renderProbe(def: PrimitiveDef, layer: Record<string, unknown>, opts: RenderOpts): Uint8ClampedArray {
  const { dims, frame, palette, under, seed = 12345, reducedFlicker = true } = opts;
  const canvas = createCanvas(dims.width, dims.height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, dims.width, dims.height);
  const drawCtx = { reducedFlicker, seed, text: frame.labels?.[0] };
  for (const u of under ?? []) {
    const ul = sanitizeLayer({ type: u.type });
    if (ul) u.draw(ctx, dims, frame, ul, palette, drawCtx);
  }
  def.draw(ctx, dims, frame, layer, palette, drawCtx);
  return ctx.getImageData(0, 0, dims.width, dims.height).data;
}

// ---- speed measurement (data-model.md "Speed measurement") -----------------

/** Calls that count as one drawing operation on the main context. */
const COUNTED_OPERATIONS = new Set([
  "fillRect", "strokeRect", "clearRect", "fill", "stroke",
  "fillText", "strokeText", "drawImage", "putImageData",
]);

/**
 * A Proxy over a 2D context that counts drawing operations. Property reads and
 * writes go to the real context; methods are called on it, so native methods
 * keep their receiver. Operations on an off-screen canvas created inside
 * `draw` are not counted (the time check covers that cost).
 */
export function countOperations(ctx: CanvasRenderingContext2D): { ctx: CanvasRenderingContext2D; count: () => number } {
  let n = 0;
  const target = ctx as unknown as Record<string | symbol, unknown>;
  const proxy = new Proxy(target, {
    get(t, k) {
      const v = t[k];
      if (typeof v !== "function") return v;
      return (...args: unknown[]) => {
        if (typeof k === "string" && COUNTED_OPERATIONS.has(k)) n++;
        return (v as (...a: unknown[]) => unknown).apply(t, args);
      };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx: proxy as unknown as CanvasRenderingContext2D, count: () => n };
}

const BUDGET_DIMS = { width: 1920, height: 1080 };
const BUDGET_PALETTE = { bg: "black", fg: "white", accent: "white" };

/**
 * Conditions: 1920×1080, default probe, loud signal at the last reference time
 * (index 47, level 0.95). `operations` is the count from one draw through the
 * proxy, excluding the background fill. `milliseconds` is the median of five
 * draws after one warm-up on an unproxied context, reading one pixel back after
 * each draw so the work is flushed.
 */
export function measureBudget(def: PrimitiveDef): { operations: number; milliseconds: number } {
  const layer = sanitizeLayer({ type: def.type }) ?? {};
  const frame = signalFrame(47, 0.95, GOLDEN_LABEL);
  const drawCtx = { reducedFlicker: true, seed: 12345, text: frame.labels?.[0] };
  const fresh = () => {
    const ctx = createCanvas(BUDGET_DIMS.width, BUDGET_DIMS.height).getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = BUDGET_PALETTE.bg;
    ctx.fillRect(0, 0, BUDGET_DIMS.width, BUDGET_DIMS.height);
    return ctx;
  };

  const counted = countOperations(fresh());
  def.draw(counted.ctx, BUDGET_DIMS, frame, layer, BUDGET_PALETTE, drawCtx);
  const operations = counted.count();

  const ctx = fresh();
  const timeOne = () => {
    const t0 = process.hrtime.bigint();
    def.draw(ctx, BUDGET_DIMS, frame, layer, BUDGET_PALETTE, drawCtx);
    ctx.getImageData(0, 0, 1, 1);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  timeOne(); // warm-up
  const samples = [timeOne(), timeOne(), timeOne(), timeOne(), timeOne()].sort((x, y) => x - y);
  return { operations, milliseconds: samples[2] };
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

// ---- palette violation (data-model.md "Palette probe") --------------------

type RGB = [number, number, number];

const rgbOf = (col: string): RGB => {
  if (col === "white") return [255, 255, 255];
  if (col === "black") return [0, 0, 0];
  const n = parseInt(col.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Closest point on segment ab to p (standard clamp-to-edge projection). */
function closestOnSegment(p: RGB, a: RGB, b: RGB): RGB {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const denom = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const t = denom === 0 ? 0 : Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / denom));
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
}

/** Closest point on triangle abc to p (Ericson, Real-Time Collision Detection §5.1.5). */
function closestOnTriangle(p: RGB, a: RGB, b: RGB, c: RGB): RGB {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const d1 = ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2];
  const d2 = ac[0] * ap[0] + ac[1] * ap[1] + ac[2] * ap[2];
  if (d1 <= 0 && d2 <= 0) return a;

  const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]];
  const d3 = ab[0] * bp[0] + ab[1] * bp[1] + ab[2] * bp[2];
  const d4 = ac[0] * bp[0] + ac[1] * bp[1] + ac[2] * bp[2];
  if (d3 >= 0 && d4 <= d3) return b;

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }

  const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const d5 = ab[0] * cp[0] + ab[1] * cp[1] + ab[2] * cp[2];
  const d6 = ac[0] * cp[0] + ac[1] * cp[1] + ac[2] * cp[2];
  if (d6 >= 0 && d5 <= d6) return c;

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}

/** Per-channel tolerance from data-model.md, in 0..255 units. */
const PALETTE_TOLERANCE = 2;

/**
 * A pixel complies if it lies inside the triangle of background, foreground and
 * accent in RGB space, within 2 per channel — i.e. its per-channel distance to
 * the nearest point of the triangle (or to the background–foreground line when
 * accent equals foreground) is at most 2. Canvas blends are convex combinations
 * of the palette colours, so compliant antialiased output sits on the triangle
 * up to rounding.
 *
 * Returns the first violating pixel and how many there are; null on compliance.
 */
export function paletteViolation(
  rgba: Uint8ClampedArray,
  palette: { bg: string; fg: string; accent: string },
): { pixel: RGB; count: number } | null {
  const v0 = rgbOf(palette.bg), v1 = rgbOf(palette.fg);
  const degenerate = palette.accent === palette.fg;
  const v2 = degenerate ? v1 : rgbOf(palette.accent);

  let first: RGB | null = null;
  let count = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const p: RGB = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const q = degenerate
      ? closestOnSegment(p, v0, v1)
      : closestOnTriangle(p, v0, v1, v2);
    if (Math.abs(p[0] - q[0]) > PALETTE_TOLERANCE || Math.abs(p[1] - q[1]) > PALETTE_TOLERANCE || Math.abs(p[2] - q[2]) > PALETTE_TOLERANCE) {
      count++;
      if (!first) first = p;
    }
  }
  return first ? { pixel: first, count } : null;
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
