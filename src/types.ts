/**
 * SignalSource seam (ADR 0012). Generators consume a deterministic, per-frame
 * `SignalFrame` rather than raw audio, so audio / public-data / transcribed-text
 * sources all drive the same four visual algorithms through one contract.
 *
 * `frameAt` MUST be a pure function of (prepared data, index): no `Date.now()`,
 * no `Math.random()`. Reproducibility is the whole point (see verify-determinism).
 */

export type SignalKind = "audio" | "data-live" | "data-pack" | "text";

/** Per-frame payload the generators draw from. Vectors are normalized 0..1. */
export interface SignalFrame {
  /** Frame index (0-based). */
  index: number;
  /** Media-clock time in seconds (index / fps). */
  t: number;
  /** Primary normalized vector — the "bars/bits/cells" a generator reads. */
  values: Float64Array;
  /** Real-FFT magnitude bins (audio) or a synthesized spectrum (data/text). */
  spectrum: Float64Array;
  /** Overall loudness/level, 0..1. */
  amplitude: number;
  /** Mean absolute level, 0..1. */
  energy: number;
  /** Optional numeric-texture read-outs (hex/binary strings, coords, words). */
  labels?: string[];
  /** Optional positional data (e.g. quake lat/long, word layout). */
  coords?: { x: number; y: number }[];
}

export interface SignalSourceMeta {
  kind: SignalKind;
  id: string;
  fps: number;
  duration: number;
  totalFrames: number;
  /** Deterministic seed derived from the source data (drives seeded accents). */
  seed: number;
  /** When true, cap flicker/strobe rate (photosensitivity-safe). Default true. */
  reducedFlicker: boolean;
  /** Optional single accent color (per the datamatics/data-verse lineage). */
  accent?: string;
  /** Attribution/license text, surfaced where required. */
  attribution?: string;
}

export interface SignalSource {
  readonly meta: SignalSourceMeta;
  /** Decode/fetch/transcribe once. May throw (fail loud — ADR 0009 / #7). */
  prepare(): Promise<void>;
  /** Pure: same prepared data + index ⇒ identical frame. */
  frameAt(index: number): SignalFrame;
}

/** Audio timing/format, produced by videoProcessor.analyzeAudio (ffprobe). */
export interface AudioAnalysis {
  duration: number;
  sampleRate: number;
  channels: number;
  fps: number;
}

/** Render-time options threaded from the job into the generators. */
export interface RenderOptions {
  /** Cap inter-frame change / strobe. Default true. */
  reducedFlicker: boolean;
  /** Draw numeric/coordinate read-outs as texture. Default false. */
  numericTexture: boolean;
  /** Single accent color, if any. */
  accent?: string;
  /** AI Mode creative color mode; when false, the spec renders monochrome. */
  creative?: boolean;
  /** Retro color-depth / pixel quantizer (ADR 0020), applied to every finished frame. */
  palette?: string;
  /** Chunky-pixel block size in px (1 or unset = no pixelation). */
  pixel?: number;
  /** Per-channel bit depth 1..8 (retro true-color reduction); ignored if palette set. */
  bits?: number;
  /** Ordered (Bayer) dithering across palette steps. */
  dither?: boolean;
  /** Persistent corner label: the data-source name + attribution (ADR 0014/0022). */
  sourceLabel?: string;
  /** CRT/VHS post-process (scanlines + chromatic aberration + vignette). */
  crt?: boolean;
}
