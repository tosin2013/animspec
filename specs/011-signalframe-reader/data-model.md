# Data Model: SignalFrame Per-Frame Reader

Nothing on disk changes. This model adds the reader-side types, the fixture definition,
and the equivalence invariant that the gate enforces. The on-disk layout is documented in
spec 008 (`../008-signalframe-format/data-model.md`) and is reproduced here only where the
reader touches it.

## New in-memory types (`src/signalframe/index.ts`)

```
SignalTrackHeader (new)
  version: number        // always 1; anything else throws at read time
  fps: number            // stored f64, validated finite > 0
  frameCount: number     // stored u64, required safe integer >= 0
  valuesLen: number      // stored u32
  spectrumLen: number    // stored u32
  stride: number         // derived: 16 + 8 * (valuesLen + spectrumLen)

SidecarIndex (new)
  Map<number, { labels?: string[]; coords?: { x: number; y: number }[] }>
  // built once from the NDJSON sidecar; keys are frame indices in [0, frameCount)
```

`readSignalFrame` returns the existing `SignalFrame` — no new frame type:

```
SignalFrame (existing, src/types.ts)
  index: n               // the n passed in, not a stored value
  t: n / fps             // derived, as everywhere else
  values / spectrum      // Float64Array views' data copied into fresh arrays
  amplitude / energy     // f64 from the record
  labels? / coords?      // from the sidecar index entry for n, when present
```

## What the reader touches

```
main file (.asft), viewed as one Uint8Array (any byteOffset/byteLength)
  [header, 32 bytes]                       ← readSignalTrackHeader validates all 32+ bytes
  [record n, stride bytes] at 32 + n*stride ← readSignalFrame reads exactly this range
```

Validation (identical to `decodeSignalTrack`):

1. at least 32 bytes; magic `ASFT`; `version` = 1;
2. `fps` finite > 0; `frameCount` a safe integer ≥ 0;
3. total length exactly `32 + frameCount * stride`;
4. per frame: `n` an integer in `[0, frameCount)`;
5. sidecar lines: valid JSON, numeric in-range `index`, well-shaped `labels`/`coords`;
   unknown keys ignored (v1 rule — see research R5).

## The conformance fixture

Defined in-repo, encoded once by `encodeSignalTrack`, bytes committed:

```
golden/signalframe/sample.asft           # the bytes
golden/signalframe/sample.asft.ndjson    # the sidecar (exists because one frame carries labels/coords)
```

Sample track definition (fixed, in the gate):

- `fps` = 30; 4 frames; `valuesLen` = `spectrumLen` = 4 (small, so the hex is inspectable);
- amplitude/energy and band values varied per frame (levels span quiet → loud, values not
  all equal, so a stride or order mix-up cannot pass);
- frame 2 carries `labels` and `coords` (exercises the sidecar; frames 0, 1, 3 have no
  entry, exercising sparseness);
- exact float values are pinned in the gate when the fixture is generated; the gate fails
  on any byte, hash or decoded-value drift afterwards.

## Invariants the gate enforces

1. `encodeSignalTrack(sample) ` byte-equals the committed `sample.asft`, and the committed
   file's SHA-256 equals the pinned hash.
2. `decodeSignalTrack` of the committed file yields the pinned header fields and per-frame
   values.
3. For every `n`, `readSignalFrame(bytes, header, n, sidecar)` deep-equals
   `decodeSignalTrack({ data, sidecar }).frames[n]` — same `index`, `t`, and every float.
4. The corrupt-input rejections (bad magic, version, truncation, out-of-range `n`,
   malformed sidecar) throw for both the whole-track and per-frame readers.
5. Nothing that any of this does changes a byte of the format or moves a render hash.
