/**
 * The `SignalFrame` contract (ADR 0012). A frame is the deterministic, per-frame
 * payload the primitives draw from, so audio / public-data / transcribed-text
 * sources all drive the same visual algorithms through one contract.
 *
 * The caller turns their signal into `SignalFrame`s; the interpreter only reads
 * them. Reproducibility is the whole point (see verify-determinism).
 */

/** Per-frame payload the primitives draw from. Vectors are normalized 0..1. */
export interface SignalFrame {
  /** Frame index (0-based). */
  index: number;
  /** Media-clock time in seconds (index / fps). */
  t: number;
  /** Primary normalized vector — the "bars/bits/cells" a primitive reads. */
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
