# Data Model: SignalFrame viseme and beat

## SignalFrame (src/types.ts)

```
SignalFrame (extended)
  ... existing fields ...
  viseme?: number   // mouth-shape index, 0..14 (documented 15-class set)
  beat?:   number   // onset strength, 0..1
```

## ASFT chunk (spec 015)

```
header, 32 bytes
  offset 6: flags u16  (bit 0 = extras chunk present)   [was "reserved"]
records: frameCount × stride
extras chunk (when flags bit 0): frameCount × 5 bytes
  per frame: u8 viseme (255 = absent) + f32 beat (NaN = absent)
```

Total length = `32 + frameCount·stride + (flags & 1 ? frameCount·5 : 0)`.

## Evaluation (bindings)

- `from: "viseme"` → `frame.viseme` (a 0..14 numeric feature; absent → static fallback).
- `from: "beat"` → `frame.beat` (0..1; absent → static fallback).

## Invariants the gates enforce

1. `viseme`/`beat` round-trip bit-identically; other fields are unchanged.
2. A track with no `viseme`/`beat` encodes byte-identically to today (no chunk).
3. A bound `rig.mouthOpen` follows `viseme`; `emitter.burst` follows `beat`.
4. The committed fixture's bytes, SHA-256 and decoded values match the pins.
5. Out-of-range `viseme` and non-finite `beat` are rejected by the encoder.
