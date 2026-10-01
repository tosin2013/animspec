import type { CanvasRenderingContext2D } from "@napi-rs/canvas";
import { getPrimitive, type Dimensions, type Palette, type DrawContext } from "./primitives/registry";
import type { SignalFrame } from "./types";

/**
 * AnimSpec interpreter (ADR 0015/0018). A thin dispatcher: it resolves the
 * palette, then draws each layer via its PrimitiveDef in the registry (the
 * single source of truth). `image` is special-cased here — it needs a
 * pre-loaded bitmap and is NOT part of the LLM vocabulary.
 */

export type { Dimensions } from "./primitives/registry";

export interface AnimSpec {
  background?: "black" | "white";
  accent?: string;
  layers: Array<{ type: string; [k: string]: unknown }>;
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
  const dctx: DrawContext = { reducedFlicker: opts.reducedFlicker, seed: opts.seed, text };

  for (const layer of spec.layers ?? []) {
    if (layer.type === "image") {
      drawImage(ctx, dims, frame, layer as { invertOnBeat?: boolean; _bitmap?: unknown });
      continue;
    }
    const def = getPrimitive(layer.type);
    if (def) def.draw(ctx, dims, frame, layer as Record<string, unknown>, palette, dctx);
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
