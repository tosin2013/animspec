import { createCanvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { applyBindings, getPrimitive, sanitizeRoles, type Dimensions, type Palette, type DrawContext } from "./primitives/registry.js";
import { resolveFontFamily } from "./fonts/index.js";
import { mixSeed, mulberry32 } from "./rng.js";
import type { SignalFrame } from "./types.js";
import type { AssetImage, AssetRecord } from "./assets.js";

/**
 * AnimSpec interpreter (ADR 0015/0018). A thin dispatcher: it resolves the
 * palette, then draws each layer via its PrimitiveDef in the registry (the
 * single source of truth). `image` is special-cased here — it needs a
 * pre-loaded bitmap and is NOT part of the LLM vocabulary.
 */

export type { Dimensions } from "./primitives/registry.js";

export interface AnimSpec {
  background?: "black" | "white" | "transparent";
  /**
   * Spec 017: with a transparent background, light (default) draws as on black
   * with the black removed; dark draws as on white with the white removed.
   * Ignored otherwise.
   */
  ink?: "light" | "dark";
  accent?: string;
  /** Spec 020: named palette role colours, honoured only in creative mode. */
  roles?: Record<string, string>;
  /** Spec 021: intended pixel shape (height / width), metadata only; never changes a pixel. */
  pixelAspect?: number;
  /**
   * Spec 026: whole-pixel drawing — camera offsets rounded, no smoothing, and
   * whole-pixel edges in bars, hbars, rings, emitter, particles and image.
   */
  pixelMode?: boolean;
  /** Spec 022: declared image assets (id → sha256 and size); the host supplies the bitmaps. */
  assets?: Record<string, AssetRecord>;
  /** Spec 024: plugins the spec uses, each pinned to an exact version. */
  plugins?: Record<string, { version: string }>;
  /**
   * Spec 025: a sequence of clips. Each owns an absolute frame range and
   * renders its own layers and camera with clip-relative time; a transition
   * blends it in from the previous clip. With a sequence, top-level `layers`
   * and `camera` are not used.
   */
  sequence?: Clip[];
  font?: string;
  /** The vocabulary version the spec was written against. The interpreter does not read it. */
  vocabulary?: number;
  camera?: CameraSpec;
  layers: Array<{ type: string; depth?: number; [k: string]: unknown }>;
}

/** A transition into a clip (spec 025): its first `frames` frames blend from the previous clip. */
export interface Transition {
  type: "cut" | "wipe" | "iris" | "fade";
  frames?: number;
  direction?: "left" | "right" | "up" | "down";
}

/** One clip of a sequence (spec 025): frames [from, to), its layers and camera. */
export interface Clip {
  from: number;
  to: number;
  layers: Array<{ type: string; depth?: number; [k: string]: unknown }>;
  camera?: CameraSpec;
  transition?: Transition;
}

/** A camera keyframe: the frame it holds and the state at that frame. */
export interface CameraKeyframe {
  frame: number;
  zoom: number;
  x: number;
  y: number;
}

/** Spec-level camera (spec 014): a two-keyframe move, closed-form per frame. */
export interface CameraSpec {
  move: "static" | "pan" | "zoom" | "push" | "parallax";
  from: CameraKeyframe;
  to?: CameraKeyframe;
  ease?: "linear" | "smooth";
  shake?: CameraShake;
}

/**
 * Camera shake (spec 016). amp: largest offset as a fraction of the frame
 * (0..0.05); freq: base oscillations per second (above 0, at most 5; default 3).
 */
export interface CameraShake {
  amp: number;
  freq: number;
}

const TAU = Math.PI * 2;

/**
 * The shake offset at time t, as a fraction of the frame: two sines per axis at
 * non-harmonic rates with seeded phases, closed-form in t and the seed. Dividing
 * by 1.5 keeps the peak within amp.
 */
export function shakeOffset(shake: CameraShake, t: number, seed: number): { dx: number; dy: number } {
  const rnd = mulberry32(mixSeed(seed, 0x5ea4e));
  const p1 = rnd() * TAU, p2 = rnd() * TAU, p3 = rnd() * TAU, p4 = rnd() * TAU;
  const { amp, freq } = shake;
  return {
    dx: (amp * (Math.sin(TAU * freq * t + p1) + 0.5 * Math.sin(TAU * 2.31 * freq * t + p2))) / 1.5,
    dy: (amp * (Math.sin(TAU * freq * t + p3) + 0.5 * Math.sin(TAU * 2.31 * freq * t + p4))) / 1.5,
  };
}

/** The camera's state at frame n: a pure function of the keyframes. */
export function cameraState(camera: CameraSpec, n: number): { zoom: number; x: number; y: number } {
  const { move, from, to } = camera;
  if (move === "static" || !to) return { zoom: from.zoom, x: from.x, y: from.y };
  const span = to.frame - from.frame;
  const raw = span > 0 ? (n - from.frame) / span : n >= from.frame ? 1 : 0;
  const p = Math.min(1, Math.max(0, raw));
  const e = camera.ease === "smooth" ? p * p * (3 - 2 * p) : p;
  return {
    zoom: move === "pan" ? from.zoom : from.zoom + (to.zoom - from.zoom) * e,
    x: move === "zoom" ? from.x : from.x + (to.x - from.x) * e,
    y: move === "zoom" ? from.y : from.y + (to.y - from.y) * e,
  };
}

export interface SpecOpts {
  reducedFlicker: boolean;
  creative: boolean;
  seed: number;
  /** Spec 022: decoded bitmaps for the spec's declared assets, keyed by id. */
  assets?: Readonly<Record<string, AssetImage>>;
  /**
   * Spec 024: called when a plugin layer throws while drawing. That layer draws
   * nothing for the frame; the rest of the frame renders.
   */
  onLayerError?: (type: string, error: unknown) => void;
}

export function drawSpec(
  ctx: CanvasRenderingContext2D,
  dims: Dimensions,
  frame: SignalFrame,
  spec: AnimSpec,
  opts: SpecOpts,
  activeCaption?: string,
): void {
  // Transparent (spec 017) draws on the source background, then lifts it out.
  const transparent = spec.background === "transparent";
  const dark = transparent && spec.ink === "dark";
  const bg = spec.background === "white" || dark ? "white" : "black";
  const fg = bg === "black" ? "white" : "black";
  const accent = opts.creative && spec.accent ? spec.accent : fg;
  // Named roles (spec 020) reach primitives only in creative mode; without
  // them the palette is exactly the three built-ins.
  const roles = opts.creative && spec.roles !== undefined ? sanitizeRoles(spec.roles).roles : {};
  const palette: Palette = Object.keys(roles).length ? { bg, fg, accent, roles } : { bg, fg, accent };

  // caption/rain/text layers use an explicit caption, else the data label.
  const text = activeCaption ?? frame.labels?.[0];
  const dctx: DrawContext = { reducedFlicker: opts.reducedFlicker, seed: opts.seed, text, font: resolveFontFamily(spec.font), creative: opts.creative, assets: opts.assets, ...(spec.pixelMode === true ? { pixel: true } : {}) };

  if (spec.sequence && spec.sequence.length > 0) renderSequence(ctx, dims, frame, spec.sequence, palette, dctx, opts);
  else renderShot(ctx, dims, frame, spec.layers ?? [], spec.camera, palette, dctx, opts, opts.seed);
  if (transparent) liftBackground(ctx, dims, dark);
}

/** A clip's frame (spec 025): index and time relative to its first frame; the signal stays absolute. */
function clipFrame(frame: SignalFrame, from: number): SignalFrame {
  const index = frame.index - from;
  // t = index / fps for a constant-rate track, so t·(index − from)/index is the
  // clip time without knowing the rate.
  const t = frame.index > 0 ? (frame.t * index) / frame.index : 0;
  return { ...frame, index, t };
}

/** A clip's seed (spec 025), so identical layers in two clips don't repeat exactly. */
const clipSeed = (seed: number, clipIndex: number): number => mixSeed(seed, 0x51 + clipIndex);

/**
 * A sequence frame (spec 025): the clip owning the absolute frame index, or the
 * background alone in a gap. Inside an incoming clip's transition, the outgoing
 * clip (or the background, after a gap) and the incoming clip are rendered
 * off-screen and combined per pixel in integer RGBA, so a wipe or iris pixel is
 * wholly one clip's and a fade is an exact mix, the same on every processor
 * type. A transition composes two shots of this spec inside the render; it is
 * not an effect on a finished frame.
 */
function renderSequence(
  ctx: CanvasRenderingContext2D,
  dims: Dimensions,
  frame: SignalFrame,
  clips: Clip[],
  palette: Palette,
  dctx: DrawContext,
  opts: SpecOpts,
): void {
  const index = frame.index;
  const k = clips.findIndex((c) => index >= c.from && index < c.to);
  if (k < 0) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, dims.width, dims.height);
    return;
  }
  const clip = clips[k];
  const shot = (target: CanvasRenderingContext2D, c: Clip | undefined, ci: number) => {
    if (!c) {
      target.fillStyle = palette.bg;
      target.fillRect(0, 0, dims.width, dims.height);
      return;
    }
    renderShot(target, dims, clipFrame(frame, c.from), c.layers, c.camera, palette, dctx, opts, clipSeed(opts.seed, ci));
  };
  const tr = clip.transition;
  const into = index - clip.from;
  if (!tr || tr.type === "cut" || !tr.frames || into >= tr.frames) {
    shot(ctx, clip, k);
    return;
  }
  // The outgoing shot: the previous clip when it ends exactly where this one
  // starts (it keeps playing under the transition, its clip time advancing);
  // after a gap, the background. A wipe's direction is the way the edge moves:
  // "right" reveals the incoming clip from the left edge.
  const prev = k > 0 ? clips[k - 1] : undefined;
  const { width: W, height: H } = dims;
  const offA = createCanvas(W, H), offB = createCanvas(W, H);
  const ca = offA.getContext("2d"), cb = offB.getContext("2d");
  shot(ca, prev && prev.to === clip.from ? prev : undefined, k - 1);
  shot(cb, clip, k);
  const a = ca.getImageData(0, 0, W, H), b = cb.getImageData(0, 0, W, H);
  const A = a.data, B = b.data;
  const p = (into + 1) / (tr.frames + 1);
  if (tr.type === "fade") {
    for (let i = 0; i < A.length; i++) A[i] = Math.round(A[i] * (1 - p) + B[i] * p);
  } else if (tr.type === "wipe") {
    const dir = tr.direction ?? "right";
    const edgeX = Math.round(p * W), edgeY = Math.round(p * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fromB = dir === "right" ? x < edgeX : dir === "left" ? x >= W - edgeX : dir === "down" ? y < edgeY : y >= H - edgeY;
      if (fromB) { const i = (y * W + x) * 4; A[i] = B[i]; A[i + 1] = B[i + 1]; A[i + 2] = B[i + 2]; A[i + 3] = B[i + 3]; }
    }
  } else {
    const r = p * (Math.hypot(W, H) / 2), r2 = r * r;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
      if (dx * dx + dy * dy < r2) { const i = (y * W + x) * 4; A[i] = B[i]; A[i + 1] = B[i + 1]; A[i + 2] = B[i + 2]; A[i + 3] = B[i + 3]; }
    }
  }
  ctx.putImageData(a, 0, 0);
}

