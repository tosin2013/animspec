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
type Spec = { background?: "black" | "white" | "transparent"; ink?: "light" | "dark"; accent?: string; roles?: Record<string, string>; assets?: Record<string, { sha256: string; width: number; height: number }>; sequence?: Array<{ from: number; to: number; layers: Layer[]; camera?: Record<string, unknown>; transition?: Record<string, unknown> }>; font?: string; camera?: Record<string, unknown>; pixelMode?: boolean; profile?: string; layers: Layer[] };
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
  | { type: "string"; default: string; example?: string };

export interface GoldenApi {
  createCanvas: (w: number, h: number) => { getContext(kind: "2d"): unknown };
  drawSpec: (ctx: any, dims: { width: number; height: number }, frame: any, spec: any, opts: any, caption?: string) => void;
  PRIMITIVES: ReadonlyArray<{ type: string; params?: Record<string, ParamSpecLike> }>;
  sanitizeLayer: (raw: unknown) => Record<string, unknown> | null;
  /** Spec 022: decoded image assets passed to every render (see goldenAssets). */
  assets?: Record<string, unknown>;
}

export const DIMS = { width: 320, height: 180 };

export { goldenAssets } from "../../verify/fixtures";
export const SEED = 12345;

/** Three fixed frames: near-silent, mid, loud (verify/fixtures.ts, shared with the plugin verifier). */
export { goldenFrames } from "../../verify/fixtures";
import { goldenFrames } from "../../verify/fixtures";

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
 * quote-card cases with real content (issue #26): the default layer reveals the
 * active label (the `quote-card@*` cases pin that); these named cases pin the
 * reveal-then-attribution schedule, the rule, and the no-rule static card.
 */
const QUOTE_CASES: Record<string, { spec: Spec }> = {
  "quote-card:reveal-rule": { spec: { layers: [{ type: "quote-card", quote: "a cited passage with provenance", attribution: "— the source", framesPerUnit: 4 }] } },
  "quote-card:no-rule-static": { spec: { layers: [{ type: "quote-card", quote: "a held card without a rule", reveal: false, rule: false }] } },
};

/**
 * rig cases with real poses (issue #68): the default layer talks on the signal
 * (the `rig@*` cases pin that); these named cases pin the bot and cel rigs,
 * the cheer pose, and a signal-independent mouth (drive=none).
 */
const RIG_CASES: Record<string, { spec: Spec }> = {
  "rig:bot-talking": { spec: { layers: [{ type: "rig", rig: "bot", pose: "talk", headAngle: 8 }] } },
  "rig:cel-cheer": { spec: { layers: [{ type: "rig", rig: "cel", pose: "cheer", eyeOpen: 0.4 }] } },
  "rig:host-shrug-none": { spec: { layers: [{ type: "rig", pose: "shrug", drive: "none", mouthOpen: 0.6 }] } },
  // Poses added in vocabulary 12 (issue #89).
  "rig:host-wave": { spec: { layers: [{ type: "rig", pose: "wave" }] } },
  "rig:host-present": { spec: { layers: [{ type: "rig", pose: "present" }] } },
  "rig:bot-reach": { spec: { layers: [{ type: "rig", rig: "bot", pose: "reach" }] } },
};

/**
 * emitter cases with real configurations (issue #69): the default layer is a
 * dust fall driven by energy (the `emitter@*` cases pin that, including the
 * loud frame's denser swarm); these named cases pin three shapes, sources and
 * the burst threshold crossing (the loud frame flashes, the quiet one doesn't),
 * plus a dense petal fall that guards the cross-type tolerance (issue #126).
 * `steady` adds a `@steady` frame at 5 s, after the fall has filled the frame:
 * the reference times end at 1.6 s, before a 3 s lifetime reaches steady state.
 */
const EMITTER_CASES: Record<string, { spec: Spec; steady?: boolean }> = {
  "emitter:petals-top": { spec: { layers: [{ type: "emitter", shape: "petal", source: "top", rate: 60, life: 3, speed: 0.15, gravity: 0.2, size: 18 }] } },
  "emitter:embers-burst": { spec: { layers: [{ type: "emitter", shape: "ember", source: "bottom", rate: 80, life: 2, burst: 0.5, size: 14 }] } },
  "emitter:sparks-center": { spec: { layers: [{ type: "emitter", shape: "spark", source: "center", spread: 180, speed: 0.4, life: 1, size: 20 }] } },
  // dense, small petals: the configuration that exceeded the cross-type tolerance (issue #126)
  "emitter:petals-dense": { steady: true, spec: { layers: [{ type: "emitter", shape: "petal", source: "top", rate: 200, life: 3, speed: 0.35, gravity: 0.3, spread: 60, size: 26 }] } },
};

/**
 * figure cases with real staging (issue #70): the default layer is one
 * labelled figure (the `figure@*` cases pin that, including the signal's
 * label); these named cases pin the split arrangement with an accent
 * highlight, a walking row, an outlined fallen pair, and the reveal schedule.
 */
const FIGURE_CASES: Record<string, { spec: Spec }> = {
  "figure:split-highlight": { spec: { layers: [{ type: "figure", count: 6, arrangement: "split", highlight: 2 }] } },
  "figure:row-walking": { spec: { layers: [{ type: "figure", count: 4, stance: "walk", style: "outline" }] } },
  "figure:fallen-outline": { spec: { layers: [{ type: "figure", count: 2, stance: "fallen", arrangement: "cluster", style: "outline" }] } },
  "figure:reveal": { spec: { layers: [{ type: "figure", count: 4, reveal: 0.5 }] } },
  // Vocabulary 12: position and size (issue #88), and the wave and cheer stances (issue #89).
  "figure:offset-small": { spec: { layers: [{ type: "figure", count: 2, x: 0.25, y: 0.6, scale: 0.25 }] } },
  "figure:row-wave": { spec: { layers: [{ type: "figure", count: 3, stance: "wave" }] } },
  "figure:cluster-cheer": { spec: { layers: [{ type: "figure", count: 3, stance: "cheer", arrangement: "cluster", style: "outline" }] } },
};

/**
 * Params added to existing primitives in vocabulary 12. Each default
 * reproduces the earlier frames (the `<primitive>@<level>` cases pin that);
 * these cases pin the non-default values: grid's solid fill (issue #98) and
 * line thickness on the stroked primitives (issue #99).
 */
const PARAM_CASES: Record<string, { spec: Spec }> = {
  "grid:solid": { spec: { layers: [{ type: "grid", solid: true }] } },
  "grid:solid-gridlines": { spec: { background: "white", layers: [{ type: "grid", solid: true, gridlines: true, cols: 12, rows: 7 }] } },
  "rings:thick": { spec: { layers: [{ type: "rings", thickness: 8 }] } },
  "shape:thick": { spec: { layers: [{ type: "shape", thickness: 10 }] } },
  "radial:thick": { spec: { layers: [{ type: "radial", thickness: 6 }] } },
  "lissajous:thick": { spec: { layers: [{ type: "lissajous", thickness: 6 }] } },
  "graph:thick": { spec: { layers: [{ type: "graph", thickness: 4 }] } },
  "wave:thick": { spec: { layers: [{ type: "wave", thickness: 20 }] } },
};

/**
 * Designed grid patterns (spec 018, issues #96 and #101): the quilt from #96 as
 * a plain and a solid grid, the solid quilt broken once, and a tiled checker.
 */
const QUILT = "##.a.##/#.....#/..###../#.....#/##.a.##";
/** Spec 022: a placeholder digest for in-code reference assets (bytes are not checked in renders). */
const ZERO_SHA = "0000000000000000000000000000000000000000000000000000000000000000";
/**
 * Clip sequences (spec 025), designed around the reference frames 0, 12 and
 * 47: frame 0 in the first clip, frame 12 inside the second clip's transition
 * (or in the gap), frame 47 in the second clip alone.
 */
const SEQ_A: Layer[] = [{ type: "grid", solid: true }];
const SEQ_B: Layer[] = [{ type: "rings", thickness: 6 }, { type: "wave" }];
const seqCase = (transition?: Record<string, unknown>, extra: Partial<{ camera: Record<string, unknown>; from: number; firstTo: number }> = {}): Spec => ({
  layers: [],
  sequence: [
    { from: 0, to: extra.firstTo ?? 10, layers: SEQ_A },
    { from: extra.from ?? 10, to: 60, layers: SEQ_B, ...(extra.camera ? { camera: extra.camera } : {}), ...(transition ? { transition } : {}) },
  ],
});
const SEQUENCE_CASES: Record<string, { spec: Spec; creative: boolean }> = {
  "sequence:cut": { creative: false, spec: seqCase({ type: "cut" }) },
  "sequence:wipe": { creative: false, spec: seqCase({ type: "wipe", frames: 10, direction: "left" }) },
  "sequence:iris": { creative: false, spec: seqCase({ type: "iris", frames: 10 }) },
  "sequence:fade": { creative: false, spec: seqCase({ type: "fade", frames: 10 }) },
  "sequence:gap": { creative: false, spec: seqCase({ type: "fade", frames: 10 }, { firstTo: 5, from: 20 }) },
  "sequence:camera": { creative: false, spec: seqCase(undefined, { camera: { move: "zoom", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 40, zoom: 1.6, x: 0.6, y: 0.4 } } }) },
};

