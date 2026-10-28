# Research: Pixel Mode and Two-Tone Bars and Rings

No item in the Technical Context was left as NEEDS CLARIFICATION. Each decision below records a
design choice the spec left to the plan.

## R1. How the flag reaches primitives

**Decision**: `DrawContext` gains an optional `pixel?: boolean`. `drawSpec` sets it from
`spec.pixelMode === true`, and it reaches every layer through the existing
`{ ...dctx, seed, layerSeed }` spread in `renderShot`. Sequences use the same `dctx`, so every
clip inherits it. Plugin layers receive it too, and may honour it (spec Edge Cases).

**Rationale**: `DrawContext` is the existing per-render channel (`creative`, `assets`,
`layerSeed`). An optional field leaves plugin contracts and core call sites unchanged.

**Alternatives considered**:
- A per-layer param injected by the validator. Rejected: it would leak into the vocabulary and
  into every primitive's params.
- A global. Rejected by Principle I (no hidden state).

## R2. Camera offsets in pixel mode

**Decision**: In `renderShot`, when `dctx.pixel` is set and a camera is present, the layer
transform is built from rounded offsets:

- At zoom `s === 1`, the net translation `W/2 + shakeX − lx·W` (and the same for y) is
  computed, rounded with `Math.round`, and applied as one `translate`.
- At `s ≠ 1`, the pre-scale translate (`W/2 + shake`) and the post-scale translate (`−lx·W`)
  are each rounded. Exactness is not promised at zoom ≠ 1 (spec Edge Cases).

Without pixel mode, the three calls stay exactly as today.

**Rationale**: At zoom 1, an integer translation maps whole-pixel drawing to whole pixels. This
is the case pan, parallax and shake hit. `Math.round` is deterministic across processor types.

**Alternatives considered**: Rounding only the final matrix through `setTransform`. Rejected:
it changes the call shape that the existing path relies on, and it gives the same result at
zoom 1.

## R3. Smoothing for the frame

**Decision**: `renderShot` sets `ctx.imageSmoothingEnabled = false` before the layer loop when
`dctx.pixel` is set, and restores the previous value afterwards. `image` also forces its own
smoothing off in pixel mode (R7), because it sets the flag per draw.

**Rationale**: This covers any `drawImage` inside a layer (sprites already draw nearest), and
plugin layers that scale bitmaps.

## R4. Whole-pixel bars and hbars

**Decision**: In pixel mode, bar `i` spans `x0 = round(i·W/n)` to `x1 = round((i+1)·W/n)`, with
width `max(x1 − x0 − 1, 1)`. This keeps the one-pixel gap of today's `bw − 1`. Height is
`max(round(spec[i]·maxH), 1)`. The top is `H − h`, or `round(H/2 − h/2)` for
`baseline: "middle"`. `hbars` gets the same rule on the other axis. Off pixel mode, the code
path is untouched.

**Rationale**: Cumulative rounding never accumulates drift, so the last bar ends at `W`
(spec FR-004, US1 scenario 2). With a 248.025 px pitch each bar is 247 or 248 px wide (plus the
1 px gap), and no pixel is blended.

**Alternatives considered**: `floor(bw)` for every bar. Rejected: it leaves up to `n` pixels
unfilled at the right edge.

## R5. Whole-pixel rings

**Decision**: In pixel mode, `rings` rasterises its outlines into one offscreen canvas
(`createCanvas`, as `paletteMapped` does) of the rings' bounding box. It then draws it with one
`drawImage` at a whole-pixel position, with smoothing off.

- Each ring has radius `R = round(r)`, and half-thickness `h = thickness / 2`.
- For each row `dy` (measured from pixel centres), the ring covers the columns where the pixel
  centre's distance from the centre lies in `[R − h, R + h]`. That is the span between
  `sqrt((R−h)² − dy²)` and `sqrt((R+h)² − dy²)` on each side, computed per row and written into
  `ImageData` as exact RGBA.
- The colour comes from `rgbOfColour(colour)` (`src/primitives/registry.ts:128`). Later rings
  overwrite earlier ones, so each pixel is one colour.
- The centre is `round(W/2), round(H/2)`.

**Rationale**:
- One draw operation per layer keeps the op budget flat at any `count`.
- Span arithmetic is O(rows × rings). There is no per-pixel loop over the whole box per ring.
- `drawImage` keeps the camera transform working (R2), unlike `putImageData`, which ignores
  transforms.
- `sqrt` and `round` on doubles are IEEE-exact, so arm64 and x64 agree. This is the #126
  lesson: avoid the rasteriser's antialiased paths.

**Alternatives considered**:
- Many `fillRect` spans. Rejected: about 2 spans × 2R rows × 12 rings at 1080p is about 24k
  operations, over the composition budget.
- A Bresenham circle. Rejected: it can't give an arbitrary thickness without gaps.

## R6. Emitter and particles in pixel mode

