import { createCanvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { mulberry32, mixSeed } from "../rng.js";
import { FONTS } from "../fonts/index.js";
import { getIconBitmap } from "./icons.js";
import { CHARACTERS, SHADE, type Character } from "./sprites.js";
import type { SignalFrame } from "../types.js";

/**
 * Primitive registry (ADR 0018) — the SINGLE source of truth for the AnimSpec
 * vocabulary. Each primitive declares its params + a draw function. The LLM
 * prompt, the JSON schema, the validator, and the interpreter dispatch are all
 * GENERATED from this file, so adding a primitive is one entry (no hand-sync).
 */

export interface Dimensions {
  width: number;
  height: number;
}
export interface Palette {
  bg: string;
  fg: string;
  accent: string;
}
export interface DrawContext {
  reducedFlicker: boolean;
  seed: number;
  text?: string;
  font: string;
}
type Layer = Record<string, unknown>;

export type ParamSpec =
  | { type: "number"; min: number; max: number; default: number; desc?: string }
  | { type: "boolean"; default: boolean; desc?: string }
  | { type: "enum"; values: readonly string[]; default: string; desc?: string }
  | { type: "string"; default: string; maxLen: number; desc?: string };

export type Category = "structure" | "signal-line" | "signal-bars" | "geometry" | "motion" | "text" | "sprite";

export const TIERS = ["core", "extended", "contrib", "legacy"] as const;
export type Tier = (typeof TIERS)[number];

export interface PrimitiveDef {
  type: string;
  category: Category;
  description: string;
  tier: Tier;
  /** The replacement's type; required when `tier` is `legacy`, absent otherwise. */
  replacedBy?: string;
  params: Record<string, ParamSpec>;
  draw: (ctx: CanvasRenderingContext2D, d: Dimensions, f: SignalFrame, l: Layer, p: Palette, x: DrawContext) => void;
}

// ---- helpers -------------------------------------------------------------
const num = (l: Layer, k: string, d: number) => (typeof l[k] === "number" && Number.isFinite(l[k] as number) ? (l[k] as number) : d);
const bool = (l: Layer, k: string) => !!l[k];
const str = (l: Layer, k: string, d: string) => (typeof l[k] === "string" ? (l[k] as string) : d);
const TAU = Math.PI * 2;

/**
 * Deterministic fade/hold alpha for a title card, a pure function of the frame
 * index. `fadeFrames === 0` → always visible. `holdFrames === 0` → fade in then
 * hold forever. Otherwise fade in, hold, fade out, repeat (a self-contained
 * loop). Uses the cycle `fadeFrames + holdFrames + fadeFrames`.
 */
function fadeAlpha(index: number, fadeFrames: number, holdFrames: number): number {
  if (fadeFrames <= 0) return 1;
  if (holdFrames <= 0) return Math.min(1, index / fadeFrames);
  const total = fadeFrames + holdFrames + fadeFrames;
  const p = ((index % total) + total) % total;
  if (p < fadeFrames) return p / fadeFrames;
  if (p < fadeFrames + holdFrames) return 1;
  return Math.max(0, (total - 1 - p) / fadeFrames);
}

// ---- the registry --------------------------------------------------------
/**
 * The current vocabulary version: a whole number. First value: 1, the vocabulary
 * as it stands when this feature ships. It rises by one when a primitive is
 * added; a param or allowed value is added, removed or changed; or a primitive
 * changes tier or replacement (see
 * specs/003-vocab-version-tiers/contracts/vocabulary-version.md).
 */
export const VOCABULARY_VERSION: number = 8;

export const PRIMITIVES: PrimitiveDef[] = [
  // ===== structure =====
  {
    type: "grid",
    tier: "core",
    category: "structure",
    description: "matrix grid of cells lit by the frequency spectrum",
    params: {
      cols: { type: "number", min: 2, max: 200, default: 32 },
      rows: { type: "number", min: 2, max: 200, default: 18 },
      threshold: { type: "number", min: 0, max: 1, default: 0.15 },
      gridlines: { type: "boolean", default: false },
    },
    draw(ctx, d, f, l, p) {
      const cols = num(l, "cols", 32), rows = num(l, "rows", 18);
      const cw = d.width / cols, ch = d.height / rows, spec = f.spectrum, th = num(l, "threshold", 0.15);
      ctx.save();
      // Faint gridlines ALWAYS, so the grid reads as a background texture rather
      // than a solid fill that buries the layers drawn over it. `gridlines: true`
      // makes them bolder.
      ctx.strokeStyle = p.bg === "black"
        ? (bool(l, "gridlines") ? "#333" : "rgba(255,255,255,0.08)")
        : (bool(l, "gridlines") ? "#ccc" : "rgba(0,0,0,0.08)");
      ctx.lineWidth = 1;
      for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, d.height); ctx.stroke(); }
      for (let i = 0; i <= rows; i++) { ctx.beginPath(); ctx.moveTo(0, i * ch); ctx.lineTo(d.width, i * ch); ctx.stroke(); }
      // Lit cells are translucent (bars/waves/etc. show through); only the
      // strongest read solid, and the very strongest take the accent.
      for (let r = 0; r < rows; r++) {
        const rf = rows <= 1 ? 1 : 1 - r / rows;
        for (let c = 0; c < cols; c++) {
          const inten = (spec[Math.floor((c / cols) * spec.length)] || 0) * (0.4 + 0.6 * rf);
          if (inten > th) {
            ctx.globalAlpha = 0.3 + 0.45 * Math.min(1, inten);
            ctx.fillStyle = inten > 0.75 ? p.accent : p.fg;
            ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
          }
        }
      }
      ctx.restore();
    },
  },
  {
    type: "barcode",
    tier: "core",
    category: "structure",
    description: "dense scrolling vertical barcode of the signal",
    params: {
      colW: { type: "number", min: 1, max: 20, default: 3 },
      threshold: { type: "number", min: 0, max: 1, default: 0.5 },
      scroll: { type: "number", min: 0, max: 10, default: 0 },
    },
    draw(ctx, d, f, l, p, x) {
      const colW = num(l, "colW", 3), cols = Math.floor(d.width / colW), v = f.values;
      const scroll = Math.floor(f.index * (num(l, "scroll", 0) || (x.reducedFlicker ? 1 : 2)));
      const th = num(l, "threshold", 0.5) - f.amplitude * 0.3;
      ctx.fillStyle = p.fg;
      for (let c = 0; c < cols; c++) if (v[(c + scroll) % v.length] > th) ctx.fillRect(c * colW, 0, colW - 1, d.height);
    },
  },
  {
    type: "checker",
    tier: "core",
    category: "structure",
    description: "a checkerboard whose squares flip with the spectrum",
    params: { size: { type: "number", min: 8, max: 120, default: 40 }, threshold: { type: "number", min: 0, max: 1, default: 0.4 } },
    draw(ctx, d, f, l, p) {
      const s = num(l, "size", 40), cols = Math.ceil(d.width / s), rows = Math.ceil(d.height / s), spec = f.spectrum, th = num(l, "threshold", 0.4);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const on = (r + c) % 2 === 0;
        const lit = (spec[Math.floor((c / cols) * spec.length)] || 0) > th;
        if (on !== lit) { ctx.fillStyle = p.fg; ctx.fillRect(c * s, r * s, s, s); }
      }
    },
  },

  // ===== signal as bars =====
  {
    type: "bars",
    tier: "core",
    category: "signal-bars",
    description: "vertical magnitude-spectrum bars",
    params: { baseline: { type: "enum", values: ["bottom", "middle"], default: "bottom" }, heightFrac: { type: "number", min: 0.05, max: 1, default: 0.7 } },
    draw(ctx, d, f, l, p) {
      const spec = f.spectrum, n = spec.length, bw = d.width / n, maxH = d.height * num(l, "heightFrac", 0.7), base = str(l, "baseline", "bottom");
      let peak = 0, max = -1; for (let i = 0; i < n; i++) if (spec[i] > max) { max = spec[i]; peak = i; }
      for (let i = 0; i < n; i++) {
        const h = Math.max(spec[i] * maxH, 1), xx = i * bw; ctx.fillStyle = i === peak ? p.accent : p.fg;
        if (base === "middle") ctx.fillRect(xx, d.height / 2 - h / 2, Math.max(bw - 1, 1), h);
        else ctx.fillRect(xx, d.height - h, Math.max(bw - 1, 1), h);
      }
    },
  },
  {
    type: "hbars",
    tier: "core",
    category: "signal-bars",
    description: "horizontal magnitude bars growing from the left edge",
    params: { heightFrac: { type: "number", min: 0.2, max: 1, default: 0.9 } },
    draw(ctx, d, f, l, p) {
      const spec = f.spectrum, n = spec.length, bh = d.height / n, maxW = d.width * num(l, "heightFrac", 0.9);
      for (let i = 0; i < n; i++) { const w = Math.max(spec[i] * maxW, 1); ctx.fillStyle = p.fg; ctx.fillRect(0, i * bh, w, Math.max(bh - 1, 1)); }
    },
  },
  {
    type: "radial",
    tier: "core",
    category: "signal-bars",
    description: "a circular/polar spectrum radiating from the center",
    params: { inner: { type: "number", min: 0.05, max: 0.4, default: 0.12 }, len: { type: "number", min: 0.1, max: 0.5, default: 0.3 } },
    draw(ctx, d, f, l, p) {
      const spec = f.spectrum, n = spec.length, cx = d.width / 2, cy = d.height / 2, minD = Math.min(d.width, d.height);
      const r0 = minD * num(l, "inner", 0.12), rl = minD * num(l, "len", 0.3);
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU - Math.PI / 2, r1 = r0 + spec[i] * rl;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
      }
    },
  },

  // ===== signal as line =====
  {
    type: "wave",
    tier: "core",
    category: "signal-line",
    description: "an oscilloscope/seismograph line of the signal",
    params: { amp: { type: "number", min: 0.05, max: 1, default: 0.6 }, thickness: { type: "number", min: 1, max: 8, default: 2 }, fill: { type: "boolean", default: false } },
    draw(ctx, d, f, l, p) {
      const v = f.values, amp = num(l, "amp", 0.6), cy = d.height / 2;
      ctx.strokeStyle = p.accent; ctx.fillStyle = p.accent; ctx.lineWidth = num(l, "thickness", 2); ctx.beginPath();
      for (let i = 0; i < v.length; i++) { const xx = (i / (v.length - 1)) * d.width, yy = cy + (v[i] - 0.5) * d.height * amp; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      if (bool(l, "fill")) { ctx.lineTo(d.width, d.height); ctx.lineTo(0, d.height); ctx.closePath(); ctx.fill(); } else ctx.stroke();
    },
  },
  {
    type: "lissajous",
    tier: "core",
    category: "signal-line",
    description: "a Lissajous curve traced from the waveform",
    params: { scale: { type: "number", min: 0.2, max: 0.9, default: 0.7 } },
    draw(ctx, d, f, l, p) {
      const v = f.values, cx = d.width / 2, cy = d.height / 2, s = Math.min(d.width, d.height) * 0.5 * num(l, "scale", 0.7);
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < v.length; i++) {
        const a = (i / v.length) * TAU, r = 0.4 + v[i] * 0.6;
        const xx = cx + Math.cos(a * 3 + f.t) * s * r, yy = cy + Math.sin(a * 2 + f.t) * s * r;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    },
  },

  // ===== geometry / objects =====
  {
    type: "particles",
    tier: "core",
    category: "geometry",
    description: "a rotating ring of squares sized by the spectrum",
    params: { count: { type: "number", min: 1, max: 500, default: 96 } },
    draw(ctx, d, f, l, p) {
      const count = num(l, "count", 96), spec = f.spectrum, cx = d.width / 2, cy = d.height / 2, minD = Math.min(d.width, d.height), baseR = minD * 0.12;
      ctx.fillStyle = p.accent;
      for (let i = 0; i < count; i++) {
        const s = spec[Math.floor((i / count) * spec.length)] || 0, a = (i / count) * TAU + f.t * 0.5, r = baseR + s * minD * 0.36;
        const size = 2 + s * 9; ctx.fillRect(cx + Math.cos(a) * r - size / 2, cy + Math.sin(a) * r - size / 2, size, size);
      }
    },
  },
  {
    type: "orbits",
    tier: "core",
    category: "geometry",
    description: "concentric counter-rotating rings of points",
    params: { rings: { type: "number", min: 1, max: 12, default: 5 } },
    draw(ctx, d, f, l, p) {
      const rings = num(l, "rings", 5), cx = d.width / 2, cy = d.height / 2, maxR = Math.min(d.width, d.height) * 0.42 * (0.8 + 0.2 * f.amplitude), spec = f.spectrum;
      ctx.fillStyle = p.accent;
      for (let ring = 1; ring <= rings; ring++) {
        const rr = (ring / rings) * maxR, pts = 8 + ring * 4, speed = (ring % 2 === 0 ? 1 : -1) * (0.2 + ring * 0.1);
        for (let j = 0; j < pts; j++) { const a = (j / pts) * TAU + f.t * speed, size = 2 + (spec[(j * ring) % spec.length] || 0) * 7; ctx.fillRect(cx + Math.cos(a) * rr - size / 2, cy + Math.sin(a) * rr - size / 2, size, size); }
      }
    },
  },
  {
    type: "dots",
    tier: "core",
    category: "geometry",
    description: "a scattered star-field of points keyed to the spectrum (deterministic)",
    params: { count: { type: "number", min: 10, max: 800, default: 240 } },
    draw(ctx, d, f, l, p, x) {
      const count = num(l, "count", 240), rng = mulberry32(mixSeed(x.seed, 1)), spec = f.spectrum;
      ctx.fillStyle = p.fg;
      for (let i = 0; i < count; i++) {
        const px = rng() * d.width, py = rng() * d.height, s = spec[Math.floor(rng() * spec.length)] || 0;
        if (s > 0.1 || rng() > 0.5) { const size = 1 + s * 5; ctx.fillRect(px, py, size, size); }
      }
    },
  },
  {
    type: "shape",
    tier: "core",
    category: "geometry",
    description: "a reactive polygon at center, radius pulsing with amplitude",
    params: { sides: { type: "number", min: 3, max: 12, default: 6 }, size: { type: "number", min: 0.1, max: 0.5, default: 0.3 } },
    draw(ctx, d, f, l, p) {
      const sides = Math.round(num(l, "sides", 6)), cx = d.width / 2, cy = d.height / 2, r = Math.min(d.width, d.height) * num(l, "size", 0.3) * (0.5 + 0.5 * f.amplitude);
      ctx.strokeStyle = p.accent; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= sides; i++) { const a = (i / sides) * TAU + f.t * 0.3; const xx = cx + Math.cos(a) * r, yy = cy + Math.sin(a) * r; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
    },
  },
  {
    type: "rings",
    tier: "core",
    category: "geometry",
    description: "concentric expanding circles that pulse with the beat",
    params: { count: { type: "number", min: 1, max: 12, default: 5 } },
    draw(ctx, d, f, l, p) {
      const count = num(l, "count", 5), cx = d.width / 2, cy = d.height / 2, maxR = Math.min(d.width, d.height) * 0.45;
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      for (let i = 1; i <= count; i++) { const r = ((i / count + f.t * 0.1) % 1) * maxR * (0.6 + 0.4 * f.amplitude); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
    },
  },
  {
    type: "spiral",
    tier: "core",
    category: "geometry",
    description: "a spiral of points winding out from the center",
    params: { points: { type: "number", min: 20, max: 600, default: 200 }, turns: { type: "number", min: 1, max: 12, default: 5 } },
    draw(ctx, d, f, l, p) {
      const pts = num(l, "points", 200), turns = num(l, "turns", 5), cx = d.width / 2, cy = d.height / 2, maxR = Math.min(d.width, d.height) * 0.45;
      ctx.fillStyle = p.fg;
      for (let i = 0; i < pts; i++) { const t = i / pts, a = t * TAU * turns + f.t * 0.5, r = t * maxR; const size = 1 + f.spectrum[Math.floor(t * f.spectrum.length)] * 5; ctx.fillRect(cx + Math.cos(a) * r - size / 2, cy + Math.sin(a) * r - size / 2, size, size); }
    },
  },

  // ===== motion =====
  {
    type: "scan",
    tier: "core",
    category: "motion",
    description: "sweeping scanlines revealed where the signal is high",
    params: { axis: { type: "enum", values: ["h", "v"], default: "h" }, speed: { type: "number", min: 0, max: 10, default: 2 }, threshold: { type: "number", min: 0, max: 1, default: 0.6 } },
    draw(ctx, d, f, l, p, x) {
      const axis = str(l, "axis", "h"), speed = num(l, "speed", 2) || (x.reducedFlicker ? 1 : 2), scroll = Math.floor(f.index * speed), v = f.values, th = num(l, "threshold", 0.6);
      ctx.fillStyle = p.accent;
      if (axis === "h") { for (let y = 0; y < d.height; y += 4) if (v[(Math.floor(y / 4) + scroll) % v.length] > th) ctx.fillRect(0, y, d.width, 1); }
      else { for (let xx = 0; xx < d.width; xx += 4) if (v[(Math.floor(xx / 4) + scroll) % v.length] > th) ctx.fillRect(xx, 0, 1, d.height); }
    },
  },
  {
    type: "flash",
    tier: "core",
    category: "motion",
    description: "a full-frame flash/invert on loud moments (beat)",
    params: { threshold: { type: "number", min: 0.1, max: 1, default: 0.6 } },
    draw(ctx, d, f, l, p, x) {
      if (f.amplitude <= num(l, "threshold", 0.6)) return;
      // On loud moments, in one of three ways per research.md R4:
      // - reducedFlicker on: a soft foreground wash (constitution Principle III —
      //   no strobing; the wash stays on palette in every mode);
      // - reducedFlicker off, monochrome (accent === fg): the full-strength
      //   inversion, byte-identical to the pre-gate behaviour (flash:full pins it);
      // - reducedFlicker off, accent colour: a strong foreground wash instead —
      //   inversion's difference blend produced the accent's complement, which
      //   leaves the palette triangle (the palette gate rejects that).
      if (x.reducedFlicker) {
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = p.fg;
        ctx.fillRect(0, 0, d.width, d.height); ctx.restore();
      } else if (p.accent === p.fg) {
        ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "white";
        ctx.fillRect(0, 0, d.width, d.height);
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = p.fg;
        ctx.fillRect(0, 0, d.width, d.height); ctx.restore();
      }
    },
  },
  {
    type: "sweep",
    tier: "core",
    category: "motion",
    description: "a bright vertical bar sweeping across the frame",
    params: { speed: { type: "number", min: 0.2, max: 6, default: 1.5 }, width: { type: "number", min: 1, max: 30, default: 4 } },
    draw(ctx, d, f, l, p) {
      // The bar's position follows the clock; its width follows loudness, so the
      // primitive responds to the signal and not only to time.
      const w = num(l, "width", 4) * (0.5 + f.amplitude), x = ((f.t * num(l, "speed", 1.5) * 0.25) % 1) * d.width; ctx.fillStyle = p.accent; ctx.fillRect(x, 0, w, d.height);
    },
  },
  {
    type: "noise",
    tier: "core",
    category: "motion",
    description: "deterministic seeded digital noise gated by energy",
    params: { density: { type: "number", min: 0, max: 1, default: 0.4 } },
    draw(ctx, d, f, l, p, x) {
      const rng = mulberry32(mixSeed(x.seed, f.index)), count = Math.floor(f.energy * 800 * num(l, "density", 0.4) * (x.reducedFlicker ? 0.4 : 1));
      for (let i = 0; i < count; i++) { ctx.fillStyle = rng() > 0.5 ? p.fg : p.bg; const s = rng() * 3 + 1; ctx.fillRect(rng() * d.width, rng() * d.height, s, s); }
    },
  },

  // ===== text =====
  {
    type: "caption",
    tier: "core",
    category: "text",
    description: "a closed-caption box of the active text/label, with optional case, box style and position",
    params: {
      case: { type: "enum", values: ["upper", "asis"], default: "upper", desc: "letter case of the caption text" },
      box: { type: "enum", values: ["solid", "none", "outline"], default: "solid", desc: "treatment of the box behind the text" },
      position: { type: "enum", values: ["bottom", "top", "center"], default: "bottom", desc: "where the caption block sits" },
      maxLines: { type: "number", min: 1, max: 3, default: 3, desc: "most lines to show" },
    },
    draw(ctx, d, _f, l, p, x) {
      const raw = (x.text ?? "").replace(/\s+/g, " ").trim();
      if (!raw) return;
      const text = str(l, "case", "upper") === "asis" ? raw : raw.toUpperCase();
      const box = str(l, "box", "solid");
      const position = str(l, "position", "bottom");
      const maxLines = Math.max(1, Math.min(3, Math.round(num(l, "maxLines", 3))));

      const fs = Math.max(18, Math.round(d.height / 26));
      ctx.font = `${fs}px ${x.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxW = d.width * 0.8;
      const words = text.split(" ");
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);

      const shown = lines.slice(-maxLines);
      const lineH = Math.round(fs * 1.5);
      const padX = fs * 0.5;
      const cx = d.width / 2;
      const blockH = shown.length * lineH;
      const blockTop = position === "top" ? fs : position === "center" ? (d.height - blockH) / 2 : d.height - fs - blockH;

      for (let i = 0; i < shown.length; i++) {
        const line = shown[i];
        const cy = blockTop + i * lineH + lineH / 2;
        const w = ctx.measureText(line).width;
        const bx = cx - (w + padX * 2) / 2;
        const by = cy - lineH / 2;
        if (box === "solid") {
          ctx.fillStyle = p.bg;
          ctx.fillRect(bx, by, w + padX * 2, lineH);
        } else if (box === "outline") {
          ctx.strokeStyle = p.fg;
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, w + padX * 2, lineH);
        }
        ctx.fillStyle = p.fg;
        ctx.fillText(line, cx, cy);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  },
  {
    type: "rain",
    tier: "core",
    category: "text",
    description: "Matrix-style digital rain of the active text characters",
    params: {},
    draw(ctx, d, f, _l, p, x) {
      const label = (x.text ?? "").replace(/\s+/g, " ").trim(); if (!label) return;
      const fgRGB = p.bg === "black" ? "255,255,255" : "0,0,0", fs = 20, colW = 14, rowH = 22, cols = Math.floor(d.width / colW), rows = Math.ceil(d.height / rowH) + 1, trail = 14, len = label.length;
      ctx.font = `${fs}px ${x.font}`; ctx.textAlign = "center";
      for (let c = 0; c < cols; c++) { const head = (f.index * (0.25 + ((c * 13) % 7) * 0.05) + ((c * 7) % (rows + trail))) % (rows + trail);
        for (let r = 0; r < rows; r++) { const dist = head - r; if (dist < 0 || dist > trail) continue; const ch = label.charAt(((c * 7 + r * 3 + Math.floor(f.index / 15)) % len + len) % len); if (ch === " ") continue; ctx.fillStyle = `rgba(${fgRGB},${(1 - dist / trail).toFixed(3)})`; ctx.fillText(ch, c * colW + colW / 2, r * rowH + fs); } }
      ctx.textAlign = "left";
    },
  },
  {
    type: "text",
    tier: "core",
    category: "text",
    description: "the active label as large centered text",
    params: { pos: { type: "enum", values: ["center", "top", "bottom"], default: "center" } },
    draw(ctx, d, _f, l, p, x) {
      const t = (x.text ?? "").replace(/\s+/g, " ").trim().toUpperCase(); if (!t) return;
      const fs = Math.max(22, Math.round(d.height / 16)); ctx.font = `${fs}px ${x.font}`; ctx.fillStyle = p.accent; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const pos = str(l, "pos", "center"), y = pos === "top" ? d.height * 0.18 : pos === "bottom" ? d.height * 0.82 : d.height / 2;
      ctx.fillText(t.slice(0, 40), d.width / 2, y); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    },
  },
  {
    type: "crosshair",
    tier: "core",
    category: "text",
    description: "a coordinate crosshair + numeric read-out (data-screen)",
    params: {},
    draw(ctx, d, f, _l, p, x) {
      const cx = f.amplitude * d.width, cy = (1 - f.energy) * d.height; ctx.strokeStyle = p.fg; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, d.height); ctx.moveTo(0, cy); ctx.lineTo(d.width, cy); ctx.stroke();
      ctx.fillStyle = p.fg; ctx.font = `12px ${x.font}`; ctx.fillText(`x:${f.amplitude.toFixed(3)} y:${f.energy.toFixed(3)} t:${f.t.toFixed(2)}`, cx + 6, cy - 6);
    },
  },
  {
    type: "led",
    tier: "core",
    category: "text",
    description:
      "an LED dot-matrix sign: scrolling text or a named pixel icon (car, coffee, heart, home, music, ...), with an animated effect that reacts to the audio (glow/pulse/blink/equalize/sparkle/wipe)",
    params: {
      text: { type: "string", default: "", maxLen: 40, desc: "message to scroll; uses the active caption if empty" },
      icon: { type: "string", default: "", maxLen: 24, desc: "a pixel-icon name (pixelarticons), e.g. car, coffee, heart, home, music" },
      scroll: { type: "boolean", default: true, desc: "scroll the text horizontally" },
      effect: {
        type: "enum",
        values: ["glow", "pulse", "blink", "equalize", "sparkle", "wipe", "static"],
        default: "glow",
        desc: "animation: glow=breathe with level, pulse=whole-sign pulse, blink=beat blink, equalize=spectrum VU bars, sparkle=twinkle, wipe=reveal sweep, static=off",
      },
      reactive: { type: "boolean", default: true, desc: "modulate brightness by the audio (off = constant)" },
      sensitivity: { type: "number", min: 0, max: 1, default: 0.6, desc: "how hard the effect reacts to level" },
    },
    draw(ctx, d, f, l, p, x) {
      const rows = 11;
      const cell = Math.max(4, Math.floor(d.height / (rows + 6)));
      const gridCols = Math.floor(d.width / cell);
      const iconName = str(l, "icon", "").trim();
      const effect = str(l, "effect", "glow");
      const reactive = l.reactive === undefined ? true : bool(l, "reactive");
      const sens = num(l, "sensitivity", 0.6);
      const amp = f.amplitude, energy = f.energy, spec = f.spectrum;

      // The text/icon mask: which dots are "on" from the content.
      let mask: (r: number, c: number) => boolean;
      const iconBmp = iconName ? getIconBitmap(iconName, rows) : null;
      if (iconBmp) {
        const ih = iconBmp.length, iw = iconBmp[0].length;
        const offR = Math.floor((rows - ih) / 2), offC = Math.floor((gridCols - iw) / 2);
        mask = (r, c) => {
          const ir = r - offR, ic = c - offC;
          return ir >= 0 && ir < ih && ic >= 0 && ic < iw && iconBmp[ir][ic];
        };
      } else {
        // The dataset's live value/caption wins over any authored/LLM text, so a
        // data-driven sign shows a real read-out (e.g. a magnitude or PPM), not
        // invented words. The `text` param still drives the LED_SIGN feature when
        // no data label is present.
        const content = ((x.text ?? "").trim() || str(l, "text", "") || iconName || "LED").toUpperCase();
        const off = createCanvas(gridCols, rows);
        const octx = off.getContext("2d");
        octx.fillStyle = "black"; octx.fillRect(0, 0, gridCols, rows);
        octx.fillStyle = "white"; octx.font = `${rows}px ${x.font}`; octx.textBaseline = "top";
        const textW = octx.measureText(content).width;
        const sx = bool(l, "scroll") ? gridCols - ((f.index * 0.5) % (textW + gridCols)) : (gridCols - textW) / 2;
        octx.fillText(content, sx, 0);
        const data = octx.getImageData(0, 0, gridCols, rows).data;
        mask = (r, c) => data[(r * gridCols + c) * 4] > 128;
      }

      // Per-dot brightness 0..1 from the signal, per effect. Deterministic:
      // pure functions of (f, x.seed) — no Math.random / Date.now.
      const wipeX = (f.t * 0.6) % 1; // sweep position 0..1 over time
      const lo = x.reducedFlicker ? 0.45 : 0.2; // photosensitivity floor for strobing effects
      const litFor = (r: number, c: number): number => {
        if (effect === "equalize") {
          // The matrix becomes a spectrum VU display; the mask is ignored.
          const bin = Math.floor((c / gridCols) * spec.length);
          return rows - r <= spec[bin] * rows ? 1 : 0;
        }
        if (effect === "sparkle") {
          if (!mask(r, c)) return 0;
          const rr = mulberry32(mixSeed(mixSeed(x.seed, f.index), r * gridCols + c))();
          return rr < 0.3 + (0.7 * energy + 0.3 * amp) * sens ? 1 : lo * 0.6;
        }
        if (!mask(r, c)) return 0;
        if (!reactive) return 1;
        switch (effect) {
          case "pulse": return 0.35 + 0.65 * energy;
          case "blink": return amp > 1 - sens ? 1 : lo;
          case "wipe": return Math.abs(c / gridCols - wipeX) < 0.12 ? 1 : 0.3;
          case "static": return 1;
          case "glow":
          default: return 0.5 + 0.5 * amp;
        }
      };

      // Blend offColor -> lit color by brightness (accent is a hex in creative,
      // else "white"/"black" in mono — so brightness, not hue, carries the animation).
      const toRgb = (col: string): [number, number, number] => {
        if (col === "white") return [255, 255, 255];
        if (col === "black") return [0, 0, 0];
        const n = parseInt(col.replace("#", ""), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      const ox = (d.width - gridCols * cell) / 2, oy = (d.height - rows * cell) / 2, dot = cell - 2;
      const offColor = p.bg === "black" ? "#141414" : "#ececec";
      const [o0, o1, o2] = toRgb(offColor), [l0, l1, l2] = toRgb(p.accent);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < gridCols; c++) {
          const b = Math.max(0, Math.min(1, litFor(r, c)));
          ctx.fillStyle = `rgb(${Math.round(o0 + (l0 - o0) * b)},${Math.round(o1 + (l1 - o1) * b)},${Math.round(o2 + (l2 - o2) * b)})`;
          ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, dot, dot);
        }
    },
  },

  // ===== sprite =====
  {
    type: "sprite",
    tier: "extended",
    category: "sprite",
    description:
      "an animated chunky-pixel character (built-in mascot/bot/ghost, or any named pixel icon) that walks/bounces/orbits, faces its direction of travel, switches to an idle/jump pose, and hops on the beat — a composable actor, quantizes with the retro palette",
    params: {
      character: { type: "string", default: "mascot", maxLen: 24, desc: "built-in multi-pose character: mascot, bot, ghost. Falls back to `icon`, then mascot" },
      icon: { type: "string", default: "", maxLen: 24, desc: "a pixel-icon name (pixelarticons) used as a single-frame sprite when no character matches" },
      scale: { type: "number", min: 2, max: 48, default: 12, desc: "pixels per sprite cell (chunky block size)" },
      motion: { type: "enum", values: ["walk", "static", "bounce", "orbit"], default: "walk", desc: "walk=cross the frame, static=fixed at x/y (idle pose), bounce=side-to-side, orbit=circle the center" },
      speed: { type: "number", min: 0, max: 5, default: 1, desc: "motion speed" },
      x: { type: "number", min: 0, max: 1, default: 0.5, desc: "anchor X for static/bounce center, 0..1" },
      y: { type: "number", min: 0, max: 1, default: 0.72, desc: "ground line / anchor Y, 0..1" },
      animFps: { type: "number", min: 0, max: 24, default: 6, desc: "walk/idle cycle rate in frames per second (0 = hold frame 0)" },
      jump: { type: "boolean", default: true, desc: "hop upward (and switch to the jump pose) on loud beats" },
      reactive: { type: "boolean", default: true, desc: "react to the audio (bob + jump); off = a steady march" },
      faceLeft: { type: "boolean", default: false, desc: "initial facing when not moving; travel direction overrides it" },
    },
    draw(ctx, d, f, l, p) {
      const scale = num(l, "scale", 12);
      const reactive = l.reactive === undefined ? true : bool(l, "reactive");

      // Resolve the character's poses. A named character brings walk/idle/jump;
      // otherwise a pixel icon becomes a single-frame walk pose; else mascot.
      const charName = str(l, "character", "mascot").trim().toLowerCase();
      const iconName = str(l, "icon", "").trim();
      let poses: Character = CHARACTERS[charName];
      if (!poses && iconName) {
        const bmp = getIconBitmap(iconName, 14);
        if (bmp) poses = { walk: [bmp.map((row) => row.map((on) => (on ? "B" : ".")).join(""))] };
      }
      if (!poses) poses = CHARACTERS.mascot;

      // Geometry from the walk frame (every pose shares a size).
      const base = poses.walk[0];
      const w = base[0].length * scale, h = base.length * scale;

      // Motion path + horizontal velocity (for facing) — pure functions of f.t.
      const speed = num(l, "speed", 1), cx = d.width / 2, cy = d.height / 2;
      const motion = str(l, "motion", "walk");
      let px: number, py: number, vx: number;
      if (motion === "bounce") {
        px = num(l, "x", 0.5) * d.width - w / 2 + Math.sin(f.t * speed * 2) * d.width * 0.32;
        py = num(l, "y", 0.72) * d.height - h; vx = Math.cos(f.t * speed * 2);
      } else if (motion === "orbit") {
        const rr = Math.min(d.width, d.height) * 0.32;
        px = cx + Math.cos(f.t * speed) * rr - w / 2; py = cy + Math.sin(f.t * speed) * rr - h / 2; vx = -Math.sin(f.t * speed);
      } else if (motion === "static") {
        px = num(l, "x", 0.5) * d.width - w / 2; py = num(l, "y", 0.72) * d.height - h / 2; vx = 0;
      } else {
        px = ((f.t * 120 * speed) % (d.width + w)) - w; py = num(l, "y", 0.72) * d.height - h; vx = 1;
      }

      // Signal reaction: a gentle bob always, a hop on loud beats.
      let airborne = false;
      if (reactive) {
        py += Math.sin(f.t * 6) * scale * 0.5;
        if (bool(l, "jump") && f.amplitude > 0.55) { py -= f.amplitude * h * 0.7; airborne = true; }
      }

      // Pose selection: jump (airborne) > idle (at rest) > walk.
      const cycle = airborne && poses.jump ? [poses.jump] : motion === "static" && poses.idle ? poses.idle : poses.walk;
      const animFps = num(l, "animFps", 6);
      const frame = cycle[animFps > 0 ? Math.floor(f.t * animFps) % cycle.length : 0];
      const rows = frame.length, cols = frame[0].length;

      // Facing: travel direction wins; when at rest, honor faceLeft.
      const faceLeft = Math.abs(vx) > 1e-3 ? vx < 0 : bool(l, "faceLeft");

      // Chunky-pixel blit. Shades read as greys and map cleanly through the
      // ADR 0020 quantizer; the outline uses fg so it holds on either bg.
      for (let r = 0; r < rows; r++) {
        const line = frame[r];
        for (let c = 0; c < cols && c < line.length; c++) {
          const ch = line[c];
          if (ch === ".") continue;
          const drawC = faceLeft ? cols - 1 - c : c;
          ctx.fillStyle = ch === "D" ? (p.bg === "black" ? "#3a3a3a" : p.fg) : SHADE[ch] ?? p.fg;
          ctx.fillRect(Math.round(px + drawC * scale), Math.round(py + r * scale), scale, scale);
        }
      }
    },
  },

  // ===== puzzle =====
  {
    type: "tetris",
    tier: "extended",
    category: "structure",
    description:
      "a Game Boy-style tetromino playfield: a stacked block terrain and falling pieces that speed up with the beat — pairs with the gameboy palette",
    params: {
      cols: { type: "number", min: 6, max: 16, default: 10 },
      speed: { type: "number", min: 0.2, max: 4, default: 1 },
      pieces: { type: "number", min: 0, max: 6, default: 3 },
    },
    draw(ctx, d, f, l, p, x) {
      const cols = Math.round(num(l, "cols", 10));
      const cell = Math.floor(Math.min(d.height / 20, d.width / (cols + 2)));
      if (cell < 4) return;
      const rows = Math.floor((d.height * 0.9) / cell);
      const fieldW = cols * cell, fieldH = rows * cell;
      const ox = Math.round((d.width - fieldW) / 2), oy = Math.round((d.height - fieldH) / 2);

      // playfield frame + faint grid
      ctx.strokeStyle = p.fg; ctx.lineWidth = 2; ctx.strokeRect(ox - 2, oy - 2, fieldW + 4, fieldH + 4);
      ctx.strokeStyle = p.bg === "black" ? "#171717" : "#e8e8e8"; ctx.lineWidth = 1;
      for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(ox + c * cell, oy); ctx.lineTo(ox + c * cell, oy + fieldH); ctx.stroke(); }
      for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(ox, oy + r * cell); ctx.lineTo(ox + fieldW, oy + r * cell); ctx.stroke(); }

      // one block, drawn in the classic Game Boy hollow-square style
      const block = (cxi: number, cyi: number, col: string) => {
        if (cxi < 0 || cxi >= cols || cyi < 0 || cyi >= rows) return;
        const bx = ox + cxi * cell, by = oy + cyi * cell;
        ctx.fillStyle = col; ctx.fillRect(bx + 1, by + 1, cell - 2, cell - 2);
        ctx.fillStyle = p.bg; ctx.fillRect(bx + cell * 0.34, by + cell * 0.34, cell * 0.32, cell * 0.32);
      };

      // stacked terrain (seeded, stable): a jagged skyline of locked blocks
      const rng = mulberry32(mixSeed(x.seed, 7));
      for (let c = 0; c < cols; c++) {
        const h = 2 + Math.floor(rng() * Math.max(2, Math.min(9, rows - 5)));
        for (let hh = 0; hh < h; hh++) block(c, rows - 1 - hh, p.accent);
      }

      // falling pieces — the seven tetrominoes, dropping on the media clock
      const SHAPES: number[][][] = [
        [[0, 0], [1, 0], [2, 0], [3, 0]], // I
        [[0, 0], [1, 0], [0, 1], [1, 1]], // O
        [[0, 0], [1, 0], [2, 0], [1, 1]], // T
        [[1, 0], [2, 0], [0, 1], [1, 1]], // S
        [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
        [[0, 0], [0, 1], [1, 1], [2, 1]], // J
        [[2, 0], [0, 1], [1, 1], [2, 1]], // L
      ];
      const npieces = Math.round(num(l, "pieces", 3));
      const speed = num(l, "speed", 1) * (0.5 + 0.9 * f.amplitude);
      const period = rows + 4;
      for (let k = 0; k < npieces; k++) {
        const rk = mulberry32(mixSeed(x.seed, k + 101));
        const shape = SHAPES[Math.floor(rk() * SHAPES.length)];
        const px = Math.floor(rk() * (cols - 3));
        const py = Math.floor((f.t * speed * 3 + k * 7) % period) - 3;
        for (const s of shape) block(px + s[0], py + s[1], p.fg);
      }

      // beat: a faint field flash (like a line clear)
      if (!x.reducedFlicker && f.amplitude > 0.65) { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = p.accent; ctx.fillRect(ox, oy, fieldW, fieldH); ctx.restore(); }
    },
  },

  // ===== 3D (software projection to the 2D canvas) =====
  {
    type: "mesh3d",
    tier: "core",
    category: "geometry",
    description:
      "a rotating 3D wireframe projected to the 2D canvas: a spectrum terrain (waterfall) or a point-cloud globe (uses map coords when present) — driven by the signal",
    params: {
      mode: { type: "enum", values: ["waterfall", "globe"], default: "waterfall" },
      rotate: { type: "number", min: 0, max: 3, default: 0.5 },
      density: { type: "number", min: 16, max: 96, default: 48 },
    },
    draw(ctx, d, f, l, p) {
      const S = Math.min(d.width, d.height);
      const cx = d.width / 2, cy = d.height * 0.55;
      const focal = 1.1, camDist = 3.0, pitch = 0.55;
      const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
      const rot = num(l, "rotate", 0.5);
      const globe = str(l, "mode", "waterfall") === "globe";
      const yaw = globe ? f.t * 0.5 * (0.4 + rot) : Math.sin(f.t * 0.25) * 0.35 * (0.5 + rot);
      const proj = (X: number, Y: number, Z: number): [number, number, number] => {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const xr = X * c - Z * s, zr0 = X * s + Z * c;
        const yr = Y * cosP - zr0 * sinP, zr = Y * sinP + zr0 * cosP;
        const sc = (focal * S) / (zr + camDist);
        return [cx + xr * sc, cy - yr * sc, zr + camDist];
      };
      ctx.strokeStyle = p.accent; ctx.fillStyle = p.accent;
      const spec = f.spectrum, sn = spec.length;

      if (globe) {
        const R = 0.92;
        ctx.lineWidth = 1; ctx.globalAlpha = 0.18;
        for (let la = -60; la <= 60; la += 30) {
          ctx.beginPath();
          for (let lo = 0; lo <= 360; lo += 12) { const lat = (la * Math.PI) / 180, lon = (lo * Math.PI) / 180, cl = Math.cos(lat); const [sx, sy] = proj(R * cl * Math.sin(lon), R * Math.sin(lat), R * cl * Math.cos(lon)); lo === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); }
          ctx.stroke();
        }
        for (let lo = 0; lo < 360; lo += 30) {
          ctx.beginPath();
          for (let la = -90; la <= 90; la += 12) { const lat = (la * Math.PI) / 180, lon = (lo * Math.PI) / 180, cl = Math.cos(lat); const [sx, sy] = proj(R * cl * Math.sin(lon), R * Math.sin(lat), R * cl * Math.cos(lon)); la === -90 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        const pts = f.coords && f.coords.length
          ? f.coords.map((cc) => ({ lon: (cc.x - 0.5) * TAU, lat: (cc.y - 0.5) * Math.PI, v: 0.6 }))
          : Array.from({ length: Math.min(sn, 64) }, (_, i) => { const v = spec[Math.floor((i / 64) * sn)] || 0; return { lon: (i / 64) * TAU, lat: (v - 0.5) * Math.PI, v }; });
        for (const q of pts) {
          const cl = Math.cos(q.lat);
          const [sx, sy, cz] = proj(R * cl * Math.sin(q.lon), R * Math.sin(q.lat), R * cl * Math.cos(q.lon));
          const sz = (2 + 8 * q.v) * (0.7 + 0.5 * f.amplitude);
          ctx.globalAlpha = cz < camDist ? 1 : 0.35;
          ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
      } else {
        const COLS = Math.round(num(l, "density", 48)), ROWS = 40;
        const spanX = 1.9, dz = 0.06, height = 1.0;
        ctx.lineWidth = 1.2;
        for (let r = ROWS - 1; r >= 0; r--) {
          const fade = 1 - r / ROWS;
          ctx.globalAlpha = 0.18 + 0.82 * fade;
          ctx.beginPath();
          for (let c = 0; c < COLS; c++) {
            const sv = spec[Math.floor((c / COLS) * sn)] || 0;
            const wave = 0.5 + 0.5 * Math.sin((c / COLS) * TAU + r * 0.28 - f.t * 2 * (0.5 + rot));
            const y = sv * height * (0.45 + 0.55 * wave) * (0.6 + 0.6 * f.amplitude);
            const [sx, sy] = proj((c / (COLS - 1) - 0.5) * spanX, y, -r * dz);
            c === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    },
  },

  // ===== retro / demoscene (pure sine-math, colorize with a palette) =====
  {
    type: "plasma",
    tier: "extended",
    category: "geometry",
    description: "a flowing demoscene plasma field (grayscale; colorize with a palette such as neon or pico8)",
    params: { scale: { type: "number", min: 4, max: 24, default: 11 }, speed: { type: "number", min: 0.2, max: 4, default: 1.2 } },
    draw(ctx, d, f, l) {
      // One grey value per 8×8 block, computed into a small off-screen image and
      // scaled up with a single nearest-neighbour draw. Pixel-identical to filling
      // each block separately, at one drawing operation instead of tens of thousands.
      const sc = num(l, "scale", 11), sp = num(l, "speed", 1.2), t = f.t * sp, bs = 8;
      const cols = Math.ceil(d.width / bs), rows = Math.ceil(d.height / bs);
      const off = createCanvas(cols, rows), octx = off.getContext("2d");
      const img = octx.createImageData(cols, rows);
      for (let j = 0; j < rows; j++) {
        const y = (j * bs) / d.height;
        for (let i = 0; i < cols; i++) {
          const x = (i * bs) / d.width;
          const v = Math.sin(x * sc + t) + Math.sin(y * sc * 0.9 - t) + Math.sin((x + y) * sc * 0.7 + t) + Math.sin(Math.hypot(x - 0.5, y - 0.5) * sc * 1.4 - t * 1.6);
          const b = Math.min(1, ((v + 4) / 8) * (0.7 + 0.5 * f.amplitude));
          const g = Math.round(b * 255), o = (j * cols + i) * 4;
          img.data[o] = g; img.data[o + 1] = g; img.data[o + 2] = g; img.data[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      const smoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      (ctx as unknown as { drawImage: (img: unknown, x: number, y: number, w: number, h: number) => void }).drawImage(off, 0, 0, cols * bs, rows * bs);
      ctx.imageSmoothingEnabled = smoothing;
    },
  },
  {
    type: "gridhorizon",
    tier: "extended",
    category: "geometry",
    description: "a Tron/synthwave perspective grid receding to a horizon with a sun — pairs with the neon palette",
    params: { speed: { type: "number", min: 0, max: 4, default: 1 } },
    draw(ctx, d, f, l, p) {
      const sp = num(l, "speed", 1);
      const hy = d.height * 0.56, vpx = d.width / 2;
      // The sun pulses with loudness; the grid and horizon follow the clock only.
      const sr = Math.min(d.width, d.height) * 0.16 * (0.85 + 0.3 * f.amplitude), scy = hy - sr * 0.9;
      ctx.save();
      ctx.beginPath(); ctx.arc(vpx, scy, sr, 0, TAU); ctx.clip();
      ctx.fillStyle = p.accent; ctx.fillRect(vpx - sr, scy - sr, sr * 2, sr * 2);
      ctx.fillStyle = p.bg;
      for (let i = 1; i < 6; i++) { const yy = scy + sr * (i / 5); ctx.fillRect(vpx - sr, yy, sr * 2, Math.max(1, sr * 0.04 * i)); }
      ctx.restore();
      ctx.strokeStyle = p.accent; ctx.lineWidth = 1;
      const N = 14;
      for (let i = 1; i <= N; i++) {
        const k = ((i / N) + f.t * 0.15 * sp) % 1;
        const yy = hy + (d.height - hy) * (k * k);
        ctx.globalAlpha = 0.25 + 0.55 * k;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(d.width, yy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let i = -8; i <= 8; i++) {
        const bx = vpx + (i / 8) * d.width * 0.9;
        ctx.beginPath(); ctx.moveTo(vpx, hy); ctx.lineTo(bx, d.height); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(d.width, hy); ctx.stroke();
    },
  },
  {
    type: "tunnel",
    tier: "extended",
    category: "geometry",
    description: "a rotating demoscene tunnel: concentric rings rushing outward with rotating spokes",
    params: { rings: { type: "number", min: 6, max: 40, default: 20 }, speed: { type: "number", min: 0.2, max: 4, default: 1 } },
    draw(ctx, d, f, l, p) {
      const N = Math.round(num(l, "rings", 20)), sp = num(l, "speed", 1);
      const cx = d.width / 2, cy = d.height / 2, maxR = Math.hypot(cx, cy);
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      for (let i = 0; i < N; i++) {
        const k = ((i / N) + f.t * 0.25 * sp * (0.6 + 0.6 * f.amplitude)) % 1;
        const r = k * k * maxR;
        ctx.globalAlpha = 0.15 + 0.7 * (1 - k);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (let s = 0; s < 12; s++) {
        const a = (s / 12) * TAU + f.t * 0.4 * sp;
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    type: "graph",
    tier: "contrib",
    category: "structure",
    description: "a directed network of nodes and edges with packet pulses travelling along the signal",
    params: {
      nodes: { type: "number", min: 3, max: 64, default: 12 },
      topology: { type: "enum", values: ["mesh", "tree", "ring", "random"], default: "mesh" },
      packetSpeed: { type: "number", min: 0.1, max: 5, default: 1 },
      directed: { type: "boolean", default: true },
    },
    draw(ctx, d, f, l, p, x) {
      const n = Math.max(3, Math.round(num(l, "nodes", 12)));
      const topo = str(l, "topology", "mesh");
      const speed = num(l, "packetSpeed", 1);
      const directed = bool(l, "directed");
      const values = f.values, spec = f.spectrum;
      const minD = Math.min(d.width, d.height);
      const rng = mulberry32(mixSeed(x.seed, 0x9a71));
      const prng = mulberry32(mixSeed(x.seed, 0x5eed));

      // ---- node positions: deterministic per topology ----
      const pts: Array<[number, number]> = [];
      const cx = d.width / 2, cy = d.height / 2;
      if (topo === "ring") {
        const r = minD * 0.38;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU - Math.PI / 2;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
      } else if (topo === "tree") {
        const top = d.height * 0.12, bottom = d.height * 0.9, span = d.width * 0.82;
        const maxDepth = Math.max(1, Math.floor(Math.log2(n)));
        for (let i = 0; i < n; i++) {
          const depth = Math.floor(Math.log2(i + 1));
          const atLevel = 1 << depth;
          const idx = i - (atLevel - 1);
          const y = top + (bottom - top) * (depth / maxDepth);
          pts.push([cx + (idx + 0.5 - atLevel / 2) * (span / atLevel), y]);
        }
      } else if (topo === "mesh") {
        const cols = Math.ceil(Math.sqrt(n * (d.width / d.height)));
        const rows = Math.ceil(n / cols);
        const mx = d.width * 0.12, my = d.height * 0.15;
        const cw = (d.width - 2 * mx) / Math.max(1, cols - 1);
        const ch = (d.height - 2 * my) / Math.max(1, rows - 1);
        for (let i = 0; i < n; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          const jx = cols === 1 ? 0 : (rng() - 0.5) * 0.3;
          const jy = rows === 1 ? 0 : (rng() - 0.5) * 0.3;
          pts.push([mx + c * cw + jx * cw, my + r * ch + jy * ch]);
        }
      } else {
        const mx = d.width * 0.1, my = d.height * 0.12;
        for (let i = 0; i < n; i++) pts.push([mx + rng() * (d.width - 2 * mx), my + rng() * (d.height - 2 * my)]);
      }

      // ---- directed edges (source -> target) ----
      const edges: Array<[number, number]> = [];
      if (topo === "ring") {
        for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
      } else if (topo === "tree") {
        for (let i = 1; i < n; i++) edges.push([Math.floor((i - 1) / 2), i]);
      } else if (topo === "mesh") {
        const cols = Math.ceil(Math.sqrt(n * (d.width / d.height)));
        const rows = Math.ceil(n / cols);
        for (let i = 0; i < n; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          if (c + 1 < cols && i + 1 < n) edges.push([i, i + 1]);
          if (r + 1 < rows && i + cols < n) edges.push([i, i + cols]);
        }
      } else {
        for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
        for (let i = 0; i < n; i++) {
          let j = Math.floor(rng() * n);
          if (j === i) j = (j + 1) % n;
          if (j === i + 1) j = (j + 1) % n;
          if (j !== i) edges.push([Math.min(i, j), Math.max(i, j)]);
        }
      }

      // ---- edges: faint always, brighter with an arrowhead when their channel is active ----
      const en = edges.length;
      ctx.lineWidth = 1;
      for (let k = 0; k < en; k++) {
        const [a, b] = edges[k];
        const act = values[k % values.length] || 0;
        const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
        ctx.strokeStyle = p.fg;
        ctx.globalAlpha = 0.1 + 0.5 * act;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        if (directed && act > 0.25) {
          const ang = Math.atan2(by - ay, bx - ax);
          ctx.globalAlpha = 0.3 + 0.7 * act;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - Math.cos(ang - 0.45) * 4, by - Math.sin(ang - 0.45) * 4);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - Math.cos(ang + 0.45) * 4, by - Math.sin(ang + 0.45) * 4);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // ---- nodes, sized by the spectrum and the level ----
      ctx.fillStyle = p.accent;
      for (let i = 0; i < n; i++) {
        const sv = spec[Math.floor((i / n) * spec.length)] || 0;
        const size = Math.max(2, Math.round(2 + sv * (4 + 3 * f.amplitude)));
        ctx.fillRect(pts[i][0] - size / 2, pts[i][1] - size / 2, size, size);
      }

      // ---- packets: one per active edge, travelling source -> target ----
      ctx.fillStyle = p.fg;
      for (let k = 0; k < en; k++) {
        const phase = prng();
        const act = values[k % values.length] || 0;
        if (act < 0.15) continue;
        const [a, b] = edges[k];
        const tt = (f.t * speed * 0.35 + phase) % 1;
        const px = pts[a][0] + (pts[b][0] - pts[a][0]) * tt;
        const py = pts[a][1] + (pts[b][1] - pts[a][1]) * tt;
        const size = Math.max(1, Math.round(1 + 3 * act));
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }
    },
  },
  {
    type: "spectrum",
    tier: "contrib",
    category: "structure",
    description: "a labeled semantic axis: two pole labels, an optional title, and a marker the signal positions",
    params: {
      minLabel: { type: "string", default: "quiet", maxLen: 40, desc: "label at the left pole" },
      maxLabel: { type: "string", default: "loud", maxLen: 40, desc: "label at the right pole" },
      title: { type: "string", default: "", maxLen: 80, desc: "heading drawn above the axis" },
      followSignal: { type: "boolean", default: true, desc: "marker follows the signal amplitude" },
      value: { type: "number", min: 0, max: 1, default: 0.5, desc: "marker position when followSignal is false" },
      markerLabel: { type: "string", default: "", maxLen: 40, desc: "label drawn at the marker" },
      x: { type: "number", min: 0, max: 1, default: 0.5, desc: "axis centre, 0-1 of frame width" },
      y: { type: "number", min: 0, max: 1, default: 0.5, desc: "axis centre, 0-1 of frame height" },
      width: { type: "number", min: 0, max: 1, default: 0.7, desc: "axis length, 0-1 of frame width" },
      labelSize: { type: "number", min: 10, max: 64, default: 26, desc: "label and title size in px" },
    },
    draw(ctx, d, f, l, p, x) {
      const minLabel = str(l, "minLabel", ""), maxLabel = str(l, "maxLabel", "");
      const title = str(l, "title", ""), markerLabel = str(l, "markerLabel", "");
      const followSignal = l.followSignal === undefined ? true : bool(l, "followSignal");
      const t = followSignal ? Math.min(1, Math.max(0, f.amplitude)) : num(l, "value", 0.5);
      const cx = d.width * num(l, "x", 0.5), cy = d.height * num(l, "y", 0.5);
      const half = (d.width * num(l, "width", 0.7)) / 2;
      const x0 = cx - half, x1 = cx + half;
      const fs = Math.max(10, Math.round(num(l, "labelSize", 26)));
      ctx.save();
      // the axis and its pole ticks, in the foreground
      ctx.strokeStyle = p.fg; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, cy - fs * 0.35); ctx.lineTo(x0, cy + fs * 0.35);
      ctx.moveTo(x1, cy - fs * 0.35); ctx.lineTo(x1, cy + fs * 0.35);
      ctx.moveTo(x0, cy); ctx.lineTo(x1, cy);
      ctx.stroke();
      // pole labels and title, also foreground
      ctx.fillStyle = p.fg; ctx.font = `${fs}px ${x.font}`; ctx.textBaseline = "top";
      if (title) { ctx.textAlign = "center"; ctx.fillText(title, cx, cy - fs * 2.6); }
      if (minLabel) { ctx.textAlign = "left"; ctx.fillText(minLabel, x0, cy + fs * 0.6); }
      if (maxLabel) { ctx.textAlign = "right"; ctx.fillText(maxLabel, x1, cy + fs * 0.6); }
      // the marker: the one thing the signal moves
      const mx = x0 + (x1 - x0) * t;
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx, cy - fs * 0.5); ctx.lineTo(mx, cy + fs * 0.5); ctx.stroke();
      if (markerLabel) { ctx.fillStyle = p.accent; ctx.textAlign = "center"; ctx.fillText(markerLabel, mx, cy - fs * 1.6); }
      ctx.restore();
    },
  },
  {
    type: "diagram-build",
    tier: "contrib",
    category: "structure",
    description: "a labeled node-and-edge diagram built stepwise on a deterministic frame schedule, from frame coords/labels",
    params: {
      topology: { type: "enum", values: ["chain", "ring", "mesh", "star"], default: "chain", desc: "how the nodes connect" },
      startFrame: { type: "number", min: 0, max: 1000000, default: 0, desc: "frame the build starts on" },
      framesPerStep: { type: "number", min: 1, max: 600, default: 18, desc: "frames between reveal steps" },
      order: { type: "enum", values: ["nodesThenEdges", "interleaved"], default: "nodesThenEdges", desc: "reveal order" },
      nodeShape: { type: "enum", values: ["box", "circle"], default: "box", desc: "node shape" },
      labelSize: { type: "number", min: 10, max: 64, default: 28, desc: "label size in px" },
    },
    draw(ctx, d, f, l, p, x) {
      const labels = f.labels;
      if (!labels || labels.length === 0) return;
      const n = labels.length;
      const coords = f.coords;
      const topology = str(l, "topology", "chain");
      const startFrame = Math.max(0, num(l, "startFrame", 0));
      const framesPerStep = Math.max(1, num(l, "framesPerStep", 18));
      const order = str(l, "order", "nodesThenEdges");
      const nodeShape = str(l, "nodeShape", "box");
      const fs = Math.max(10, Math.round(num(l, "labelSize", 28)));

      // Node positions: caller coords when present, else a horizontal row.
      const pos = (i: number): [number, number] =>
        coords && i < coords.length
          ? [coords[i].x * d.width, coords[i].y * d.height]
          : [((i + 1) / (n + 1)) * d.width, d.height / 2];

      // Edges by topology, canonical [min, max], in deterministic order.
      const edges: Array<[number, number]> = [];
      if (topology === "star") for (let i = 1; i < n; i++) edges.push([0, i]);
      else if (topology === "ring") { for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]); if (n > 1) edges.push([0, n - 1]); }
      else if (topology === "mesh") for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push([i, j]);
      else for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);

      // Reveal events: nodes one by one, then the edges (or interleaved).
      const events: Array<{ node: number } | { edge: number }> = [];
      if (order === "interleaved") {
        for (let i = 0; i < n; i++) {
          events.push({ node: i });
          for (let e = 0; e < edges.length; e++) if (edges[e][1] === i) events.push({ edge: e });
        }
      } else {
        for (let i = 0; i < n; i++) events.push({ node: i });
        for (let e = 0; e < edges.length; e++) events.push({ edge: e });
      }

      const progress = f.index - startFrame;
      if (progress < 0) return; // before the build starts: an empty field
      const revealed = Math.min(Math.floor(progress / framesPerStep) + 1, events.length);

      const revealedNodes = new Set<number>();
      const revealedEdges = new Set<number>();
      let recent = -1;
      for (let k = 0; k < revealed; k++) {
        const ev = events[k];
        if ("node" in ev) { revealedNodes.add(ev.node); recent = ev.node; }
        else revealedEdges.add(ev.edge);
      }

      // Edges first (thin foreground lines), so node fills cover their ends.
      ctx.strokeStyle = p.fg;
      ctx.lineWidth = 1;
      for (const e of revealedEdges) {
        const [a, b] = edges[e], [ax, ay] = pos(a), [bx, by] = pos(b);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }

      // Nodes: bg-filled, fg-outlined shape + fg label; the newest node is accent.
      ctx.font = `${fs}px ${x.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const i of [...revealedNodes].sort((a, b) => a - b)) {
        const [nx, ny] = pos(i);
        const label = labels[i] ?? "";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = p.bg;
        if (nodeShape === "circle") {
          const r = Math.max(fs * 0.5, tw / 2 + fs * 0.25);
          ctx.beginPath(); ctx.arc(nx, ny, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = i === recent ? p.accent : p.fg; ctx.lineWidth = 2; ctx.stroke();
        } else {
          const pad = fs * 0.35, bw = tw + pad * 2, bh = fs * 1.7;
          ctx.fillRect(nx - bw / 2, ny - bh / 2, bw, bh);
          ctx.strokeStyle = i === recent ? p.accent : p.fg; ctx.lineWidth = 2;
          ctx.strokeRect(nx - bw / 2, ny - bh / 2, bw, bh);
        }
        ctx.fillStyle = p.fg;
        ctx.fillText(label, nx, ny);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  },
  {
    type: "chapter-card",
    tier: "contrib",
    category: "text",
    description: "an editorial title card — kicker, rule, title and optional subtitle — with a deterministic fade/hold rhythm",
    params: {
      kicker: { type: "string", default: "", maxLen: 80, desc: "small overline above the title (accent)" },
      title: { type: "string", default: "", maxLen: 120, desc: "the chapter title; the active label when empty" },
      subtitle: { type: "string", default: "", maxLen: 160, desc: "optional line under the title" },
      fadeFrames: { type: "number", min: 0, max: 120, default: 30, desc: "frames to fade in and out" },
      holdFrames: { type: "number", min: 0, max: 600, default: 90, desc: "frames to hold at full opacity (0 = hold forever)" },
      kickerSize: { type: "number", min: 10, max: 160, default: 28, desc: "kicker font size in px" },
      titleSize: { type: "number", min: 10, max: 160, default: 72, desc: "title font size in px" },
      subtitleSize: { type: "number", min: 10, max: 160, default: 32, desc: "subtitle font size in px" },
    },
    draw(ctx, d, f, l, p, x) {
      const kicker = str(l, "kicker", "");
      const title = str(l, "title", "") || (x.text ?? "").trim();
      const subtitle = str(l, "subtitle", "");
      if (!kicker && !title && !subtitle) return;

      const fadeFrames = Math.max(0, num(l, "fadeFrames", 30));
      const holdFrames = Math.max(0, num(l, "holdFrames", 90));
      const kickerSize = num(l, "kickerSize", 28);
      const titleSize = num(l, "titleSize", 72);
      const subtitleSize = num(l, "subtitleSize", 32);

      const alpha = fadeAlpha(f.index, fadeFrames, holdFrames);
      if (alpha <= 0) return;

      const cx = d.width / 2;

      // The centered stack: kicker (accent), a thin rule, title and subtitle (fg).
      type Row = { kind: "text"; text: string; size: number; color: string } | { kind: "rule" };
      const rows: Row[] = [];
      if (kicker) rows.push({ kind: "text", text: kicker, size: kickerSize, color: p.accent });
      if (kicker && title) rows.push({ kind: "rule" });
      if (title) rows.push({ kind: "text", text: title, size: titleSize, color: p.fg });
      if (subtitle) rows.push({ kind: "text", text: subtitle, size: subtitleSize, color: p.fg });

      const rowH = (r: Row): number => (r.kind === "rule" ? Math.max(12, titleSize * 0.16) : r.size * 1.25);
      const totalH = rows.reduce((s, r) => s + rowH(r), 0);
      let y = (d.height - totalH) / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      for (const r of rows) {
        const h = rowH(r);
        if (r.kind === "rule") {
          ctx.strokeStyle = p.fg;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - d.width * 0.15, y + h / 2);
          ctx.lineTo(cx + d.width * 0.15, y + h / 2);
          ctx.stroke();
        } else {
          ctx.font = `${r.size}px ${x.font}`;
          ctx.fillStyle = r.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(r.text, cx, y + h / 2);
        }
        y += h;
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    },
  },
  {
    type: "type-reveal",
    tier: "contrib",
    category: "text",
    description:
      "kinetic text reveal: the layer's own words (or lines) appear one by one on a frame schedule and then hold, with an optional accent emphasis span",
    params: {
      text: { type: "string", maxLen: 500, default: "", desc: "the text to reveal — the spec carries its own words; the active label when empty" },
      mode: { type: "enum", values: ["word", "line"], default: "word", desc: "reveal one word or one line per step" },
      startFrame: { type: "number", min: 0, max: 1000000, default: 0, desc: "frame the first unit appears" },
      framesPerUnit: { type: "number", min: 1, max: 600, default: 12, desc: "frames between units" },
      fontSize: { type: "number", min: 12, max: 160, default: 48, desc: "base font size in px" },
      emphasisStart: { type: "number", min: -1, max: 10000, default: -1, desc: "first emphasised unit index (-1 = no emphasis)" },
      emphasisEnd: { type: "number", min: -1, max: 10000, default: -1, desc: "last emphasised unit index (-1 = no emphasis)" },
      x: { type: "number", min: 0, max: 1, default: 0.5, desc: "block anchor x, normalised (centre of the wrap box)" },
      y: { type: "number", min: 0, max: 1, default: 0.45, desc: "block anchor y, normalised (centre of the visible block)" },
      align: { type: "enum", values: ["left", "center", "right"], default: "center", desc: "row alignment inside the wrap box" },
      maxWidth: { type: "number", min: 0, max: 1, default: 0.8, desc: "wrap-box width, normalised" },
    },
    draw(ctx, d, f, l, p, x) {
      const raw = str(l, "text", "") || (x.text ?? "").replace(/\s+/g, " ").trim();
      if (!raw.trim()) return;
      const mode = str(l, "mode", "word");
      const units = mode === "line" ? raw.split("\n").map((s) => s.trim()).filter(Boolean) : raw.replace(/\s+/g, " ").trim().split(" ");
      if (!units.length) return;

      const startFrame = num(l, "startFrame", 0);
      const fpu = Math.max(1, num(l, "framesPerUnit", 12));
      const visible = Math.max(0, Math.min(units.length, Math.floor((f.index - startFrame) / fpu) + 1));
      if (visible <= 0) return;

      const fs = Math.max(12, Math.min(160, Math.round(num(l, "fontSize", 48))));
      const maxW = Math.max(0, num(l, "maxWidth", 0.8)) * d.width;
      const align = str(l, "align", "center");
      const ax = num(l, "x", 0.5) * d.width;
      const ay = num(l, "y", 0.45) * d.height;
      const emS = Math.round(num(l, "emphasisStart", -1));
      const emE = Math.round(num(l, "emphasisEnd", -1));
      const emphasised = (i: number) => emS >= 0 && emE >= emS && i >= emS && i <= emE;
      const colour = (i: number) => (emphasised(i) ? p.accent : p.fg);

      ctx.font = `${fs}px ${x.font}`;
      ctx.textBaseline = "middle";
      const lineH = Math.round(fs * 1.4);
      const shown = units.slice(0, visible);
      const boxL = ax - maxW / 2, boxR = ax + maxW / 2;

      // Both modes reduce to rows of units: line mode is one unit per row;
      // word mode wraps the visible words greedily into rows that fit maxW.
      type Row = Array<{ w: string; i: number }>;
      const rows: Row[] = [];
      if (mode === "line") {
        for (let r = 0; r < shown.length; r++) rows.push([{ w: shown[r], i: r }]);
      } else {
        let cur: Row = [];
        for (let i = 0; i < shown.length; i++) {
          const test = [...cur.map((o) => o.w), shown[i]].join(" ");
          if (cur.length && ctx.measureText(test).width > maxW) { rows.push(cur); cur = [{ w: shown[i], i }]; }
          else cur.push({ w: shown[i], i });
        }
        if (cur.length) rows.push(cur);
      }

      const blockH = rows.length * lineH;
      const top = ay - blockH / 2;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const rowW = ctx.measureText(row.map((o) => o.w).join(" ")).width;
        const cy = top + r * lineH + lineH / 2;
        let sx = align === "left" ? boxL : align === "right" ? boxR - rowW : ax - rowW / 2;
        ctx.textAlign = "left";
        for (const { w, i } of row) {
          ctx.fillStyle = colour(i);
          ctx.fillText(w, sx, cy);
          sx += ctx.measureText(`${w} `).width;
        }
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  },
  {
    type: "quote-card",
    tier: "contrib",
    category: "text",
    description:
      "a centered quotation with an attribution line beneath it and an optional thin rule — the quote revealing word by word, the attribution appearing once it completes",
    params: {
      quote: { type: "string", maxLen: 400, default: "", desc: "the quotation — the spec carries its own words; the active label when empty" },
      attribution: { type: "string", maxLen: 120, default: "", desc: "the provenance line under the rule; omitted when empty" },
      reveal: { type: "boolean", default: true, desc: "reveal the quote word by word (false = always show the full card)" },
      framesPerUnit: { type: "number", min: 1, max: 600, default: 14, desc: "frames between words of the quote" },
      quoteSize: { type: "number", min: 10, max: 120, default: 40, desc: "quote font size in px" },
      attrSize: { type: "number", min: 10, max: 120, default: 26, desc: "attribution font size in px" },
      rule: { type: "boolean", default: true, desc: "thin rule between quote and attribution" },
      maxWidth: { type: "number", min: 0, max: 1, default: 0.75, desc: "wrap-box width, normalised" },
    },
    draw(ctx, d, f, l, p, x) {
      const quoteRaw = str(l, "quote", "") || (x.text ?? "").replace(/\s+/g, " ").trim();
      if (!quoteRaw.trim()) return;
      const attribution = str(l, "attribution", "").trim();
      const reveal = bool(l, "reveal");
      const fpu = Math.max(1, num(l, "framesPerUnit", 14));
      const quoteSize = Math.max(10, Math.min(120, Math.round(num(l, "quoteSize", 40))));
      const attrSize = Math.max(10, Math.min(120, Math.round(num(l, "attrSize", 26))));
      const showRule = bool(l, "rule") && !!attribution;
      const maxW = Math.max(0, num(l, "maxWidth", 0.75)) * d.width;

      const words = quoteRaw.replace(/\s+/g, " ").trim().split(" ");
      const visible = reveal ? Math.max(0, Math.min(words.length, Math.floor(f.index / fpu) + 1)) : words.length;
      if (visible <= 0) return;
      // The attribution appears once the quote has finished revealing.
      const attrVisible = !!attribution && (!reveal || f.index >= words.length * fpu);

      ctx.textBaseline = "middle";
      const quoteLineH = Math.round(quoteSize * 1.4);
      const attrLineH = Math.round(attrSize * 1.4);

      // Wrap the visible words of the quote.
      ctx.font = `${quoteSize}px ${x.font}`;
      const shown = words.slice(0, visible);
      const rows: string[] = [];
      let cur = "";
      for (const w of shown) {
        const t = cur ? `${cur} ${w}` : w;
        if (cur && ctx.measureText(t).width > maxW) { rows.push(cur); cur = w; } else cur = t;
      }
      if (cur) rows.push(cur);

      const ruleH = Math.max(10, quoteSize * 0.3);
      const gapH = Math.round(quoteSize * 0.6);
      const attrBlockH = attrVisible ? gapH + (showRule ? ruleH : 0) + gapH + attrLineH : 0;
      const quoteBlockH = rows.length * quoteLineH;
      const totalH = quoteBlockH + attrBlockH;
      const top = (d.height - totalH) / 2;
      const cx = d.width / 2;

      ctx.textAlign = "center";
      ctx.fillStyle = p.fg;
      for (let r = 0; r < rows.length; r++) {
        ctx.fillText(rows[r], cx, top + r * quoteLineH + quoteLineH / 2);
      }

      if (attrVisible) {
        let y = top + quoteBlockH;
        if (showRule) {
          y += gapH;
          ctx.strokeStyle = p.fg;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - d.width * 0.12, y + ruleH / 2);
          ctx.lineTo(cx + d.width * 0.12, y + ruleH / 2);
          ctx.stroke();
          y += ruleH;
        }
        y += gapH;
        ctx.font = `${attrSize}px ${x.font}`;
        ctx.fillStyle = p.accent;
        ctx.fillText(attribution, cx, y + attrLineH / 2);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  },
];

// ---- derived helpers (single source of truth) ---------------------------
export const byType = new Map(PRIMITIVES.map((p) => [p.type, p]));
export const getPrimitive = (type: string): PrimitiveDef | undefined => byType.get(type);
export const allTypes = (): string[] => PRIMITIVES.map((p) => p.type);

/** Clamp/validate one layer against its PrimitiveDef; null drops it. */
export function sanitizeLayer(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Layer;
  const def = typeof l.type === "string" ? byType.get(l.type) : undefined;
  if (!def) return null;
  const out: Record<string, unknown> = { type: def.type };
  for (const [k, spec] of Object.entries(def.params)) {
    const v = l[k];
    if (spec.type === "number") { const n = typeof v === "number" && Number.isFinite(v) ? v : spec.default; out[k] = Math.min(spec.max, Math.max(spec.min, n)); }
    else if (spec.type === "boolean") out[k] = typeof v === "boolean" ? v : spec.default;
    else if (spec.type === "enum") out[k] = spec.values.includes(v as string) ? v : spec.default;
    else out[k] = typeof v === "string" ? v.replace(/[\r\n]+/g, " ").slice(0, spec.maxLen) : spec.default;
  }
  return out;
}

/** One-line vocabulary description of a subset, for the LLM system prompt. */
export function buildVocabPrompt(subset: PrimitiveDef[]): string {
  return subset
    .map((p) => {
      const params = Object.entries(p.params)
        .map(([k, s]) => (s.type === "enum" ? `${k}:${s.values.join("|")}` : k))
        .join(",");
      return `${p.type}{${params}} — ${p.description}`;
    })
    .join("\n");
}

/** JSON schema constraining structured output to a subset's layer types. */
export function buildJsonSchema(subset: PrimitiveDef[]) {
  return {
    type: "object",
    properties: {
      background: { type: "string", enum: ["black", "white"] },
      accent: { type: "string" },
      font: { type: "string", enum: Object.keys(FONTS) },
      layers: {
        type: "array",
        items: { type: "object", properties: { type: { type: "string", enum: subset.map((p) => p.type) } }, required: ["type"] },
      },
    },
    required: ["layers"],
  } as const;
}