/** Spec 019: the quilt with `b` (second tone) cells. */
const TWO_TONE = "##.a.##/#b...b#/..###../#b...b#/##.a.##";
/**
 * Palette roles (spec 020): a colour for every role the v2 `hero` declares.
 * Shared with the determinism gate's exact-colour check.
 */
export const HERO_ROLES: Record<string, string> = {
  boots: "#5a3418",
  cloak: "#2d4a8c",
  "cloak-shade": "#1a2c55",
  eyes: "#1e6b3a",
  gold: "#e0b030",
  hair: "#8a4a20",
  "hair-light": "#d08850",
  outline: "#201010",
  skin: "#f0c8a0",
  tunic: "#a02828",
};

/**
 * The v2 hero (spec 020): in monochrome (its letters fall back to the legacy
 * greys), with a full roles map in creative mode, and with three roles given
 * (the rest fall back to their greys).
 */
const ROLE_CASES: Record<string, { spec: Spec; creative: boolean }> = {
  "sprite:hero-mono": { creative: false, spec: { layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] } },
  "sprite:hero-roles": { creative: true, spec: { roles: HERO_ROLES, layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] } },
  "sprite:hero-roles-partial": { creative: true, spec: { roles: { hair: HERO_ROLES.hair, skin: HERO_ROLES.skin, cloak: HERO_ROLES.cloak }, layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] } },
};

