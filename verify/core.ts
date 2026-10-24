/**
 * The primitive checks (specs 001 and 024): purity, palette roles, reactivity,
 * speed budget and, for plugins, determinism. One implementation serves the
 * repository's vetting gates (scripts/verify-gates.ts, through gateKit) and the
 * published plugin verifier (`animspec/verify`). The library is injected
 * (`makeVerifier(lib)`), so the gates check this checkout's `src/` and the
 * published entry checks the built package, with no second copy of any rule.
 *
 * Lives outside `src/` on purpose: the purity check patches `fs` and the budget
 * check reads a clock, and `src/` may do neither (verify-determinism's scan).
 * Everything is deterministic: closed-form frames, fixed seeds.
 */
import crypto from "node:crypto";
import os from "node:os";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { GOLDEN_LABEL, OTHER_LABEL, goldenAssets, goldenFrames, signalFrame, type Frame } from "./fixtures.js";

export { GOLDEN_LABEL, OTHER_LABEL, goldenAssets, goldenFrames, signalFrame };
export type { Frame };

// ---- the injected library ---------------------------------------------------

type Ctx = any;
type Palette = { bg: string; fg: string; accent: string; roles?: Readonly<Record<string, string>> };

/** The structural shape of a primitive definition the checks need. */
export interface CheckedPrimitive {
  type: string;
  params: Record<string, any>;
  draw(ctx: Ctx, dims: { width: number; height: number }, frame: any, layer: Record<string, unknown>, palette: Palette, dctx: any): void;
}

/** What the checks need from an animspec build. */
export interface VerifyLib {
  /** Core primitives (the palette check layers some of them under the probe). */
  PRIMITIVES: readonly CheckedPrimitive[];
  sanitizeLayer(raw: unknown): Record<string, unknown> | null;
  drawSpec(ctx: Ctx, dims: { width: number; height: number }, frame: any, spec: any, opts: any): void;
  resolveFontFamily(key?: string): string;
  /** Named roles to probe in the palette roles mode (characters' and primitives'). */
  roleNames(): string[];
  createCanvas(w: number, h: number): any;
  /** Spec 024: for `verifyPlugin`. */
  registerPlugin?(plugin: VerifiedPlugin): void;
  getPrimitive?(type: string): CheckedPrimitive | undefined;
}

/** The plugin shape `verifyPlugin` takes (src/plugins.ts `Plugin`). */
export interface VerifiedPlugin {
  id: string;
  version: string;
  licence: string;
  primitives: Array<{ type: string } & Record<string, unknown>>;
}

/** One check's outcome in a plugin report. */
export interface PluginCheck {
  name: GateName;
  pass: boolean;
  measured: string;
  allowed: string;
  case: string;
}

/** `verifyPlugin`'s report: every check for every primitive of the plugin. */
export interface PluginReport {
  ok: boolean;
  plugin: { id: string; version: string; licence: string };
  primitives: Array<{ type: string; checks: PluginCheck[] }>;
}

// ---- gate results (data-model.md "Gate result") ---------------------------

export type GateName = "purity" | "palette" | "reactivity" | "budget" | "determinism";

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

export interface ProbeLayer {
  layer: Record<string, unknown>;
  /** Which param was varied, or "default". */
  variation: string;
}

export interface RenderOpts {
  dims: { width: number; height: number };
  frame: Frame;
  palette: Palette;
  /** Primitive definitions drawn before the one under test (layered cases). */
  under?: CheckedPrimitive[];
  seed?: number;
  /** Passed through to draw. Default true; the palette gate also renders with it off. */
  reducedFlicker?: boolean;
  /** Spec 022: creative mode for draw (image colour). Default false. */
  creative?: boolean;
}

// ---- palette violation (data-model.md "Palette probe") --------------------

type RGB = [number, number, number];

