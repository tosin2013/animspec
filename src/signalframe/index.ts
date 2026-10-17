/**
 * On-disk SignalFrame track format (specs/008-signalframe-format,
 * contracts/signalframe-format.md). A versioned, byte-level serialisation of a
 * whole `SignalFrame` sequence, so a caller can write a track once and any
 * renderer (the 008 CLI, Motion Studio, golden-test fixtures) can read it.
 *
 * Byte-level by design: the library serialises bytes and the caller does the
 * file I/O, so `src/` keeps no file or network imports (verify-determinism's
 * purity scan). Encode → decode is bit-lossless: every float is stored and read
 * as little-endian float64, exactly the `Float64Array` fields, so a decoded
 * track renders byte-identically to the original frames.
 */

import type { SignalFrame } from "../types.js";

/** Magic bytes that open every track: the ASCII tag `ASFT`. */
export const SIGNAL_TRACK_MAGIC = "ASFT";
/** Current on-disk format version. */
export const SIGNAL_TRACK_VERSION = 1;
/** Size in bytes of the fixed header. */
export const SIGNAL_TRACK_HEADER_SIZE = 32;

/** A whole signal track: one fps plus its frames in index order (0..N-1). */
export interface SignalTrack {
  fps: number;
  frames: SignalFrame[];
}

/**
 * The serialised form: the main binary file plus the optional NDJSON sidecar.
 * `sidecar` is `null` when no frame carries `labels` or `coords`.
 */
export interface EncodedSignalTrack {
  data: Uint8Array;
  sidecar: string | null;
}

const MAGIC = [0x41, 0x53, 0x46, 0x54]; // "ASFT"

/**
 * Serialise a track. `values` and `spectrum` must have a fixed length across
 * every frame (the format's stated assumption). `index` and `t` are not read:
 * they are derived from position and fps so they cannot disagree.
 */
export function encodeSignalTrack(track: SignalTrack): EncodedSignalTrack {
  const { fps, frames } = track;
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("SignalTrack: fps must be a positive finite number");

  const frameCount = frames.length;
  const valuesLen = frameCount > 0 ? frames[0].values.length : 0;
  const spectrumLen = frameCount > 0 ? frames[0].spectrum.length : 0;
  for (const f of frames) {
    if (f.values.length !== valuesLen || f.spectrum.length !== spectrumLen) {
      throw new Error("SignalTrack: values/spectrum length must be fixed across the track");
    }
  }

  const stride = 16 + 8 * (valuesLen + spectrumLen);
  const buffer = new ArrayBuffer(SIGNAL_TRACK_HEADER_SIZE + frameCount * stride);
  const view = new DataView(buffer);

  view.setUint8(0, MAGIC[0]);
  view.setUint8(1, MAGIC[1]);
  view.setUint8(2, MAGIC[2]);
  view.setUint8(3, MAGIC[3]);
  view.setUint16(4, SIGNAL_TRACK_VERSION, true);
  view.setUint16(6, 0, true); // reserved
  view.setFloat64(8, fps, true);
  view.setBigUint64(16, BigInt(frameCount), true);
  view.setUint32(24, valuesLen, true);
  view.setUint32(28, spectrumLen, true);

  for (let n = 0; n < frameCount; n++) {
    const f = frames[n];
    const base = SIGNAL_TRACK_HEADER_SIZE + n * stride;
    view.setFloat64(base, f.amplitude, true);
    view.setFloat64(base + 8, f.energy, true);
    for (let i = 0; i < valuesLen; i++) view.setFloat64(base + 16 + 8 * i, f.values[i], true);
    for (let i = 0; i < spectrumLen; i++) view.setFloat64(base + 16 + 8 * valuesLen + 8 * i, f.spectrum[i], true);
  }

  const lines: string[] = [];
  for (let n = 0; n < frameCount; n++) {
    const f = frames[n];
    if (!f.labels?.length && !f.coords?.length) continue;
    const entry: Record<string, unknown> = { index: n };
    if (f.labels?.length) entry.labels = f.labels;
    if (f.coords?.length) entry.coords = f.coords;
    lines.push(JSON.stringify(entry));
  }

  return { data: new Uint8Array(buffer), sidecar: lines.length > 0 ? `${lines.join("\n")}\n` : null };
}