**Decision**:
- **`emitter`**: every shape (petal, spark, dust, snow, ember) draws as a whole-pixel square:
  `fillRect(round(px − s/2), round(py − s/2), s, s)` with `s = max(1, round(size))`, where
  `size` is the shape's current visual diameter. The closed-form alpha is thresholded: a
  particle draws at full opacity when `alpha ≥ 0.5`, and is skipped otherwise. The burst flash
  ring uses the R5 raster at full opacity when its alpha is ≥ 0.5.
- **`particles`**: positions and size are rounded. Its squares are already opaque.

**Rationale**: A fractional alpha always blends with the pixel beneath, so thresholding is the
only way to stay exact (FR-006, SC-003). The threshold reads the same closed-form alpha, so any
frame still renders alone. The fade becomes a pop, which matches pixel-art particles.

**Alternatives considered**: An ordered-dither alpha (Bayer). Rejected for now: it needs a
fixed screen-space matrix under a moving camera, and it adds complexity nobody asked for. It
could be a later opt-in.

## R7. Image in pixel mode

**Decision**: The existing palette-mode path already uses whole-pixel size and position
(`own ? v : Math.round(v)`) and nearest sampling. In pixel mode, `image` uses that exact path
for the art's own colours too: `exact = !own || x.pixel` replaces `!own` in the size and snap
expressions, and `imageSmoothingEnabled` becomes `own && smooth && !x.pixel`.

**Rationale**: It reuses code that is already gated and checked (the spec 022 checks "palette
mode stays exact under smooth scaling" and "nearest smoothing at scale 2 gives uniform 2 × 2
blocks").

## R8. tone2

**Decision**:
- **`bars.tone2`** is `none|alternate|peak`.
  - `alternate`: odd `i` take `secondTone(p)`, even `i` take `fg`, and the peak keeps `accent`.
  - `peak`: the peak bar takes `secondTone(p)` instead of `accent`.
- **`rings.tone2`** is `none|alternate`. Rings are numbered from 1. Even rings take
  `secondTone(p)` and odd rings `accent`. Off pixel mode, `strokeStyle` is set per ring only
  when `tone2 !== "none"`, so default rendering issues the same calls as today.

**Rationale**: The first bar and the innermost ring keep today's colour (spec Assumptions).
`secondTone` already returns `roles.fg2` or `#808080` (spec 019).

## R9. Reference cases and checks

**Decision**:
- **New golden cases** (COMPOSITE_SPECS in `scripts/lib/goldenHashes.ts`, three frames each,
  both sets):
  - `bars:pixel`
  - `bars:pixel-fractional` (a width giving a fractional pitch, via a spec-level layout at the
    reference dims)
  - `hbars:pixel`
  - `rings:pixel`
  - `rings:pixel-thick` (thickness 9, count 12)
  - `emitter:pixel` (dust and petal)
  - `particles:pixel`
  - `image:pixel` (smoothing smooth at scale 3)
  - `camera:pixel-pan`
  - `bars:tone2-alternate-fg2`
  - `bars:tone2-peak`
  - `rings:tone2-alternate-fg2`
- **Determinism gate**:
  - Every FR-004 primitive has 0 pixels outside the palette, in pixel mode at quiet, mid and
    loud, including a 248.025 px pitch: `bars` at width `n × 248.025`.
  - `tone2` confinement: `fg2` pixels lie only inside the named bars or rings, and the named
    bars or rings are 100% `fg2` in pixel mode.
  - Camera pan in pixel mode: a one-pixel-column test layer shows no blended column on any of
    16 sampled frames.
  - Chunk equals whole, and render twice is identical.
  - `pixelMode: false` equals no `pixelMode`, byte for byte.
- **Budget gate**: add pixel-mode probes of `rings` (count 12, thickness 32), `emitter`
  (rate 200) and `bars` to the existing per-primitive probe list. No threshold changes.
- **Validator gate**: true and false are kept, while `1`, `"true"` and `null` are dropped with
  the FR-002 message.

**Note**: the `~nd` order-check cases are not golden-hashed, so `tone2`'s appearance in
`bars~nd` and `rings~nd` moves no recorded frame.

## R10. Constitution and vocabulary

**Decision**:
- **Constitution**: amend 6.1.0 → 6.2.0. "The format" gains "the optional `pixelMode`
  (whole-pixel camera offsets, no smoothing, and whole-pixel drawing in the primitives that
  honour it)" after `pixelAspect`. The amendment is logged in the Sync Impact Report and
  Governance history.
- **Vocabulary**: `VOCABULARY_VERSION` 17, recorded with
  `npm run vocab:record -- "tone2 on bars and rings: a second tone (fg2) for alternate or peak bars and alternate rings"`.
  Descriptions name `pixelMode` support on the six primitives.

**Rationale**: Every earlier spec-level field (`roles`, `pixelAspect`, `assets`) was named in
"The format" when it shipped (Principle VII).
