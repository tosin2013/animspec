/**
 * Golden-hash core, shared by the determinism gate and by parity checks against
 * another checkout of the same code. Everything it needs is injected, so the
 * same function can hash this repo's interpreter or someone else's.
 *
 * Pure: fixed synthetic frames, fixed seed, raw RGBA hashed (no PNG encoder in
 * the loop). Same inputs ⇒ same hashes.
 */
import crypto from "crypto";

type Layer = { type: string; [k: string]: unknown };
type Spec = { background?: "black" | "white"; accent?: string; font?: string; layers: Layer[] };
type Frame = {
  index: number; t: number; values: Float64Array; spectrum: Float64Array;
  amplitude: number; energy: number; labels?: string[];
};
type Ctx = { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } };

/**
 * Structural view of a registry param declaration (`src/primitives/registry.ts`
 * `ParamSpec`). The order check only needs bounds and defaults to build
 * non-default cases, so it declares the shape it uses instead of importing it:
 * this file stays injectable for parity checks against another checkout.
 */
export type ParamSpecLike =
  | { type: "number"; min: number; max: number; default: number }
  | { type: "boolean"; default: boolean }
  | { type: "enum"; values: readonly string[]; default: string }
  | { type: "string"; default: string };

export interface GoldenApi {
  createCanvas: (w: number, h: number) => { getContext(kind: "2d"): unknown };
  drawSpec: (ctx: any, dims: { width: number; height: number }, frame: any, spec: any, opts: any, caption?: string) => void;
  PRIMITIVES: ReadonlyArray<{ type: string; params?: Record<string, ParamSpecLike> }>;
  sanitizeLayer: (raw: unknown) => Record<string, unknown> | null;
}

export const DIMS = { width: 320, height: 180 };
export const SEED = 12345;

/** Three fixed frames: near-silent, mid, loud. Closed-form, so reproducible anywhere. */
export function goldenFrames(): Record<string, Frame> {
  const mk = (index: number, level: number): Frame => ({
    index,
    t: index / 30,
    values: Float64Array.from({ length: 256 }, (_, i) => level * (Math.sin(i / 5 + index / 7) + 1) / 2),
    spectrum: Float64Array.from({ length: 256 }, (_, i) => level * Math.max(0, 1 - i / 256)),
    amplitude: level,
    energy: level * 0.8,
    labels: ["GOLDEN 0123"],
  });
  return { quiet: mk(0, 0.02), mid: mk(12, 0.5), loud: mk(47, 0.95) };
}

/** Multi-layer specs, incl. white background and creative accent colour. */
export const COMPOSITE_SPECS: Record<string, { spec: Spec; creative: boolean }> = {
  "composite:grid+wave+caption": {
    creative: false,
    spec: { background: "black", layers: [{ type: "grid" }, { type: "wave" }, { type: "caption" }] },
  },
  "composite:white-bars+scan": {
    creative: false,
    spec: { background: "white", layers: [{ type: "bars" }, { type: "scan" }] },
  },
  "composite:creative-accent": {
    creative: true,
    spec: { background: "black", accent: "#ff2d2d", layers: [{ type: "radial" }, { type: "rings" }, { type: "crosshair" }] },
  },
  "composite:layers12-dark": {
    creative: true,
    spec: {
      background: "black", accent: "#ff2d2d",
      layers: [
        { type: "gridhorizon" }, { type: "tunnel" }, { type: "mesh3d" }, { type: "hbars" },
        { type: "radial" }, { type: "spiral" }, { type: "tetris" }, { type: "particles" },
        { type: "bars" }, { type: "orbits" }, { type: "dots" }, { type: "rain" },
      ],
    },
  },
  "composite:layers12-light": {
    creative: true,
    spec: {
      background: "white", accent: "#2d6bff",
      layers: [
        { type: "hbars" }, { type: "radial" }, { type: "tunnel" }, { type: "mesh3d" },
        { type: "gridhorizon" }, { type: "spiral" }, { type: "grid" }, { type: "wave" },
        { type: "rings" }, { type: "shape" }, { type: "lissajous" }, { type: "crosshair" },
      ],
    },
  },
};

/**
 * Reference cases with per-case render options. `flash:full` pins the current
 * full-strength inversion (reducedFlicker OFF, creative OFF) before flash is
 * changed to honour reducedFlicker, so the "unchanged" claim is checked by a hash.
 */