/**
 * Deserialise a track. Throws on a bad magic, an unsupported version, a
 * length mismatch, or a malformed sidecar, so a corrupt file never renders as
 * a wrong-but-valid track.
 */
export function decodeSignalTrack(encoded: EncodedSignalTrack): SignalTrack {
  const { data, sidecar } = encoded;
  if (data.byteLength < SIGNAL_TRACK_HEADER_SIZE) throw new Error("SignalTrack: truncated header");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (view.getUint8(0) !== MAGIC[0] || view.getUint8(1) !== MAGIC[1] || view.getUint8(2) !== MAGIC[2] || view.getUint8(3) !== MAGIC[3]) {
    throw new Error("SignalTrack: bad magic");
  }
  const version = view.getUint16(4, true);
  if (version !== SIGNAL_TRACK_VERSION) throw new Error(`SignalTrack: unsupported version ${version}`);
  const fps = view.getFloat64(8, true);
  const frameCount = Number(view.getBigUint64(16, true));
  const valuesLen = view.getUint32(24, true);
  const spectrumLen = view.getUint32(28, true);

  if (!Number.isFinite(fps) || fps <= 0) throw new Error("SignalTrack: invalid fps");
  if (!Number.isSafeInteger(frameCount) || frameCount < 0) throw new Error("SignalTrack: invalid frame count");

  const stride = 16 + 8 * (valuesLen + spectrumLen);
  const expected = SIGNAL_TRACK_HEADER_SIZE + frameCount * stride;
  if (data.byteLength !== expected) {
    throw new Error(`SignalTrack: length mismatch (expected ${expected}, got ${data.byteLength})`);
  }

  const extra = parseSidecar(sidecar, frameCount);

  const frames: SignalFrame[] = [];
  for (let n = 0; n < frameCount; n++) {
    const base = SIGNAL_TRACK_HEADER_SIZE + n * stride;
    const amplitude = view.getFloat64(base, true);
    const energy = view.getFloat64(base + 8, true);
    const values = new Float64Array(valuesLen);
    for (let i = 0; i < valuesLen; i++) values[i] = view.getFloat64(base + 16 + 8 * i, true);
    const spectrum = new Float64Array(spectrumLen);
    for (let i = 0; i < spectrumLen; i++) spectrum[i] = view.getFloat64(base + 16 + 8 * valuesLen + 8 * i, true);
    const e = extra.get(n);
    frames.push({
      index: n,
      t: n / fps,
      values,
      spectrum,
      amplitude,
      energy,
      ...(e?.labels ? { labels: e.labels } : {}),
      ...(e?.coords ? { coords: e.coords } : {}),
    });
  }
  return { fps, frames };
}

type SidecarEntry = { labels?: string[]; coords?: { x: number; y: number }[] };

/** Parse the NDJSON sidecar into per-index labels/coords, validating each line. */
function parseSidecar(sidecar: string | null, frameCount: number): Map<number, SidecarEntry> {
  const out = new Map<number, SidecarEntry>();
  if (sidecar == null) return out;
  for (const raw of sidecar.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      throw new Error("SignalTrack: malformed sidecar line");
    }
    if (typeof obj !== "object" || obj === null || typeof (obj as { index?: unknown }).index !== "number") {
      throw new Error("SignalTrack: sidecar entry missing numeric index");
    }
    const idx = (obj as { index: number }).index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= frameCount) {
      throw new Error("SignalTrack: sidecar index out of range");
    }
    const entry: SidecarEntry = {};
    const labels = (obj as { labels?: unknown }).labels;
    if (labels !== undefined) {
      if (!Array.isArray(labels) || labels.some((s) => typeof s !== "string")) throw new Error("SignalTrack: sidecar labels must be strings");
      entry.labels = labels as string[];
    }
    const coords = (obj as { coords?: unknown }).coords;
    if (coords !== undefined) {
      if (
        !Array.isArray(coords) ||
        coords.some((c) => typeof c !== "object" || c === null || !Number.isFinite((c as { x?: unknown }).x) || !Number.isFinite((c as { y?: unknown }).y))
      ) {
        throw new Error("SignalTrack: sidecar coords must be finite {x, y}");
      }
      entry.coords = coords as { x: number; y: number }[];
    }
    out.set(idx, entry);
  }
  return out;
}
