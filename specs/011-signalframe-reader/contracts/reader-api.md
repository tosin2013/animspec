# Reader API Contract (spec 011)

The public functions this feature adds to `animspec`, and the exact error behaviour a
foreign-language reader must match. Byte layout, precision and versioning rules are the
spec 008 contract (`../../008-signalframe-format/contracts/signalframe-format.md`) and are
unchanged; this file only adds how a track is read frame by frame.

## `readSignalTrackHeader(bytes: Uint8Array): SignalTrackHeader`

Parses the 32-byte preamble. Returns `{ version, fps, frameCount, valuesLen, spectrumLen,
stride }`. Throws (no guessing) when:

| condition | error |
| --- | --- |
| `bytes` shorter than 32 | truncated header |
| magic ≠ `ASFT` | bad magic |
| `version` ≠ 1 | unsupported version |
| `fps` not finite or ≤ 0 | invalid fps |
| `frameCount` not a safe integer ≥ 0 | invalid frame count |
| `bytes.byteLength ≠ 32 + frameCount * stride` | length mismatch |

## `readSignalFrame(bytes, header, n, sidecar?): SignalFrame`

Reads exactly the record at `32 + n·stride … +stride` from the view and returns one
`SignalFrame` (`index = n`, `t = n / fps`, `amplitude`, `energy`, `values`, `spectrum`,
plus `labels`/`coords` when the sidecar has an entry for `n`). Throws when:

| condition | error |
| --- | --- |
| `n` not an integer in `[0, header.frameCount)` | frame index out of range |
| a recognised sidecar field for `n` has the wrong shape | same errors as the decoder |

A sidecar line with an **unknown field is accepted and the field ignored** — the v1 rule.
`sidecar` may be `null`/`undefined`; the frame then never carries `labels`/`coords`.

## `indexSignalTrackSidecar(sidecar: string | null, frameCount: number): SidecarIndex`

Parses the NDJSON once into a `Map<number, { labels?, coords? }>` with the decoder's
validation per line (valid JSON, numeric in-range `index`, well-shaped fields, unknown
keys ignored). `null` yields an empty map.

## View rules

- Every function works on any `Uint8Array` view: `byteOffset` and `byteLength` are
  honoured, the underlying buffer's start is never assumed, and the track is never copied.
- The functions read bytes only; opening, mapping and closing files belong to the caller.

## Versioning

These functions accept only `version` 1. A later version that tightens validation (e.g.
rejecting unknown sidecar fields) bumps `version` and these readers keep rejecting older
and newer files exactly as the whole-track decoder does.