const OPTION_CASES: Record<string, { spec: Spec; reducedFlicker: boolean; creative: boolean }> = {
  "flash:full": { spec: { layers: [{ type: "flash" }] }, reducedFlicker: false, creative: false },
};

/**
 * Reference cases rendered with a fixed label instead of the golden label, at
 * the same three times and levels. `text:missing-glyphs` guards that
 * characters a font lacks never fall back to a machine font (contracts/fonts.md).
 * Caption has no params, so its bare layer is its validated default layer.
 */
const LABEL_CASES: Record<string, { spec: Spec; label: string }> = {
  "text:missing-glyphs": { spec: { layers: [{ type: "caption" }] }, label: "Ω é ñ 日本語 😀 → ▓" },
};

/**
 * Non-default caption styles, rendered with a mixed-case multi-line label so
 * `case` (asis vs upper) and `maxLines` (1/2/3) are distinguishable from the
 * defaults. The white-background case pins the palette.bg/fg change from the
 * caption-params work (issue #57): captions under a non-default palette now
 * colour from the palette instead of literal black/white.
 */
const CAPTION_LABEL = "the quick brown fox jumps over the lazy dog and keeps on running";
const CAPTION_STYLE_CASES: Record<string, { spec: Spec; label: string }> = {
  "caption:asis-outline-bottom": { spec: { layers: [{ type: "caption", case: "asis", box: "outline" }] }, label: CAPTION_LABEL },
  "caption:upper-none-top": { spec: { layers: [{ type: "caption", box: "none", position: "top" }] }, label: CAPTION_LABEL },
  "caption:asis-solid-center-1": { spec: { layers: [{ type: "caption", case: "asis", position: "center", maxLines: 1 }] }, label: CAPTION_LABEL },
  "caption:maxlines-2": { spec: { layers: [{ type: "caption", maxLines: 2 }] }, label: CAPTION_LABEL },
  "caption:white-bg": { spec: { background: "white", layers: [{ type: "caption" }] }, label: CAPTION_LABEL },
};

/**
 * type-reveal cases with real content (spec 012): the default layer's `text` is
 * empty by design (an empty reveal draws nothing, which the default
 * `type-reveal@*` cases pin), so these named cases carry the words. Together
 * they pin the reveal schedule at the three golden frames, the hold after the
 * last unit, the accent emphasis span, and line mode with left alignment.
 */
const REVEAL_CASES: Record<string, { spec: Spec }> = {
  "type-reveal:mid-sentence": { spec: { layers: [{ type: "type-reveal", text: "the frame tells the story", framesPerUnit: 4, emphasisStart: 3, emphasisEnd: 4 }] } },
  "type-reveal:complete-hold": { spec: { layers: [{ type: "type-reveal", text: "a held full block", framesPerUnit: 2, emphasisStart: 2, emphasisEnd: 3 }] } },
  "type-reveal:lines-left": { spec: { layers: [{ type: "type-reveal", text: "first line\nsecond line", mode: "line", framesPerUnit: 3, align: "left", fontSize: 30 }] } },
};

/**
 * Per-font text cases: each text primitive's validated default layer in a spec
 * with `font` set (contracts/fonts.md). Only the non-default fonts need cases;
 * the default font is covered by the `<primitive>@<level>` keys.
 */
const FONT_CASES: Record<string, { spec: Spec }> = {};
for (const key of ["jetbrains", "plex"]) {
  for (const primitive of ["caption", "text", "rain", "crosshair", "led"]) {
    FONT_CASES[`font:${key}:${primitive}`] = { spec: { font: key, layers: [{ type: primitive }] } };
  }
}

function renderOpts(opts: { reducedFlicker?: boolean; creative?: boolean }): { reducedFlicker: boolean; creative: boolean; seed: number } {
  return { reducedFlicker: opts.reducedFlicker ?? true, creative: opts.creative ?? false, seed: SEED };
}

function render(api: GoldenApi, spec: Spec, frame: Frame, opts: { reducedFlicker: boolean; creative: boolean }): Uint8ClampedArray {
  const canvas = api.createCanvas(DIMS.width, DIMS.height);
  const ctx = canvas.getContext("2d");
  api.drawSpec(ctx, DIMS, frame, spec, renderOpts(opts));
  return (ctx as Ctx).getImageData(0, 0, DIMS.width, DIMS.height).data;
}