export const rgbOf = (col: string): RGB => {
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
 * Named roles (spec 020, widened by spec 019): when the palette carries
 * `roles`, a pixel that fails the triangle may instead lie in the triangle of
 * background, foreground and one role colour, within the same tolerance — each
 * role is treated like the accent, so an anti-aliased role edge over a faint
 * foreground line passes, as an accent edge does. Without roles the check is
 * unchanged.
 *
 * Returns the first violating pixel and how many there are; null on compliance.
 */
export function paletteViolation(rgba: Uint8ClampedArray, palette: Palette): { pixel: RGB; count: number } | null {
  const v0 = rgbOf(palette.bg), v1 = rgbOf(palette.fg);
  const degenerate = palette.accent === palette.fg;
  const v2 = degenerate ? v1 : rgbOf(palette.accent);
  const roleColours = Object.values(palette.roles ?? {}).map(rgbOf);
  const near = (p: RGB, q: RGB) =>
    Math.abs(p[0] - q[0]) <= PALETTE_TOLERANCE && Math.abs(p[1] - q[1]) <= PALETTE_TOLERANCE && Math.abs(p[2] - q[2]) <= PALETTE_TOLERANCE;

  let first: RGB | null = null;
  let count = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const p: RGB = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const q = degenerate
      ? closestOnSegment(p, v0, v1)
      : closestOnTriangle(p, v0, v1, v2);
    if (!near(p, q) && !roleColours.some((r) => near(p, closestOnTriangle(p, v0, v1, r)))) {
      count++;
      if (!first) first = p;
    }
  }
  return first ? { pixel: first, count } : null;
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
export function countOperations(ctx: Ctx): { ctx: Ctx; count: () => number } {
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
  return { ctx: proxy, count: () => n };
}

export const BUDGET_DIMS = { width: 1920, height: 1080 };
const BUDGET_PALETTE = { bg: "black", fg: "white", accent: "white" };
export const MAX_OPERATIONS = 3000;
export const MAX_MILLISECONDS = 50;

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
 *
 * This is a test, not a sandbox: it watches the process it runs in, so it
 * catches accidental I/O during probe renders, not code determined to hide it.
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
    owner[name] = function (..._args: unknown[]) { return blocked(name); };
    undos.push(() => { owner[name] = orig; });
  }

  // fetch: record and return a rejected promise. The rejection is attached a
  // no-op catch BEFORE the wrapper returns it, so a caller that ignores the
  // promise cannot crash the process with an unhandled rejection — the gate
  // failure surfaces through the recorded call instead.
  const fetchOrig = globalThis.fetch;
  globalThis.fetch = (async (..._args: unknown[]) => {
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

// ---- the checks, bound to a library ----------------------------------------

const KNOWN_ICON = "heart";
const UNKNOWN_ICON = "zz-unknown";
export const PROBE_DIMS = { width: 320, height: 180 };
export const PALETTE_MONO_BLACK = { bg: "black", fg: "white", accent: "white" };
const PROBE_BACKGROUNDS = ["black", "white"] as const;
const PALETTE_MODES = [
  { mode: "monochrome (accent = fg)", accent: null },
  { mode: "accent red", accent: "#ff0000" },
  { mode: "accent blue", accent: "#0000ff" },
] as const;
/** Layered cases: the bars and rings definitions, rendered before the probe. */
const UNDER_TYPES = ["bars", "rings"] as const;
const REFERENCE_TIMES = [0, 12, 47] as const;

const hashRgba = (data: Uint8ClampedArray) => crypto.createHash("sha256").update(data).digest("hex");

export function makeVerifier(lib: VerifyLib) {
  const probeAssets = () => goldenAssets(lib.createCanvas);

  /**
   * The validated default layer, plus one-at-a-time variations: every other enum
   * value, each boolean flipped, each number at its min and max, and each string
   * set to its `example`, or else to a known icon name and to an unknown name.
   * Every layer passes through `sanitizeLayer` (rule: probes are what a real
   * spec goes through).
   */
  function probeLayers(def: CheckedPrimitive): ProbeLayer[] {
    const probes: ProbeLayer[] = [];
    const push = (spec: Record<string, unknown>, variation: string) => {
      const layer = lib.sanitizeLayer({ type: def.type, ...spec });
      if (layer) probes.push({ layer, variation });
    };
    push({}, "default");
    for (const [k, spec] of Object.entries(def.params)) {
      if (spec.type === "enum") for (const v of spec.values) if (v !== spec.default) push({ [k]: v }, `${k}=${v}`);
      if (spec.type === "boolean") push({ [k]: !spec.default }, `${k}=!${spec.default}`);
      if (spec.type === "number") { push({ [k]: spec.min }, `${k}=${spec.min}`); push({ [k]: spec.max }, `${k}=${spec.max}`); }
      if (spec.type === "string") {
        if (spec.example !== undefined) push({ [k]: spec.example }, `${k}=example`);
        else { push({ [k]: KNOWN_ICON }, `${k}=${KNOWN_ICON}`); push({ [k]: UNKNOWN_ICON }, `${k}=${UNKNOWN_ICON}`); }
      }
    }
    return probes;
  }

  /**
   * Render one primitive definition directly — not through a registry lookup —
   * so fixture definitions can be rendered too. Creates a canvas, fills the
   * background, draws any `under` layers, then calls `def.draw` with a fixed
   * DrawContext. Returns the raw RGBA pixels.
   */
  function renderProbe(def: CheckedPrimitive, layer: Record<string, unknown>, opts: RenderOpts): Uint8ClampedArray {
    const { dims, frame, palette, under, seed = 12345, reducedFlicker = true, creative = false } = opts;
    const canvas = lib.createCanvas(dims.width, dims.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, dims.width, dims.height);
    const drawCtx = { reducedFlicker, seed, layerSeed: seed, text: frame.labels?.[0], font: lib.resolveFontFamily(), creative, assets: probeAssets() };
    for (const u of under ?? []) {
      const ul = lib.sanitizeLayer({ type: u.type });
      if (ul) u.draw(ctx, dims, frame, ul, palette, drawCtx);
    }
    def.draw(ctx, dims, frame, layer, palette, drawCtx);
    return ctx.getImageData(0, 0, dims.width, dims.height).data;
  }

  /**
   * Conditions: 1920×1080, default probe, loud signal at the last reference time
   * (index 47, level 0.95). `operations` is the count from one draw through the
   * proxy, excluding the background fill. `milliseconds` is the median of five
   * draws after one warm-up on an unproxied context, reading one pixel back after
   * each draw so the work is flushed.
   */
  function measureBudget(def: CheckedPrimitive): { operations: number; milliseconds: number } {
    const layer = lib.sanitizeLayer({ type: def.type }) ?? {};
    const frame = signalFrame(47, 0.95, GOLDEN_LABEL);
    const drawCtx = { reducedFlicker: true, seed: 12345, layerSeed: 12345, text: frame.labels?.[0], font: lib.resolveFontFamily(), assets: probeAssets() };
    const fresh = () => {
      const ctx = lib.createCanvas(BUDGET_DIMS.width, BUDGET_DIMS.height).getContext("2d");
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

  /**
   * No file or network access in draw, and output does not depend on the working
   * directory. Every probe layer is rendered inside a runtime IO guard; an error that
   * is not an IO call (the gate only forwards and records file calls, and blocks
   * network ones) is reported as a failure in its own right. `cwdLayers` (core's
   * icon layers) are rendered once per working directory and compared (FR-007).
   */
  function checkPurity(def: CheckedPrimitive, cwdLayers?: Array<Record<string, unknown>>): GateResult {
    const frame = signalFrame(12, 0.5, GOLDEN_LABEL);
    // Registry entries go through sanitizeLayer (rule: probes are what a real
    // spec goes through). Fixtures — not in the registry — get a bare layer.
    const probes = probeLayers(def).length > 0
      ? probeLayers(def)
      : [{ layer: {}, variation: "default" }];
    let seen: string[] = [];
    let failedCase = "";
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
        return {
          primitive: def.type, gate: "purity", pass: false,
          measured: `threw: ${error instanceof Error ? error.message : String(error)}`,
          allowed: "renders without throwing",
          case: variation,
        };
      }
    }
    if (seen.length > 0) {
      return {
        primitive: def.type, gate: "purity", pass: false,
        measured: [...new Set(seen)].join(", "),
        allowed: "no file or network access in draw",
        case: failedCase,
      };
    }
    // Working-directory independence: render the given layers once in the
    // original directory and once from a temporary directory, changing back
    // INSIDE the loop so every pair is compared (FR-007).
    let cwdDependent = false;
    if (cwdLayers) {
      const originalCwd = process.cwd();
      try {
        for (const raw of cwdLayers) {
          const layer = lib.sanitizeLayer(raw)!;
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
    return cwdDependent
      ? {
          primitive: def.type, gate: "purity", pass: false,
          measured: "output depends on the working directory",
          allowed: "identical output from any working directory",
          case: failedCase,
        }
      : { primitive: def.type, gate: "purity", pass: true, measured: "", allowed: "", case: "" };
  }

  /**
   * Probe colours for the roles mode (spec 020): every role a v2 character
   * declares, and every role a primitive reads (spec 019), gets a fixed hue, evenly spread around the colour wheel at full
   * saturation, so a role drawn in the wrong place shows up as off-palette.
   */
  function rolesProbe(): Record<string, string> {
    const names = [...new Set(lib.roleNames())].sort();
    const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
    const out: Record<string, string> = {};
    names.forEach((name, i) => {
      const h = (i * 6) / names.length; // 0..6
      const x = 1 - Math.abs((h % 2) - 1);
      const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
      out[name] = `#${hex(r)}${hex(g)}${hex(b)}`;
    });
    return out;
  }

  /**
   * Every pixel is a mix of background, foreground and accent. Every probe layer
   * is rendered on both backgrounds, in monochrome and with two probe accents, at
   * the three golden signal levels; in the accent modes the default layer is also
   * rendered layered over the bars and rings definitions (which paint accent
   * colour), and with reducedFlicker off — the path where flash's accent inversion
   * hid, so the gate must exercise it (user story 2 review).
   *
   * A roles mode (spec 020) renders every probe layer on both backgrounds at the
   * mid level with the red probe accent and a probe colour for every declared
   * role; a pixel may then also be a mix of the background, the foreground and
   * one role colour (each role treated like the accent).
   *
   * Attribution: a layered failure is attributed to the primitive under test only
   * when the under-layer complies on its own; if the under-layer itself violates
   * the palette, the under-layer is the offender (it is or will be failing in its
   * own right) and the primitive under test is not blamed for it.
   */
  function checkPalette(def: CheckedPrimitive): GateResult {
    const frames = goldenFrames();
    const byType = new Map(lib.PRIMITIVES.map((p) => [p.type, p]));
    const underDefs = UNDER_TYPES.map((t) => byType.get(t)!).filter(Boolean);
    const paletteFor = (background: string, accent: string | null) =>
      ({ bg: background, fg: background === "black" ? "white" : "black", accent: accent ?? (background === "black" ? "white" : "black") });

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

    // -- roles mode (spec 020): all probe layers, mid level ------------------
    if (!measured) {
      const roles = rolesProbe();
      for (const { layer, variation } of probes) {
        for (const background of PROBE_BACKGROUNDS) {
          const palette = { ...paletteFor(background, "#ff0000"), roles };
          const rgba = renderProbe(def, layer, { dims: PROBE_DIMS, frame: frames.mid, palette });
          const v = paletteViolation(rgba, palette);
          if (v) {
            measured = `pixel ${v.pixel.join(",")}`;
            failedCase = `${variation}, ${background} bg, roles, mid`;
            break;
          }
        }
        if (measured) break;
      }
    }

    // -- default layer, accent modes: layered, and reducedFlicker off -------
    // Every gate used to render with reducedFlicker on only, so flash's
    // full-strength accent inversion (the exact bug this story fixes) was
    // never exercised. The default layer in the two accent modes is rendered
    // with reducedFlicker off (alone and layered) and with it on (layered; the
    // alone case is already covered above).
    const defaultLayer = probes[0].layer;
    for (const reducedFlicker of [false, true]) {
      if (measured) break;
      for (const background of PROBE_BACKGROUNDS) {
        for (const { mode, accent } of PALETTE_MODES) {
          if (accent === null) continue; // monochrome: reducedFlicker-off path is the pinned flash:full case
          const palette = paletteFor(background, accent);
          const cases: Array<{ under?: CheckedPrimitive[]; tag: string }> = [
            ...(reducedFlicker ? [] : [{ tag: "" }]),
            ...underDefs.map((u) => ({ under: [u], tag: `, layered over ${u.type}` })),
          ];
          for (const level of Object.keys(frames)) {
            for (const c of cases) {
              const rgba = renderProbe(def, defaultLayer, { dims: PROBE_DIMS, frame: frames[level], palette, under: c.under, reducedFlicker });
              const v = paletteViolation(rgba, palette);
              if (v) {
                // Attribution: does the under-layer violate the palette on its
                // own, under the same conditions? If so, it is the offender.
                if (c.under) {
                  const underViolates = c.under.some((u) => {
                    const uRgba = renderProbe(u, lib.sanitizeLayer({ type: u.type })!, {
                      dims: PROBE_DIMS, frame: frames[level], palette, reducedFlicker,
                    });
                    return paletteViolation(uRgba, palette) !== null;
                  });
                  if (underViolates) continue; // the under-layer's failure, not this primitive's
                }
                measured = `pixel ${v.pixel.join(",")} (reducedFlicker ${reducedFlicker ? "on" : "off"})`;
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

    return measured
      ? { primitive: def.type, gate: "palette", pass: false, measured, allowed: "mix of bg/fg/accent", case: failedCase }
      : { primitive: def.type, gate: "palette", pass: true, measured: "", allowed: "", case: "" };
  }

  /**
   * Output changes with the signal at a fixed moment. For each primitive's
   * validated default layer, at each reference time, a near-silent frame is
   * compared with a loud one (same label) and one label with another (same
   * level). Within a comparison the time is the same on both sides, so movement
   * with the clock alone does not count. Text counts as signal.
   */
  function checkReactivity(def: CheckedPrimitive): GateResult {
    const layer = lib.sanitizeLayer({ type: def.type }) ?? {};
    const hash = (frame: Frame) =>
      hashRgba(renderProbe(def, layer, { dims: PROBE_DIMS, frame, palette: PALETTE_MONO_BLACK }));
    const reacts = REFERENCE_TIMES.some((t) =>
      hash(signalFrame(t, 0.02, GOLDEN_LABEL)) !== hash(signalFrame(t, 0.95, GOLDEN_LABEL)) ||
      hash(signalFrame(t, 0.5, GOLDEN_LABEL)) !== hash(signalFrame(t, 0.5, OTHER_LABEL)));
    return reacts
      ? { primitive: def.type, gate: "reactivity", pass: true, measured: "", allowed: "", case: "" }
      : {
          primitive: def.type, gate: "reactivity", pass: false,
          measured: "identical output for silent/loud and for both labels",
          allowed: "output changes with signal level or text at a fixed time",
          case: "default layer, times 0, 12 and 47",
        };
  }

  /**
   * Cheap enough to layer: at 1920×1080 with the default layer on a loud frame, at
   * most 3,000 drawing operations (exact, so it never flakes) and at most 50 ms
   * (a loose ceiling that only catches gross regressions). Time is always reported
   * through `onMeasure`.
   */
  function checkBudget(def: CheckedPrimitive, onMeasure?: (m: { operations: number; milliseconds: number }) => void): GateResult {
    const m = measureBudget(def);
    onMeasure?.(m);
    const where = "default layer, 1920x1080, loud";
    if (m.operations > MAX_OPERATIONS) {
      return { primitive: def.type, gate: "budget", pass: false, measured: `${m.operations} ops`, allowed: `≤ ${MAX_OPERATIONS} ops`, case: where };
    }
    if (m.milliseconds > MAX_MILLISECONDS) {
      return { primitive: def.type, gate: "budget", pass: false, measured: `${m.milliseconds.toFixed(1)} ms`, allowed: `≤ ${MAX_MILLISECONDS} ms`, case: where };
    }
    return { primitive: def.type, gate: "budget", pass: true, measured: `${m.operations} ops, ${m.milliseconds.toFixed(1)} ms`, allowed: "", case: "" };
  }

  /**
   * For plugins (spec 024): every probe layer renders identically twice and in
   * forward and reverse frame order, each frame on a fresh canvas. Core keeps
   * its stronger golden and multi-process checks in verify-determinism.
   */
  function checkDeterminism(def: CheckedPrimitive): GateResult {
    const frames = REFERENCE_TIMES.map((t) => signalFrame(t, 0.5, GOLDEN_LABEL));
    const probes = probeLayers(def).length > 0 ? probeLayers(def) : [{ layer: {}, variation: "default" }];
    for (const { layer, variation } of probes) {
      const render = (f: Frame) => hashRgba(renderProbe(def, layer, { dims: PROBE_DIMS, frame: f, palette: PALETTE_MONO_BLACK }));
      const forward = frames.map(render);
      const again = frames.map(render);
      const reverse = [...frames].reverse().map(render).reverse();
      for (let k = 0; k < frames.length; k++) {
        if (forward[k] !== again[k] || forward[k] !== reverse[k]) {
          return {
            primitive: def.type, gate: "determinism", pass: false,
            measured: `frame ${frames[k].index} differs between renders`,
            allowed: "identical output for the same inputs, in any order",
            case: variation,
          };
        }
      }
    }
    return { primitive: def.type, gate: "determinism", pass: true, measured: "", allowed: "", case: "" };
  }

  /**
   * Verify a plugin (spec 024): register it (a no-op when already registered at
   * this version), then run the same checks core primitives pass —
   * determinism, palette roles, budget, reactivity, purity — on each of its
   * namespaced primitives. Registration errors throw.
   */
  function verifyPlugin(plugin: VerifiedPlugin): PluginReport {
    if (!lib.registerPlugin || !lib.getPrimitive) throw new Error("verifyPlugin needs registerPlugin and getPrimitive in the library");
    lib.registerPlugin(plugin);
    const primitives = plugin.primitives.map((p) => {
      const type = `ext:${plugin.id}/${p.type}`;
      const def = lib.getPrimitive!(type)!;
      const results = [checkDeterminism(def), checkPalette(def), checkBudget(def), checkReactivity(def), checkPurity(def)];
      return { type, checks: results.map((r) => ({ name: r.gate, pass: r.pass, measured: r.measured, allowed: r.allowed, case: r.case })) };
    });
    return {
      ok: primitives.every((p) => p.checks.every((c) => c.pass)),
      plugin: { id: plugin.id, version: plugin.version, licence: plugin.licence },
      primitives,
    };
  }

  return { probeAssets, probeLayers, renderProbe, measureBudget, checkPurity, checkPalette, checkReactivity, checkBudget, checkDeterminism, verifyPlugin };
}

export type Verifier = ReturnType<typeof makeVerifier>;
