# Viseme/beat contract (spec 015)

The optional per-frame fields and the ASFT chunk that carries them.

## SignalFrame

- `viseme?: number` — a mouth-shape index 0..14 into the documented set
  `sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, ou`. The library treats it as
  an opaque index; the host computes it (transcript-aligned or model-produced).
- `beat?: number` — an onset strength 0..1 for the frame, also host-computed.

## Track chunk

The header's reserved u16 (offset 6) is a flags word; bit 0 = "extras chunk present".
When set, a trailing `frameCount × 5`-byte block follows the records: `u8 viseme`
(255 = absent) then `f32 beat` (NaN = absent) per frame. Total length
`32 + frameCount·stride + (flags & 1 ? frameCount·5 : 0)`.

- A track with no `viseme`/`beat` writes no chunk and is byte-identical to earlier
  versions; version stays 1.
- Old tracks (no chunk) read back with neither field. Old readers reject chunked tracks
  (forward compatibility is not promised).
- The encoder rejects a `viseme` outside 0..14 and a non-finite `beat`.

## Consumption

`viseme` and `beat` are bindable sources (spec 013): `from: "viseme"` / `from: "beat"`
map the feature through `in`/`out`; a frame without the field falls back to the static
value. Primitives are unchanged.