const PATTERN_CASES: Record<string, { spec: Spec; creative: boolean }> = {
  "grid:pattern-quilt": { creative: false, spec: { layers: [{ type: "grid", pattern: QUILT }] } },
  "grid:pattern-solid": { creative: true, spec: { accent: "#ff2d2d", layers: [{ type: "grid", pattern: QUILT, solid: true }] } },
  "grid:pattern-breaks": { creative: false, spec: { layers: [{ type: "grid", pattern: QUILT, solid: true, breaks: "3,2 r15; 0,4 dx0.25" }] } },
  "checker:pattern": { creative: false, spec: { layers: [{ type: "checker", pattern: "#a/~.", size: 40 }] } },
  "grid:pattern-two-tone": { creative: false, spec: { layers: [{ type: "grid", pattern: TWO_TONE }] } },
  "grid:pattern-two-tone-fg2": { creative: true, spec: { accent: "#ff2d2d", roles: { fg2: "#d8c8a0" }, layers: [{ type: "grid", pattern: TWO_TONE, solid: true }] } },
  "checker:pattern-two-tone": { creative: true, spec: { roles: { fg2: "#d8c8a0" }, layers: [{ type: "checker", pattern: "#b/b.", size: 40 }] } },
  // Dither (spec 021): named roles in creative mode, monochrome greys across,
  // a solid single-stop band, a chunky 4 × 4 matrix; and caption.margin.
  "dither:sky-roles": { creative: true, spec: { roles: { s0: "#000014", s1: "#281444", s2: "#6c3468" }, layers: [{ type: "dither", colors: "s0,s1,s2", drive: "none" }] } },
  "dither:horizontal-mono": { creative: false, spec: { layers: [{ type: "dither", colors: "bg,a1,a2,fg", direction: "horizontal" }] } },
  "dither:solid-band": { creative: true, spec: { roles: { bar: "#0000a8" }, layers: [{ type: "dither", colors: "bar", y0: 0.7 }] } },
  "dither:chunk4": { creative: false, spec: { layers: [{ type: "dither", matrix: "4", chunk: 4 }] } },
  "caption:margin-0": { creative: false, spec: { layers: [{ type: "caption", box: "none", margin: 0, maxLines: 2 }] } },
  // Image assets (spec 022): the in-code assets (goldenAssets) under placement,
  // crop, flip, opacity, smoothing, wrap-scroll and both colour modes.
  "image:contain-corner": { creative: true, spec: { assets: { tile: { sha256: ZERO_SHA, width: 32, height: 32 } }, layers: [{ type: "image", asset: "tile", fit: "none", scale: 2, x: 0, y: 0, anchor: "top-left", drive: "none" }] } },
  "image:cover": { creative: true, spec: { assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "image", asset: "photo", fit: "cover", drive: "none" }] } },
  "image:src-flip": { creative: true, spec: { assets: { main: { sha256: ZERO_SHA, width: 64, height: 48 } }, layers: [{ type: "image", asset: "main", fit: "none", scale: 2, srcX: 0.5, srcW: 0.5, flip: "xy", drive: "none" }] } },
  "image:opacity": { creative: true, spec: { assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "grid", solid: true }, { type: "image", asset: "photo", opacity: 0.5, drive: "none" }] } },
  "image:smooth": { creative: true, spec: { assets: { alpha: { sha256: ZERO_SHA, width: 48, height: 48 } }, layers: [{ type: "image", asset: "alpha", smoothing: "smooth", scale: 0.9, drive: "none" }] } },
  "image:wrap-scroll": { creative: true, spec: { assets: { tile: { sha256: ZERO_SHA, width: 32, height: 32 } }, layers: [{ type: "image", asset: "tile", fit: "none", scale: 2, wrap: "xy", scrollX: 0.2, scrollY: -0.1, drive: "none" }] } },
  "image:palette-mono": { creative: false, spec: { assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "image", asset: "photo", colour: "palette", drive: "none" }] } },
  "image:palette-roles": { creative: true, spec: { roles: { sky: "#5c94fc", leaf: "#30a050", sand: "#d8a868" }, assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "image", asset: "photo", colour: "palette", drive: "none" }] } },
  "image:asset-creative": { creative: true, spec: { assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "image", asset: "photo", drive: "none" }] } },
  "image:asset-noncreative": { creative: false, spec: { assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "image", asset: "photo", drive: "none" }] } },
  // Sprite sheets (spec 023): the 4-cell in-code sheet played, offset and flipped, held in palette mode.
  "image:sheet-walk": { creative: true, spec: { assets: { sheet: { sha256: ZERO_SHA, width: 64, height: 16 } }, layers: [{ type: "image", asset: "sheet", sheetCols: 4, fps: 8, fit: "none", scale: 4, drive: "none" }] } },
  "image:sheet-start": { creative: true, spec: { assets: { sheet: { sha256: ZERO_SHA, width: 64, height: 16 } }, layers: [{ type: "image", asset: "sheet", sheetCols: 4, fps: 8, frameStart: 2, flip: "x", fit: "none", scale: 4, drive: "none" }] } },
  "image:sheet-fps0": { creative: false, spec: { assets: { sheet: { sha256: ZERO_SHA, width: 64, height: 16 } }, layers: [{ type: "image", asset: "sheet", sheetCols: 4, fps: 0, frameStart: 3, colour: "palette", fit: "none", scale: 4, drive: "none" }] } },
  "image:alpha-over-grid": { creative: true, spec: { assets: { alpha: { sha256: ZERO_SHA, width: 48, height: 48 } }, layers: [{ type: "grid" }, { type: "image", asset: "alpha", fit: "none", scale: 3, drive: "none" }] } },
};

