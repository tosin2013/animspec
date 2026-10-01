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
type Spec = { background?: "black" | "white"; accent?: string; layers: Layer[] };
type Frame = {
  index: number; t: number; values: Float64Array; spectrum: Float64Array;
  amplitude: number; energy: number; labels?: string[];
};
type Ctx = { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } };

export interface GoldenApi {
  createCanvas: (w: number, h: number) => { getContext(kind: "2d"): unknown };
  drawSpec: (ctx: any, dims: { width: number; height: number }, frame: any, spec: any, opts: any, caption?: string) => void;
  PRIMITIVES: ReadonlyArray<{ type: string }>;
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
};

function render(api: GoldenApi, spec: Spec, frame: Frame, creative: boolean): string {
  const canvas = api.createCanvas(DIMS.width, DIMS.height);
  const ctx = canvas.getContext("2d");
  api.drawSpec(ctx, DIMS, frame, spec, { reducedFlicker: true, creative, seed: SEED });
  const { data } = (ctx as Ctx).getImageData(0, 0, DIMS.width, DIMS.height);
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** key → sha256 of raw RGBA. Keys: `<primitive>@<frame>` and `<composite>@<frame>`. */
export function computeHashes(api: GoldenApi): Record<string, string> {
  const frames = goldenFrames();
  const out: Record<string, string> = {};
  for (const p of api.PRIMITIVES) {
    for (const [fname, frame] of Object.entries(frames)) {
      out[`${p.type}@${fname}`] = render(api, { layers: [{ type: p.type }] }, frame, false);
    }
  }
  for (const [name, { spec, creative }] of Object.entries(COMPOSITE_SPECS)) {
    for (const [fname, frame] of Object.entries(frames)) {
      out[`${name}@${fname}`] = render(api, spec, frame, creative);
    }
  }
  return out;
}
