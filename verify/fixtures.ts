/**
 * Verification fixtures (spec 024): the closed-form signal frames and in-code
 * image assets that both the repository's gates and the published plugin
 * verifier (`animspec/verify`) render with. Dependency-free: everything that
 * draws is injected, so the same code serves any checkout or build.
 */

export type Frame = {
  index: number; t: number; values: Float64Array; spectrum: Float64Array;
  amplitude: number; energy: number; labels?: string[];
  coords?: Array<{ x: number; y: number }>;
};

/**
 * In-code image assets (spec 022) for reference cases and gate probes, drawn
 * with fixed colours on the caller's canvas factory, so no binary fixture is
 * committed. `main` is the gate probe asset (the `image` default id); `tile`
 * is crisp pixel art, `photo` gradients, `alpha` has transparency.
 */
type CanvasLike = { getContext(kind: "2d"): unknown; width: number; height: number };
const ASSET_CACHE = new WeakMap<object, Record<string, CanvasLike>>();
export function goldenAssets(createCanvas: (w: number, h: number) => { getContext(kind: "2d"): unknown }): Record<string, CanvasLike> {
  const hit = ASSET_CACHE.get(createCanvas);
  if (hit) return hit;
  const make = (w: number, h: number, paint: (c: any) => void) => { const cv = createCanvas(w, h) as CanvasLike; paint(cv.getContext("2d")); return cv; };
  const main = make(64, 48, (c) => {
    c.fillStyle = "#c83030"; c.fillRect(0, 0, 32, 24);
    c.fillStyle = "#30a050"; c.fillRect(32, 0, 32, 24);
    c.fillStyle = "#3050c8"; c.fillRect(0, 24, 32, 24);
    c.fillStyle = "#e0c040"; c.fillRect(32, 24, 32, 24);
    for (let i = 0; i < 16; i++) { const v = 40 + i * 12; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(i * 4, 20, 4, 8); }
    c.clearRect(0, 0, 12, 12);
  });
  const tile = make(32, 32, (c) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? "#2a6a2a" : "#8acb4a"; c.fillRect(x * 4, y * 4, 4, 4); }
    c.fillStyle = "#d84a2a"; c.fillRect(0, 0, 12, 4);
  });
  const photo = make(96, 64, (c) => {
    for (let x = 0; x < 96; x++) { c.fillStyle = `rgb(${Math.round(x * 2.6)},${Math.round(120 + x)},${Math.round(220 - x * 2)})`; c.fillRect(x, 0, 1, 40); }
    for (let y = 40; y < 64; y++) { c.fillStyle = `rgb(${200 - (y - 40) * 5},${150 - (y - 40) * 3},${80})`; c.fillRect(0, y, 96, 1); }
  });
  const alpha = make(48, 48, (c) => {
    c.fillStyle = "#f0c8a0"; c.fillRect(8, 8, 32, 32);
    c.fillStyle = "#201010"; c.fillRect(16, 16, 6, 6); c.fillRect(28, 16, 6, 6);
  });
  // Spec 023: a 4-cell sprite sheet (16 × 16 cells); a white "leg" square sits
  // at x = 2 + 3i in cell i, so the cell shown can be read from fixed pixels.
  const sheet = make(64, 16, (c) => {
    ["#c83030", "#30a050", "#3050c8", "#e0c040"].forEach((col, i) => {
      c.fillStyle = col; c.fillRect(i * 16, 0, 16, 16);
      c.fillStyle = "#ffffff"; c.fillRect(i * 16 + 2 + 3 * i, 10, 4, 4);
    });
  });
  const out = { main, tile, photo, alpha, sheet };
  ASSET_CACHE.set(createCanvas, out);
  return out;
}
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

export const GOLDEN_LABEL = "GOLDEN 0123";
export const OTHER_LABEL = "OTHER 9876";

/**
 * A closed-form SignalFrame at the reference times (index 0, 12, 47), scaled by
 * `level` the same way `goldenFrames()` scales its frames: values and spectrum
 * shaped by fixed formulas, amplitude and energy proportional to level. Same
 * inputs ⇒ same pixels, anywhere.
 */
export function signalFrame(timeIndex: 0 | 12 | 47, level: number, label: string): Frame {
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