/**
 * Camera cases (spec 016): the shake on a static camera, the shake scaled by
 * depth under parallax, and a pan past the old 0..1 range. The camera values
 * are already valid, so they are used as written.
 */
const still = { frame: 0, zoom: 1, x: 0.5, y: 0.5 };
const CAMERA_CASES: Record<string, { spec: Spec }> = {
  "camera:shake-static": { spec: { camera: { move: "static", from: still, shake: { amp: 0.02, freq: 4 } }, layers: [{ type: "grid" }, { type: "wave" }] } },
  "camera:parallax-shake": { spec: { camera: { move: "parallax", from: still, to: { ...still, frame: 47 }, shake: { amp: 0.03, freq: 3 } }, layers: [{ type: "gridhorizon", depth: 0 }, { type: "figure", depth: 1 }] } },
  "camera:pan-wide": { spec: { camera: { move: "pan", from: still, to: { ...still, frame: 47, x: 1.5 } }, layers: [{ type: "grid" }, { type: "dots" }] } },
};

/**
 * Pixel mode and tone2 cases (spec 026): whole-pixel bars, hbars and rings
 * (#159), image, emitter, particles and a camera pan (#111), and the second
 * tone on bars and rings (#158). Every other case renders without pixelMode.
 */
const PIXEL_CASES: Record<string, { spec: Spec; creative: boolean }> = {
  "bars:pixel": { creative: false, spec: { pixelMode: true, layers: [{ type: "bars" }] } },
  "bars:pixel-middle": { creative: false, spec: { pixelMode: true, layers: [{ type: "bars", baseline: "middle" }] } },
  "hbars:pixel": { creative: false, spec: { pixelMode: true, layers: [{ type: "hbars" }] } },
  "rings:pixel": { creative: false, spec: { pixelMode: true, layers: [{ type: "rings" }] } },
  "rings:pixel-thick": { creative: false, spec: { pixelMode: true, layers: [{ type: "rings", count: 12, thickness: 9 }] } },
  "emitter:pixel-dust": { creative: false, spec: { pixelMode: true, layers: [{ type: "emitter", rate: 120, size: 18 }] } },
  "emitter:pixel-petal": { creative: false, spec: { pixelMode: true, layers: [{ type: "emitter", shape: "petal", rate: 60, life: 3, speed: 0.15, gravity: 0.2, size: 18 }] } },
  "particles:pixel": { creative: false, spec: { pixelMode: true, layers: [{ type: "particles" }] } },
  "image:pixel": { creative: true, spec: { pixelMode: true, assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "image", asset: "photo", fit: "contain", smoothing: "smooth", drive: "none" }] } },
  "camera:pixel-pan": { creative: false, spec: { pixelMode: true, camera: { move: "pan", from: still, to: { ...still, frame: 47, x: 0.63 } }, layers: [{ type: "bars" }, { type: "rings" }] } },
  "bars:tone2-alternate-fg2": { creative: true, spec: { accent: "#ff2d2d", roles: { fg2: "#d8c8a0" }, layers: [{ type: "bars", tone2: "alternate" }] } },
  "bars:tone2-peak": { creative: false, spec: { layers: [{ type: "bars", tone2: "peak" }] } },
  "rings:tone2-alternate-fg2": { creative: true, spec: { pixelMode: true, roles: { fg2: "#d8c8a0" }, layers: [{ type: "rings", tone2: "alternate", count: 6, thickness: 6 }] } },
};

