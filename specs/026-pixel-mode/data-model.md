# Data Model: Pixel Mode and Two-Tone Bars and Rings

## Spec-level field: `pixelMode`

| Field | Type | Default | Validation | Effect |
| --- | --- | --- | --- | --- |
| `pixelMode` | boolean | absent (treated as false) | Kept when `true` or `false`. Any other value is dropped and reported as `pixelMode dropped (must be true or false)` | When true: whole-pixel camera offsets, no smoothing for the frame, and whole-pixel drawing in `bars`, `hbars`, `rings`, `emitter`, `particles` and `image` |

- The field applies to the whole spec, including every clip of a `sequence`.
- `pixelMode: false` renders byte-identically to an absent field.
- It is independent of `pixelAspect`, which stays metadata only.

## Draw context: `DrawContext.pixel`

| Field | Type | Set by | Read by |
| --- | --- | --- | --- |
| `pixel` | `boolean \| undefined` | `drawSpec`, from `spec.pixelMode === true` | `renderShot` (camera, smoothing), the six FR-004 primitives, and optionally plugin primitives |

## Layer params (vocabulary 17)

| Primitive | Param | Type | Values | Default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `bars` | `tone2` | enum | `none`, `alternate`, `peak` | `none` | `alternate`: odd bars (from 0) draw the second tone, and the peak keeps the accent. `peak`: the peak bar draws the second tone instead of the accent |
| `rings` | `tone2` | enum | `none`, `alternate` | `none` | `alternate`: even rings (from 1) draw the second tone; odd rings keep the accent |

**Second tone**: `roles.fg2` in creative mode when given, otherwise `#808080` (spec 019,
`secondTone(p)`).

## Invariants checked by the gates

1. No `pixelMode` and no `tone2` (or `tone2: "none"`): every frame is byte-identical to 0.8.2.
2. `pixelMode: true` on a solid background at zoom 1: every pixel of an FR-004 primitive's
   frame is in {bg, fg, accent, declared role colours, their greys}.
3. `tone2`: `fg2` pixels lie only within the named bars or rings.
4. All frames are a pure function of (spec, signal, seed): twice-render, chunk and fresh-process
   equal, and within the cross-type tolerance.
