# Data Model: SignalFrame Track Format

## In-memory types

```
SignalFrame (existing, src/types.ts)
  index: number            // 0-based frame position
  t: number                // media-clock seconds = index / fps
  values: Float64Array     // primary vector, 0..1
  spectrum: Float64Array   // FFT magnitude bins, 0..1
  amplitude: number        // overall level, 0..1
  energy: number           // mean absolute level, 0..1
  labels?: string[]        // optional read-outs
  coords?: { x, y }[]      // optional positional data

SignalTrack (src/signalframe/index.ts)
  fps: number
  frames: SignalFrame[]    // in index order

EncodedSignalTrack (src/signalframe/index.ts)
  data: Uint8Array         // main binary file
  sidecar: string | null   // NDJSON, null when no frame has labels/coords
```

## On-disk layout

```
main file (.asft)
  [header, 32 bytes]
  [record 0, stride bytes]
  [record 1, stride bytes]
  ...
  [record N-1, stride bytes]

  stride = 16 + 8 * (valuesLen + spectrumLen)

sidecar (.asft.ndjson) — one JSON object per line, sparse
```

## Header (32 bytes, little-endian)

| offset | width | field |
| --- | --- | --- |
| 0 | 4 | magic `ASFT` |
| 4 | 2 | version u16 = 1 |
| 6 | 2 | reserved u16 = 0 |
| 8 | 8 | fps f64 |
| 16 | 8 | frameCount u64 |
| 24 | 4 | valuesLen u32 |
| 28 | 4 | spectrumLen u32 |

## Record (stride bytes, little-endian)

| offset | width | field |
| --- | --- | --- |
| 0 | 8 | amplitude f64 |
| 8 | 8 | energy f64 |
| 16 | 8·valuesLen | values f64[] |
| 16+8·valuesLen | 8·spectrumLen | spectrum f64[] |

## Derived fields

`index = N`, `t = N / fps`. Not stored.

## Invariants

1. `valuesLen` and `spectrumLen` are constant across all frames.
2. File length is exactly `32 + frameCount * stride`.
3. Sidecar `index` is an integer in `[0, frameCount)` and lines are sorted ascending.
4. Every float is float64 — no float32 anywhere.
5. `encode → decode` is bit-lossless for `values`, `spectrum`, `amplitude`, `energy`, and (through JSON) `coords`.