/**
 * Arcade HUD cases (spec 027): versus-bars at full health, after a hit, with no
 * coords (the spectrum fallback) and in creative mode; hud-score in both
 * layouts and with no labels. `data` overrides the frame's coords and labels.
 */
type FrameData = { coords?: Array<{ x: number; y: number }>; labels?: string[] };
const HIT = [{ x: 0.4, y: 0.6 }, { x: 0.8, y: 0.8 }];
const HUD_CASES: Record<string, { spec: Spec; creative: boolean; data: FrameData }> = {
  "versus-bars:full": { creative: false, data: { coords: [{ x: 1, y: 1 }, { x: 1, y: 1 }] }, spec: { layers: [{ type: "versus-bars" }] } },
  "versus-bars:hit": { creative: false, data: { coords: HIT }, spec: { layers: [{ type: "versus-bars" }] } },
  "versus-bars:nodata": { creative: false, data: {}, spec: { layers: [{ type: "versus-bars", angle: 20 }] } },
  "versus-bars:creative": { creative: true, data: { coords: HIT }, spec: { accent: "#e02020", layers: [{ type: "versus-bars", height: 0.08, drive: "none" }] } },
  "hud-score:shooter": { creative: false, data: { labels: ["12340", "50000", "2"] }, spec: { layers: [{ type: "hud-score" }] } },
  "hud-score:versus": { creative: true, data: { coords: HIT, labels: ["98", "ONE", "TWO"] }, spec: { accent: "#e02020", layers: [{ type: "versus-bars" }, { type: "hud-score", layout: "versus" }] } },
  "hud-score:nolabels": { creative: false, data: {}, spec: { layers: [{ type: "hud-score" }] } },
};

