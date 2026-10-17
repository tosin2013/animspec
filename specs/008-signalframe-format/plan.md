# Plan: SignalFrame Track Format

## Summary

Add a documented, versioned, on-disk format for a whole `SignalFrame` sequence, plus a
byte-level codec (`encodeSignalTrack` / `decodeSignalTrack`) exported from the public
surface, and a round-trip gate in `npm run verify`. File I/O stays with the caller, so
`src/` keeps no file/network imports.

## Approach

1. **Format contract** (`contracts/signalframe-format.md`): header, fixed-stride float64
   record, sparse NDJSON sidecar, derived `index`/`t`, precision and validation rules.
2. **Codec** (`src/signalframe/index.ts`): encode/decode over `Uint8Array` + sidecar string
   using `DataView` and `JSON`. No new dependency, no ambient randomness, no I/O.
3. **Public surface** (`src/index.ts`): export the codec, the format constants, and the
   `SignalTrack` / `EncodedSignalTrack` types.
4. **Gate** (`scripts/verify-signalframe.ts`): bit-identical round-trip, byte-identical
   render, and corrupt-input rejections; wired into the `verify` chain.
5. **Governance**: constitution amendment (in-scope + Quality Gates + version), ROADMAP row.

## Gates and golden hashes

- **Touched**: `verify` gains one step (`verify:signalframe`). The determinism gate's
  purity scan is unchanged and still passes (the codec has no file/network import).
- **Golden hashes**: **no movement**. The codec does not touch rendering; the reference
  sets are unchanged and no `golden:update` / `golden/CHANGES.md` row is needed.

## Constitution Check (Principle VII)

- **Boundary change**: yes. Exporting `encodeSignalTrack` / `decodeSignalTrack` is a new
  kind of public export; the baseline's in-scope list and Quality Gates table are amended
  in the same change (FR-010).
- **Principles**: I (float64 = precision drawn with; deterministic codec), III (no I/O in
  `src/`), VI (gate runs inside the one offline `verify`), VII (six boundary entries in
  `spec.md`; amendment shipped with the feature).

## Out of scope

Audio decode/FFT, file I/O, compression, and the 008 CLI itself (a later spec).

## Tasks

See `tasks.md`.