/**
 * One shot (spec 025): the background, then every layer with its camera,
 * bindings and seeds — the whole of a single-shot spec's frame before the
 * transparent lift. A sequence renders one shot per frame, or two during a
 * transition. `seed` is the render seed for a single-shot spec and a per-clip
 * seed inside a sequence.
 */
function renderShot(
  ctx: CanvasRenderingContext2D,
  dims: Dimensions,
  frame: SignalFrame,
  layers: AnimSpec["layers"],
  camera: CameraSpec | undefined,
  palette: Palette,
  dctx: DrawContext,
  opts: SpecOpts,
  seed: number,
): void {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, dims.width, dims.height);

  const cam = camera ? cameraState(camera, frame.index) : null;
  const parallax = camera?.move === "parallax";
  const shake = camera?.shake && camera.shake.amp > 0 ? shakeOffset(camera.shake, frame.t, seed) : null;
  // Pixel mode (spec 026): no smoothing for the frame, and whole-pixel camera offsets.
  const pixel = dctx.pixel === true;
  const smoothing = ctx.imageSmoothingEnabled;
  if (pixel) ctx.imageSmoothingEnabled = false;
  let layerIndex = 0;
  for (const layer of layers) {
    // Camera (spec 014): a transform around the layer, scaled by `depth` only
    // under parallax. Identity without a camera.
    const depth = Math.min(1, Math.max(0, typeof layer.depth === "number" ? layer.depth : 1));
    const s = cam ? (parallax ? 1 + (cam.zoom - 1) * depth : cam.zoom) : 1;
    const lx = cam ? (parallax ? 0.5 + (cam.x - 0.5) * depth : cam.x) : 0.5;
    const ly = cam ? (parallax ? 0.5 + (cam.y - 0.5) * depth : cam.y) : 0.5;
    if (cam) {
      ctx.save();
      // Shake (spec 016) is in frame pixels, before the zoom, scaled by depth
      // under parallax. Without a shake the call is unchanged.
      const k = parallax ? depth : 1;
      if (pixel) {
        // At zoom 1 the net offset is one whole-pixel translate; otherwise each
        // translate is rounded (scaled drawing may still blend; spec 026 edge cases).
        const tx = dims.width / 2 + (shake ? shake.dx * k * dims.width : 0), ty = dims.height / 2 + (shake ? shake.dy * k * dims.height : 0);
        if (s === 1) ctx.translate(Math.round(tx - lx * dims.width), Math.round(ty - ly * dims.height));
        else { ctx.translate(Math.round(tx), Math.round(ty)); ctx.scale(s, s); ctx.translate(Math.round(-lx * dims.width), Math.round(-ly * dims.height)); }
      } else {
        if (shake) ctx.translate(dims.width / 2 + shake.dx * k * dims.width, dims.height / 2 + shake.dy * k * dims.height);
        else ctx.translate(dims.width / 2, dims.height / 2);
        ctx.scale(s, s);
        ctx.translate(-lx * dims.width, -ly * dims.height);
      }
    }
    // Legacy (pre spec 022): a raw layer carrying a pre-loaded `_bitmap` takes
    // the full-frame path. Validated specs never carry it, so `image` layers
    // from a spec always reach the registry primitive.
    if (layer.type === "image" && "_bitmap" in layer) {
      drawImage(ctx, dims, frame, layer as { invertOnBeat?: boolean; _bitmap?: unknown });
    } else {
      const def = getPrimitive(layer.type);
      if (def) {
        // Bindings (spec 013): a per-frame view with driven params — the
        // sanitized spec itself is never mutated.
        const view = applyBindings(layer as Record<string, unknown>, def, frame, seed, layerIndex);
        // Spec 024: a per-layer seed for every layer (core primitives read
        // `seed`). Plugin layers are isolated: a throw draws nothing.
        const lctx: DrawContext = { ...dctx, seed, layerSeed: mixSeed(seed, layerIndex) };
        if (layer.type.startsWith("ext:")) {
          ctx.save();
          try { def.draw(ctx, dims, frame, view, palette, lctx); }
          catch (e) { opts.onLayerError?.(layer.type, e); }
          finally { ctx.restore(); }
        } else {
          def.draw(ctx, dims, frame, view, palette, lctx);
        }
      }
    }
    if (cam) ctx.restore();
    layerIndex++;
  }
  if (pixel) ctx.imageSmoothingEnabled = smoothing;
}