/**
 * Palette profile cases (spec 028): a solid Game Boy scene in both tone
 * arrangements and without creative mode (black and white, as without a
 * profile); a genesis scene with an image asset and a checkerboard dither; and
 * dither's 2 × 2 matrix on its own.
 */
const GB_LAYERS: Layer[] = [
  { type: "checker", pattern: "b", size: 20 }, { type: "tetris" }, { type: "bars", heightFrac: 0.3 },
  { type: "dither", colors: "fg2,accent", y0: 0.85, matrix: "2", drive: "none" },
  { type: "sprite", character: "hero", motion: "static", scale: 3, x: 0.2, y: 0.9, reactive: false },
];
const PROFILE_CASES: Record<string, { spec: Spec; creative: boolean }> = {
  "profile:gameboy-light": { creative: true, spec: { background: "white", profile: "gameboy-dmg", pixelMode: true, layers: GB_LAYERS } },
  "profile:gameboy-dark": { creative: true, spec: { profile: "gameboy-dmg", pixelMode: true, layers: GB_LAYERS } },
  "profile:gameboy-mono": { creative: false, spec: { background: "white", profile: "gameboy-dmg", pixelMode: true, layers: GB_LAYERS } },
  "profile:genesis-image": { creative: true, spec: { profile: "genesis", pixelMode: true, accent: "#e02020", roles: { sea: "#2050c8" }, assets: { photo: { sha256: ZERO_SHA, width: 96, height: 64 } }, layers: [{ type: "image", asset: "photo", fit: "cover", drive: "none" }, { type: "dither", colors: "sea,accent", y0: 0.7, matrix: "2", drive: "none" }] } },
  "dither:matrix2": { creative: false, spec: { layers: [{ type: "dither", matrix: "2" }] } },
};

/**
 * Fighter cases (spec 029): the fighter's idle in creative mode, each fighting
 * pose, the player-two variant facing left, and monochrome.
 */
const FIGHTER_ROLES = { ...HERO_ROLES, cloak: "#203870", "cloak-shade": "#152650", gold: "#e0b030", boots: "#c03030", "cloak-alt": "#a03018", "cloak-shade-alt": "#702010", "gold-alt": "#f0f0f0", "boots-alt": "#2050c0" };
const fighter = (extra: Record<string, unknown> = {}): Layer => ({ type: "sprite", character: "fighter", motion: "static", scale: 4, y: 0.55, reactive: false, ...extra }) as Layer;
const FIGHTER_CASES: Record<string, { spec: Spec; creative: boolean }> = {
  "sprite:fighter": { creative: true, spec: { roles: FIGHTER_ROLES, layers: [fighter()] } },
  "sprite:fighter-punch": { creative: true, spec: { roles: FIGHTER_ROLES, layers: [fighter({ pose: "punch" })] } },
  "sprite:fighter-hit": { creative: true, spec: { roles: FIGHTER_ROLES, layers: [fighter({ pose: "hit" })] } },
  "sprite:fighter-ko": { creative: true, spec: { roles: FIGHTER_ROLES, layers: [fighter({ pose: "ko" })] } },
  "sprite:fighter-versus": { creative: true, spec: { roles: FIGHTER_ROLES, layers: [fighter({ x: 0.3, pose: "punch" }), fighter({ x: 0.7, faceLeft: true, variant: "alt", pose: "hit" })] } },
  "sprite:fighter-mono": { creative: false, spec: { roles: FIGHTER_ROLES, layers: [fighter({ pose: "punch" })] } },
};

