/**
 * The gallery thumbnail for one primitive: its validated default layer (or its
 * demo layer, see demos.ts) at the reference "mid" frame. Shared by
 * `gallery:generate`, which writes it, and the registry gate, which checks the
 * committed file is still what the library draws. Generator-only.
 */
import { createCanvas } from "@napi-rs/canvas";
import { sanitizeLayer } from "../../src/primitives/registry.js";
import { drawSpec } from "../../src/specInterpreter.js";
import { goldenAssets, goldenFrames } from "./goldenHashes.js";
import { DEMOS } from "./demos.js";

export const THUMBNAIL_DIMS = { width: 320, height: 180 };

/** RGBA of the thumbnail for `type`, or null when its default layer does not validate. */
export function renderThumbnail(type: string): Uint8ClampedArray | null {
  const base = goldenFrames().mid;
  const demo = DEMOS[type];
  const layer = sanitizeLayer({ type, ...(demo?.layer ?? {}) }) as { type: string; [k: string]: unknown } | null;
  if (!layer) return null;
  const frame = demo
    ? { ...base, index: demo.fullIndex, t: demo.fullIndex / 30, labels: demo.labels, coords: demo.coords }
    : base;
  const ctx = createCanvas(THUMBNAIL_DIMS.width, THUMBNAIL_DIMS.height).getContext("2d");
  drawSpec(ctx, THUMBNAIL_DIMS, frame, { layers: [layer] }, { reducedFlicker: true, creative: false, seed: 12345, assets: goldenAssets(createCanvas as never) as never });
  return ctx.getImageData(0, 0, THUMBNAIL_DIMS.width, THUMBNAIL_DIMS.height).data;
}
