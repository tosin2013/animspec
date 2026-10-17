# Research: SignalFrame Track Format

Decisions behind the format. Each is a choice with a determinism consequence.

## R1. float64, not float32, on disk

The `SignalFrame` vectors are `Float64Array`. A float32 track would quantise `values` and
`spectrum`, so a decoded track would render differently from the in-memory frames it came
from — breaking the "identical frames" outcome. float64 round-trips bit-for-bit.

**Decision**: float64 everywhere. The issue left float32 open only if the maintainer prefers;
the determinism constraint ("the precision used on disk must be the precision drawn with")
rules it out. No float32.

## R2. Byte-level codec, not a file reader

`scripts/verify-determinism.ts` runs a static scan that flags any file/network import in
`src/` (`fs`, `path`, `http`, `fetch`, ...). A codec that opened files itself would fail
that scan, and narrowing the scan would weaken a gate (forbidden). So the library
serialises **bytes** and the caller does the file I/O, which the constitution already holds
with the caller ("writing frames to image or video files").

**Decision**: `encodeSignalTrack` / `decodeSignalTrack` take and return `Uint8Array` and a
sidecar string. The caller does `fs.writeFileSync` / `fs.readFileSync`.

## R3. Derived `index` and `t`

`t` is stored nowhere; it is `N / fps`. Storing both `index` and `t` would let them
disagree and silently change renders. One source each removes the failure mode.

**Decision**: derive both. A conforming caller sets `t = index / fps` in memory so the
round-trip is exact.

## R4. Sidecar as sparse NDJSON

`labels` and `coords` are optional and variable-length, so a fixed-stride binary record
would waste space and complicate the layout. A separate NDJSON sidecar keeps the binary
fixed-stride (fast random access, the thing parallel chunk workers need) and the optional
fields out of the way. NDJSON is line-oriented, so a reader can stream it.

**Decision**: one sidecar file, one JSON object per line, sparse, sorted by `index`.

## R5. Endianness

arm64 and x64 are both little-endian, and the determinism promise is stated per processor
type. Little-endian matches both targets and is the natural `DataView` default.

**Decision**: little-endian throughout.

## R6. Magic and versioning

A magic tag catches a wrong file type fast; a version field lets the layout evolve without
silent reinterpretation. A future version is an error, never a best effort.

**Decision**: magic `ASFT`, `version` u16 = 1, reserved u16 for future flags.

## R7. frameCount width

Motion Studio's real case is ~85,000 frames; even 24 hours at 60 fps is ~5.2 M — far under
2^32. u64 is future-proof and costs nothing; the reader still requires a safe integer
(≤ 2^53) so `Number` never silently loses precision.

**Decision**: u64 on disk, safe-integer on read.

## R8. No new dependency

`DataView` (native) and `JSON` cover the whole codec. No dependency, so no `NOTICE` change
and no licence question.

**Decision**: zero new dependencies.