/**
 * Spec 017: un-composite the frame against its source background, so the
 * result laid over that background gives back the solid render (FR-006,
 * FR-007). Light ink lifts black out (alpha = max channel); dark ink lifts
 * white out (alpha = 255 - min channel). The source background becomes alpha 0.
 */
function liftBackground(ctx: CanvasRenderingContext2D, dims: Dimensions, dark: boolean): void {
  const img = ctx.getImageData(0, 0, dims.width, dims.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const a = dark ? 255 - Math.min(r, g, b) : Math.max(r, g, b);
    if (a === 0) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      continue;
    }
    const off = dark ? 255 - a : 0;
    d[i] = Math.round(((r - off) * 255) / a);
    d[i + 1] = Math.round(((g - off) * 255) / a);
    d[i + 2] = Math.round(((b - off) * 255) / a);
    d[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
}

/** Pre-thresholded image drawn each frame (special-cased; not in the registry). */
function drawImage(ctx: CanvasRenderingContext2D, dims: Dimensions, frame: SignalFrame, layer: { invertOnBeat?: boolean; _bitmap?: unknown }): void {
  const bmp = layer._bitmap;
  if (!bmp) return;
  (ctx as unknown as { drawImage: (img: unknown, x: number, y: number, w: number, h: number) => void }).drawImage(bmp, 0, 0, dims.width, dims.height);
  if (layer.invertOnBeat && frame.amplitude > 0.6) {
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, dims.width, dims.height);
    ctx.globalCompositeOperation = "source-over";
  }
}
