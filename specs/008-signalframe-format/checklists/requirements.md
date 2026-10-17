# Requirements Checklist: SignalFrame Track Format

## Functional requirements

- [x] FR-001 Header with magic `ASFT`, version, `fps`, `frameCount`, `valuesLen`, `spectrumLen`, little-endian.
- [x] FR-002 Per-frame record: `amplitude`, `energy`, `values[]`, `spectrum[]` as little-endian float64, fixed stride.
- [x] FR-003 `index` and `t` derived, never stored.
- [x] FR-004 Sparse NDJSON sidecar for `labels`/`coords`, present only when needed.
- [x] FR-005 Fixed `values`/`spectrum` length across the track.
- [x] FR-006 Byte-level `encodeSignalTrack` / `decodeSignalTrack`; file I/O with the caller.
- [x] FR-007 `decodeSignalTrack` rejects bad magic, unknown version, invalid fps, unsafe frame count, length mismatch, malformed sidecar.
- [x] FR-008 Codec is deterministic and pure (no `Math.random`, `Date`, file or network access).
- [x] FR-009 Round-trip + render-identity + corrupt-input gate runs inside `npm run verify`.
- [x] FR-010 Constitution baseline amended in the same change.

## Success criteria

- [x] SC-001 Synthetic track round-trips bit-identically.
- [x] SC-002 Original vs decoded renders hash identically (100%).
- [x] SC-003 Every corrupt-input case throws.
- [x] SC-004 Purity scan still clean; `npm run verify` passes.
- [x] SC-005 Format documented for an independent Rust implementation.
