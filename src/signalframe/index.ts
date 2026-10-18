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

/** The parsed 32-byte preamble, plus the stride derived from it. */
export interface SignalTrackHeader {
  version: number;
  fps: number;
  frameCount: number;
  valuesLen: number;
  spectrumLen: number;
  stride: number;
}

/**
 * Parse and validate the header and the total length — the decoder's header
 * stage, shared verbatim by `decodeSignalTrack` and `readSignalTrackHeader` so
 * both reject a corrupt file identically.
 */
function parseHeader(bytes: Uint8Array): SignalTrackHeader {
  if (bytes.byteLength < SIGNAL_TRACK_HEADER_SIZE) throw new Error("SignalTrack: truncated header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

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
  if (bytes.byteLength !== expected) {
    throw new Error(`SignalTrack: length mismatch (expected ${expected}, got ${bytes.byteLength})`);
  }
  return { version, fps, frameCount, valuesLen, spectrumLen, stride };
}

/** The fixed-width float fields of one record, read from `base`. */
function readFrameRecord(view: DataView, base: number, valuesLen: number, spectrumLen: number): Pick<SignalFrame, "amplitude" | "energy" | "values" | "spectrum"> {
  const amplitude = view.getFloat64(base, true);
  const energy = view.getFloat64(base + 8, true);
  const values = new Float64Array(valuesLen);
  for (let i = 0; i < valuesLen; i++) values[i] = view.getFloat64(base + 16 + 8 * i, true);
  const spectrum = new Float64Array(spectrumLen);
  for (let i = 0; i < spectrumLen; i++) spectrum[i] = view.getFloat64(base + 16 + 8 * valuesLen + 8 * i, true);
  return { amplitude, energy, values, spectrum };
}

/** Attach a sidecar entry's optional fields, exactly as the decoder does. */
function withSidecarEntry(frame: SignalFrame, e: SidecarEntry | undefined): SignalFrame {
  return {
    ...frame,
    ...(e?.labels ? { labels: e.labels } : {}),
    ...(e?.coords ? { coords: e.coords } : {}),
  };
}

/**
 * Deserialise a track. Throws on a bad magic, an unsupported version, a
 * length mismatch, or a malformed sidecar, so a corrupt file never renders as
 * a wrong-but-valid track.
 */
export function decodeSignalTrack(encoded: EncodedSignalTrack): SignalTrack {
  const { data, sidecar } = encoded;
  const { fps, frameCount, valuesLen, spectrumLen, stride } = parseHeader(data);
  const extra = indexSignalTrackSidecar(sidecar, frameCount);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const frames: SignalFrame[] = [];
  for (let n = 0; n < frameCount; n++) {
    const record = readFrameRecord(view, SIGNAL_TRACK_HEADER_SIZE + n * stride, valuesLen, spectrumLen);
    frames.push(withSidecarEntry({ index: n, t: n / fps, ...record }, extra.get(n)));
  }
  return { fps, frames };
}

/** One sidecar entry: the optional `labels`/`coords` of the frame it names. */
export type SidecarEntry = { labels?: string[]; coords?: { x: number; y: number }[] };

/** The parsed sidecar: frame index → its optional `labels`/`coords`. */
export type SidecarIndex = Map<number, SidecarEntry>;

/**
 * Parse the NDJSON sidecar once into a per-frame lookup, validating each line
 * exactly as the whole-track decoder does: valid JSON, a numeric in-range
 * `index`, and recognised fields keeping their shapes. A line's unknown fields
 * are ignored — the v1 rule stated in the format contract. `null` yields an
 * empty map.
 */
export function indexSignalTrackSidecar(sidecar: string | null, frameCount: number): SidecarIndex {
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

// ---- per-frame reader (spec 011) -------------------------------------------

/**
 * Parse the 32-byte preamble of a track — the decoder's header stage, so a
 * corrupt file throws here rather than mid-render. Returns the stored fields
 * plus the derived `stride`, everything a caller needs to locate any frame:
 * frame *n* lives at byte offset `SIGNAL_TRACK_HEADER_SIZE + n * stride`.
 * Works on any `Uint8Array` view (a memory-mapped file's `byteOffset` is
 * honoured); no byte outside the view is read.
 */
export function readSignalTrackHeader(bytes: Uint8Array): SignalTrackHeader {
  return parseHeader(bytes);
}

/**
 * Read exactly one frame — the record at `SIGNAL_TRACK_HEADER_SIZE + n *
 * stride` and nothing else — so a caller holding a whole track (or a mapping
 * of one) pays a fixed cost per frame instead of decoding the track. Applies
 * the decoder's validation: the header must match the bytes, `n` must be an
 * integer in `[0, frameCount)`, and a provided sidecar is validated line by
 * line. `sidecar` may be a raw NDJSON string or a pre-parsed `SidecarIndex`
 * (parse once, read many), and may be `null`/`undefined` when the track has
 * no sidecar.
 */
export function readSignalFrame(bytes: Uint8Array, header: SignalTrackHeader, n: number, sidecar?: string | SidecarIndex | null): SignalFrame {
  // Validate these bytes fully and once per read: the passed header must be
  // the header of this track, so a stale or foreign header cannot point a
  // frame read at the wrong record.
  const actual = parseHeader(bytes);
  if (actual.fps !== header.fps || actual.frameCount !== header.frameCount || actual.valuesLen !== header.valuesLen || actual.spectrumLen !== header.spectrumLen || actual.stride !== header.stride) {
    throw new Error("SignalTrack: header does not describe these bytes");
  }
  if (!Number.isInteger(n) || n < 0 || n >= header.frameCount) {
    throw new Error(`SignalTrack: frame index ${n} out of range [0, ${header.frameCount})`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const record = readFrameRecord(view, SIGNAL_TRACK_HEADER_SIZE + n * header.stride, header.valuesLen, header.spectrumLen);
  let e: SidecarEntry | undefined;
  if (sidecar != null) {
    const index = typeof sidecar === "string" ? indexSignalTrackSidecar(sidecar, header.frameCount) : sidecar;
    e = index.get(n);
  }
  return withSidecarEntry({ index: n, t: n / header.fps, ...record }, e);
}
