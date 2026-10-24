import type { CanvasRenderingContext2D } from "@napi-rs/canvas";
import { applyBindings, getPrimitive, type Dimensions, type Palette, type DrawContext } from "./primitives/registry.js";
import { resolveFontFamily } from "./fonts/index.js";
import { mixSeed, mulberry32 } from "./rng.js";
import type { SignalFrame } from "./types.js";

/**
 * AnimSpec interpreter (ADR 0015/0018). A thin dispatcher: it resolves the
 * palette, then draws each layer via its PrimitiveDef in the registry (the
 * single source of truth). `image` is special-cased here — it needs a
 * pre-loaded bitmap and is NOT part of the LLM vocabulary.
 */

export type { Dimensions } from "./primitives/registry.js";

export interface AnimSpec {
  background?: "black" | "white";
  accent?: string;
  font?: string;
  /** The vocabulary version the spec was written against. The interpreter does not read it. */
  vocabulary?: number;
  camera?: CameraSpec;
  layers: Array<{ type: string; depth?: number; [k: string]: unknown }>;
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
}

export function drawSpec(
  ctx: CanvasRenderingContext2D,
  dims: Dimensions,
  frame: SignalFrame,
  spec: AnimSpec,
  opts: SpecOpts,
  activeCaption?: string,
): void {
  const bg = spec.background === "white" ? "white" : "black";
  const fg = bg === "black" ? "white" : "black";
  const accent = opts.creative && spec.accent ? spec.accent : fg;
  const palette: Palette = { bg, fg, accent };

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, dims.width, dims.height);

  // caption/rain/text layers use an explicit caption, else the data label.
  const text = activeCaption ?? frame.labels?.[0];
  const dctx: DrawContext = { reducedFlicker: opts.reducedFlicker, seed: opts.seed, text, font: resolveFontFamily(spec.font) };

  const cam = spec.camera ? cameraState(spec.camera, frame.index) : null;
  const parallax = spec.camera?.move === "parallax";
  const shake = spec.camera?.shake && spec.camera.shake.amp > 0 ? shakeOffset(spec.camera.shake, frame.t, opts.seed) : null;
  let layerIndex = 0;
  for (const layer of spec.layers ?? []) {
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
      if (shake) ctx.translate(dims.width / 2 + shake.dx * k * dims.width, dims.height / 2 + shake.dy * k * dims.height);
      else ctx.translate(dims.width / 2, dims.height / 2);
      ctx.scale(s, s);
      ctx.translate(-lx * dims.width, -ly * dims.height);
    }
    if (layer.type === "image") {
      drawImage(ctx, dims, frame, layer as { invertOnBeat?: boolean; _bitmap?: unknown });
    } else {
      const def = getPrimitive(layer.type);
      if (def) {
        // Bindings (spec 013): a per-frame view with driven params — the
        // sanitized spec itself is never mutated.
        const view = applyBindings(layer as Record<string, unknown>, def, frame, opts.seed, layerIndex);
        def.draw(ctx, dims, frame, view, palette, dctx);
      }
    }
    if (cam) ctx.restore();
    layerIndex++;
  }
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
