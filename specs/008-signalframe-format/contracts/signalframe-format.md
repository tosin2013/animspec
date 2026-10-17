# Contract: SignalFrame Track Format

The on-disk form of a whole `SignalFrame` sequence. One file a caller writes and a
renderer reads, with frames byte-identical to passing the same `SignalFrame`s in memory.
Versioned so it can grow without breaking readers.

## Files

| File | Required | Contents |
| --- | --- | --- |
| `<name>.asft` | yes | header + fixed-stride per-frame records (binary, little-endian) |
| `<name>.asft.ndjson` | only when a frame has `labels` or `coords` | sparse, index-keyed NDJSON sidecar |

A track with no `labels`/`coords` anywhere has no sidecar file. The extension and the
magic tag are `ASFT` (AnimSpec Frame Track).

## Header

Fixed 32 bytes, all little-endian.

| Offset | Width | Type | Field | Meaning |
| --- | --- | --- | --- | --- |
| 0 | 4 | bytes | `magic` | `41 53 46 54` = `ASFT` |
| 4 | 2 | u16 | `version` | 1 |
| 6 | 2 | u16 | `reserved` | 0 (readers ignore) |
| 8 | 8 | f64 | `fps` | media-clock frames per second, `> 0` |
| 16 | 8 | u64 | `frameCount` | number of frames |
| 24 | 4 | u32 | `valuesLen` | length of every frame's `values` |
| 28 | 4 | u32 | `spectrumLen` | length of every frame's `spectrum` |

`fps`, `valuesLen` and `spectrumLen` are fixed for the whole track. `values` and
`spectrum` have the same length in every frame (a stated assumption of the format).

## Per-frame record

Fixed stride `16 + 8 * (valuesLen + spectrumLen)` bytes, all little-endian float64.

| Offset | Width | Type | Field |
| --- | --- | --- | --- |
| 0 | 8 | f64 | `amplitude` |
| 8 | 8 | f64 | `energy` |
| 16 | 8·valuesLen | f64[] | `values` |
| 16 + 8·valuesLen | 8·spectrumLen | f64[] | `spectrum` |

Frame *N* (0-based) is at byte offset `32 + N * stride`. The whole file is exactly
`32 + frameCount * stride` bytes — no padding, no footer.

## Derived fields

`index` and `t` are **not stored**. A reader derives:

- `index = N` (the frame's position in the file);
- `t = N / fps` (IEEE float64 division of the stored `fps`).

They cannot disagree because there is one source for each. A conforming writer MUST
serialise frames in index order and MUST NOT rely on a stored `t`; callers that build
`SignalFrame`s in memory should set `t = index / fps` with the same `fps` so a round-trip
is bit-identical.

## Sidecar (NDJSON)

One JSON object per line, only for frames that carry `labels` and/or `coords`, sorted by
`index` ascending:

```json
{"index":3,"labels":["hello","world"],"coords":[{"x":0.5,"y":0.25}]}
```

- `index` is the frame's position, an integer in `[0, frameCount)`.
- `labels` (optional) is an array of strings.
- `coords` (optional) is an array of `{ x: number, y: number }`, finite numbers.
- JSON numbers round-trip IEEE float64 exactly (the shortest round-trippable form), so
  `coords` survive the sidecar losslessly.

A reader ignores no fields; unknown fields on a line are rejected in a future version.

## Precision rule (Principle I)

Every float on disk is **float64**, the exact width of the in-memory `Float64Array`
fields. `amplitude`, `energy`, `values` and `spectrum` round-trip bit-for-bit, and `coords`
round-trip exactly through JSON. Nothing is quantised to float32, because the precision
used on disk is the precision drawn with: a float32 track would render differently from
the float64 `SignalFrame`s it came from.

## Reader validation

A conforming reader MUST reject, rather than guess:

- a file shorter than 32 bytes, or whose magic is not `ASFT`;
- a `version` other than 1 (an unknown version is an error, never a best effort);
- a `fps` that is not a finite number `> 0`;
- a `frameCount` outside the safe-integer range;
- a length that is not exactly `32 + frameCount * stride`;
- a sidecar line that is not valid JSON, lacks a numeric in-range `index`, or carries
  a `labels`/`coords` of the wrong shape.

## Extending the format

A change that alters any stored byte or the derivation rule bumps `version`. A change
that only adds an optional sidecar field (never read by old readers) keeps `version` and
is added under the "readers ignore no fields" rule once adopted. Backward compatibility
is versioned; there is no silent reinterpretation of an existing field.

## What is not here

Audio decoding, FFT and any production of `SignalFrame`s from audio/data/text stay with
the caller. Compression stays out of scope: the format is uncompressed and deterministic.
