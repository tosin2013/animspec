# Research: SignalFrame viseme and beat

## R1. The reserved u16 becomes the flags field

The header already reserves a u16 at offset 6 (written 0). The cleanest way to make an
optional trailing chunk discoverable is to make that field a flags word: bit 0 = "extras
chunk present". No header-size change, no version bump.

**Decision**: `flags = view.getUint16(6)`, bit 0 gates the chunk. A v1 track with no
viseme/beat keeps `flags = 0` and is byte-identical to today.

## R2. The chunk is trailing, fixed per frame, gated by a sentinel

The records are fixed-stride; a trailing chunk after them is invisible to readers that
stop at `32 + frameCount·stride`. Per frame the chunk stores `u8 viseme` (255 = absent)
and `f32 beat` (NaN = absent) — 5 bytes, so `parseHeader` expects
`32 + frameCount·stride + (flag ? frameCount·5 : 0)`.

**Decision**: `frameCount × 5` trailing bytes; sentinels 255 / NaN mark per-frame absence.

## R3. Old tracks stay valid; forward compatibility is not promised

A new reader accepts both old (no flag) and new (flag) tracks. An old reader reading a new
track fails its length check — acceptable, and the issue scopes it that way ("old tracks
stay valid").

**Decision**: backward compatibility only; document that old readers reject chunked tracks.

## R4. Bindings, not primitives, consume the fields

Primitives stay unchanged: `viseme`/`beat` join the spec-013 `from` grammar, so
`rig.mouthOpen ← viseme` and `emitter.burst ← beat` work through the existing mapping and
clamping. A viseme → mouth-shape table inside a primitive is deferred.

**Decision**: extend `FROM_RE` with `viseme` and `beat`; evaluate them as numeric features
(fallback to the static value when the field is absent).

## R5. The conformance fixture is regenerated, never hand-edited

The committed `sample.asft` must gain the chunk by re-encoding (the provenant bytes come
from the encoder), and the pinned SHA-256 is re-derived — the same discipline as every
other fixture change.

**Decision**: `--write-fixture` regenerates; the gate re-pins the hash and asserts the new
frame's values.

## R6. No new export, no new dependency, no golden movement

The fields ride the existing codec/reader/bind surface; the golden render cases carry no
viseme/beat.

**Decision**: zero new exports, zero new dependencies, no render-hash movement.