const hashRgba = (rgba: Uint8ClampedArray): string => crypto.createHash("sha256").update(rgba).digest("hex");

// ---- reference cases -------------------------------------------------------

/** Explicit full layers for the icon cases (validated shapes, hand-written). */
const ICON_CASES: Record<string, { spec: Spec }> = {
  "icon:led-heart": { spec: { layers: [{ type: "led", icon: "heart", scroll: false, effect: "static", reactive: false }] } },
  "icon:led-unknown": { spec: { layers: [{ type: "led", icon: "zz-unknown", scroll: false, effect: "static", reactive: false }] } },
  "icon:sprite-heart": { spec: { layers: [{ type: "sprite", character: "none", icon: "heart", motion: "static", reactive: false }] } },
  "icon:sprite-unknown": { spec: { layers: [{ type: "sprite", character: "none", icon: "zz-unknown", motion: "static", reactive: false }] } },
};

/** One reference case: its key plus the raw RGBA it renders. */
export interface RenderedCase {
  key: string;
  rgba: Uint8ClampedArray;
}

/** Every reference case with its raw RGBA, so hashes and stored frames come from the same render. */
export function renderCases(api: GoldenApi): RenderedCase[] {
  const frames = goldenFrames();
  const out: RenderedCase[] = [];
  for (const p of api.PRIMITIVES) {
    // Every primitive gets reference cases regardless of tier: legacy primitives
    // keep their reference frames and are still compared on every run (FR-022).
    const layer = api.sanitizeLayer({ type: p.type }) as Layer | null;
    if (!layer) continue;
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${p.type}@${fname}`, rgba: render(api, { layers: [layer] }, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(COMPOSITE_SPECS)) {
    // Layers are validated first, so composites record real default behaviour
    // (spec.md User Story 2). Effective values are unchanged, so existing
    // composite hashes do not move.
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec }] of Object.entries(ICON_CASES)) {
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, spec, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, reducedFlicker, creative }] of Object.entries(OPTION_CASES)) {
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, spec, frame, { creative, reducedFlicker }) });
    }
  }
  for (const [name, { spec, label }] of Object.entries(LABEL_CASES)) {
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, spec, { ...frame, labels: [label] }, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, label }] of Object.entries(CAPTION_STYLE_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, { ...frame, labels: [label] }, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec }] of Object.entries(REVEAL_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec }] of Object.entries(FONT_CASES)) {
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, spec, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  return out;
}

/** key → sha256 of raw RGBA. Keys: `<primitive>@<frame>` and `<composite>@<frame>`. */
export function computeHashes(api: GoldenApi): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, rgba } of renderCases(api)) out[key] = hashRgba(rgba);
  return out;
}

// ---- frame-order independence (issue #32, extended by issue #55) -----------

/** Frames in a sequence (default 8): enough to expose hidden per-frame state. */
export const ORDER_SEQUENCE_LENGTH = 8;

/**
 * A short, time-varying frame sequence for the order-independence check.
 * Closed-form like `goldenFrames`, but the level (and so the signal) changes
 * with the frame index so motion and per-frame RNG streams are exercised.
 */
export function sequenceFrames(n = ORDER_SEQUENCE_LENGTH): Frame[] {
  return Array.from({ length: n }, (_, index) => {
    const level = 0.08 + 0.87 * (0.5 + 0.5 * Math.sin(index / 2.3));
    return {
      index,
      t: index / 30,
      values: Float64Array.from({ length: 256 }, (_, i) => level * (Math.sin(i / 5 + index / 7) + 1) / 2),
      spectrum: Float64Array.from({ length: 256 }, (_, i) => level * Math.max(0, 1 - i / 256)),
      amplitude: level,
      energy: level * 0.8,
      labels: ["ORDER 0123"],
    };
  });
}

/** One order-check case: its key, the spec it renders, and the render options. */
export interface OrderCase {
  key: string;
  spec: Spec;
  opts: { creative: boolean; reducedFlicker: boolean };
}

/**
 * A non-default value for every declared param that admits one, generated
 * mechanically from the registry declaration (Principle II: no second
 * hand-synchronised list). Numbers take the bound farthest from the default,
 * booleans flip, enums take the first non-default value. `string` params are
 * skipped: there is no generic non-default to invent for one.
 */
function nonDefaultOverrides(params: Record<string, ParamSpecLike>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(params)) {
    if (spec.type === "number") {
      if (spec.default < spec.max) out[name] = spec.max;
      else if (spec.default > spec.min) out[name] = spec.min;
    } else if (spec.type === "boolean") {
      out[name] = !spec.default;
    } else if (spec.type === "enum") {
      const other = spec.values.find((v) => v !== spec.default);
      if (other !== undefined) out[name] = other;
    }
  }
  return out;
}

/**
 * The order-check case list: every primitive at its default params and, when
 * its declaration admits a non-default one, at generated non-default params
 * (keyed `<type>~nd`), plus the composite specs. Shared by the in-process
 * check and by the fresh-process child, so both render exactly the same cases.
 */
export function orderCheckCases(api: GoldenApi): OrderCase[] {
  const cases: OrderCase[] = [];
  for (const p of api.PRIMITIVES) {
    const def = api.sanitizeLayer({ type: p.type }) as Layer | null;
    if (def) cases.push({ key: p.type, spec: { layers: [def] }, opts: { creative: false, reducedFlicker: true } });
    const raw = { type: p.type, ...nonDefaultOverrides(p.params ?? {}) };
    const nd = api.sanitizeLayer(raw) as Layer | null;
    // Only add the case when the overrides survived validation — otherwise it
    // would silently duplicate the default case.
    if (def && nd && JSON.stringify(nd) !== JSON.stringify(def)) {
      cases.push({ key: `${p.type}~nd`, spec: { layers: [nd] }, opts: { creative: false, reducedFlicker: true } });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(COMPOSITE_SPECS)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    cases.push({ key: name, spec: { ...spec, layers }, opts: { creative, reducedFlicker: true } });
  }
  return cases;
}

/**
 * Hash a case over the given frames, rendered in the order given (each frame
 * to a fresh canvas), as `frameIndex → sha256`. Plain object so a child
 * process can print it as JSON.
 */
export function renderCaseFrameHashes(api: GoldenApi, c: OrderCase, frames: Frame[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const f of frames) out[f.index] = hashRgba(render(api, c.spec, f, c.opts));
  return out;
}

/** Result of the order-independence check. */
export interface OrderIndependenceResult {
  /** Number of cases (primitives + non-default variants + composites) rendered. */
  cases: number;
  /** Number of frames in the sequence. */
  frames: number;
  /** Number of frame orderings compared. */
  orderings: number;
  /** `case@frameN` keys whose hash differed across the orderings. */
  mismatches: string[];
}

/**
 * Frame-order independence: a frame is a pure function of `(spec, frame, seed)`,
 * so rendering order must not change it. Renders the sequence forwards,
 * backwards, as two interleaved even/odd chunks and as two contiguous chunks in
 * reverse order — each frame to a fresh canvas via a fresh `drawSpec` call —
 * and reports any case whose frame hash differs across the orderings, at
 * default and generated non-default params. A primitive with hidden per-frame
 * state (e.g. a particle system integrating over time) makes the orderings
 * disagree. (`[0..n/2)` then `[n/2..n)` is the forward order itself in-process;
 * that chunk shape is covered across process boundaries by the fresh-process
 * check, issue #55.)
 */
export function orderIndependenceMismatches(api: GoldenApi, n = ORDER_SEQUENCE_LENGTH): OrderIndependenceResult {
  const seq = sequenceFrames(n);
  const forward = seq.map((f) => f.index);
  const backward = [...forward].reverse();
  const interleaved = [...forward.filter((i) => i % 2 === 0), ...forward.filter((i) => i % 2 === 1)];
  const mid = Math.floor(n / 2);
  const chunksReversed = [...forward.slice(mid), ...forward.slice(0, mid)];
  const orderings = [forward, backward, interleaved, chunksReversed];

  const cases = orderCheckCases(api);
  const mismatches: string[] = [];
  for (const c of cases) {
    const baseline = renderCaseFrameHashes(api, c, seq);
    for (const order of orderings.slice(1)) {
      const hashes = renderCaseFrameHashes(api, c, order.map((i) => seq[i]));
      for (const f of seq) {
        if (hashes[f.index] !== baseline[f.index]) mismatches.push(`${c.key}@frame${f.index}`);
      }
    }
  }
  return { cases: cases.length, frames: n, orderings: orderings.length, mismatches };
}