/**
 * Transparent background cases (spec 017): light and dark ink over a busy
 * monochrome spec, and light ink with an accent in creative mode.
 */
const BACKGROUND_CASES: Record<string, { spec: Spec; creative: boolean }> = {
  "background:transparent-light": { creative: false, spec: { background: "transparent", layers: [{ type: "grid" }, { type: "wave" }, { type: "figure" }] } },
  "background:transparent-dark": { creative: false, spec: { background: "transparent", ink: "dark", layers: [{ type: "grid" }, { type: "wave" }, { type: "figure" }] } },
  "background:transparent-accent": { creative: true, spec: { background: "transparent", accent: "#ff2d2d", layers: [{ type: "rings" }, { type: "wave" }] } },
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

function renderOpts(api: GoldenApi, opts: { reducedFlicker?: boolean; creative?: boolean }): { reducedFlicker: boolean; creative: boolean; seed: number; assets?: Record<string, unknown> } {
  return { reducedFlicker: opts.reducedFlicker ?? true, creative: opts.creative ?? false, seed: SEED, ...(api.assets ? { assets: api.assets } : {}) };
}

function render(api: GoldenApi, spec: Spec, frame: Frame, opts: { reducedFlicker: boolean; creative: boolean }): Uint8ClampedArray {
  const canvas = api.createCanvas(DIMS.width, DIMS.height);
  const ctx = canvas.getContext("2d");
  api.drawSpec(ctx, DIMS, frame, spec, renderOpts(api, opts));
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
  for (const [name, { spec }] of Object.entries(QUOTE_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec }] of Object.entries(RIG_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, steady }] of Object.entries(EMITTER_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative: false, reducedFlicker: true }) });
    }
    if (steady) {
      out.push({ key: `${name}@steady`, rgba: render(api, { ...spec, layers }, { ...frames.mid, index: 150, t: 5 }, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec }] of Object.entries(FIGURE_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec }] of Object.entries(PARAM_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative: false, reducedFlicker: true }) });
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
  for (const [name, { spec }] of Object.entries(CAMERA_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(PATTERN_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative, data }] of Object.entries(HUD_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      const { coords: _c, labels: _l, ...bare } = frame as Frame & { coords?: unknown };
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, { ...bare, ...data } as Frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(FIGHTER_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(PROFILE_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(PIXEL_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(BACKGROUND_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec }] of Object.entries(FONT_CASES)) {
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, spec, frame, { creative: false, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(SEQUENCE_CASES)) {
    const sequence = spec.sequence!.map((c) => ({ ...c, layers: c.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[] }));
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, sequence }, frame, { creative, reducedFlicker: true }) });
    }
  }
  for (const [name, { spec, creative }] of Object.entries(ROLE_CASES)) {
    const layers = spec.layers.map((l) => api.sanitizeLayer(l)).filter((l) => l !== null) as Layer[];
    for (const [fname, frame] of Object.entries(frames)) {
      out.push({ key: `${name}@${fname}`, rgba: render(api, { ...spec, layers }, frame, { creative, reducedFlicker: true }) });
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
 * booleans flip, enums take the first non-default value. `string` params with
 * an `example` take it; others are skipped, as there is no generic non-default
 * to invent for one.
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
    } else if (spec.example !== undefined) {
      out[name] = spec.example;
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
