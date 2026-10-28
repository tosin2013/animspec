# Research: Arcade HUD

## R1. Data convention for versus-bars

**Decision**: `coords[0]` is the left side and `coords[1]` the right. `x` is the fill and `y` is
the damage tail. Both are clamped to 0..1, and the tail is `max(x, y)`. With one entry, the
right side is full (1, 1). With no `coords`, the fill is the mean of the low or high half of
the spectrum (clamped to 0..1), with no tail.

**Rationale**: `coords` are the frame's normalised pairs, and two values per side fit one pair.
The vetting probes carry fixed `coords` (`verify/fixtures.ts`), so the bars draw real data in
the gates. The spectrum fallback keeps a data-less gallery frame meaningful.

## R2. Signal reaction

**Decision**: With `drive: "level"`, the tail draws in the foreground when `energy ≥ 0.7`, a hit
flash. Otherwise it draws in the accent in creative mode when the accent differs from the
foreground, and in `FG2_MONO` (#808080) otherwise. `drive: "none"` never flashes.

**Rationale**: The reactivity gate compares a quiet frame with a loud one at the same `coords`,
in monochrome. A flash to the foreground differs from grey in monochrome and from the accent in
creative mode. An outline flash in the accent would be invisible in monochrome.

## R3. Whole-pixel angled ends

**Decision**: Each bar is drawn row by row. For row `r` of `H` rows, the outer end is shifted
inward by `round((H − 1 − r) · tan(angle))` pixels, so the end is a stair-step slant. The fill,
the tail and the one-pixel outline are each a `fillRect` per row, with whole-pixel x and widths
from `Math.round`.

**Rationale**: `fillRect` with integer coordinates never blends (spec 026's lesson), so the
primitive is exact without pixel mode. The cost is about 3 × 2 × H operations, about 300 at
1080p (H ≈ 49 px).

## R4. Layout of versus-bars

**Decision**:
- `y` is the bars' top, as a fraction of the height. `height` is the bar thickness, as a
  fraction of the height.
- The bars span from `0.04·W` to `W/2 − gap·W/2` (left) and mirror on the right.
- A fill grows from the outer edge toward the centre. The tail continues from the fill's end.

## R5. hud-score layouts

**Decision**: Text size is `max(10, round(size · H))` px in the shipped font (`x.font`). Every
position is a fraction of the frame.
- **`shooter`**:
  - `1UP` caption at (0.06W, 0.04H), left-aligned, with `labels[0]` below it.
  - `HI-SCORE` centred at 0.04H, with `labels[1]` below it.
  - `CREDIT <labels[2]>` right-aligned at (0.94W, 0.94H).
- **`versus`**:
  - `labels[0]` (the timer, at most 3 characters) centred at the bars' default height
    (0.06H), at 2 × size.
  - `labels[1]` left-aligned at (0.04W, 0.13H), and `labels[2]` right-aligned at (0.96W, 0.13H),
    just below the default versus bars.
- **Captions**: `captions: false` hides the fixed captions.
- **Lengths**: values are cut to 12 characters and the timer to 3. Missing labels are blank.

**Emphasis**: with `drive: "level"` and `amplitude ≥ 0.6`, the emphasised item (`1UP`, or the
timer) draws as background-coloured text on a foreground box.

## R6. Reference cases and checks

**Decision**:
- **Reference cases** (a `HUD_CASES` map with per-case frame overrides, at quiet, mid and loud):
  - `versus-bars:full` (coords 1/1, 1/1)
  - `versus-bars:hit` (0.4/0.6, 0.8/0.8)
  - `versus-bars:nodata` (no coords)
  - `versus-bars:creative` (accent, hit state)
  - `hud-score:shooter` (labels `12340`, `50000`, `2`)
  - `hud-score:versus` (labels `99`, `RYU`, `KEN`)
  - `hud-score:nolabels`
- **Determinism checks**:
  - The fill and tail lengths match the values within 1 px, at two states.
  - A solid `versus-bars` frame has 0 pixels outside {bg, fg, accent, #808080}, in both modes.
  - Changing the labels changes `hud-score`, and with `drive: "none"` the signal does not.
  - Missing labels draw no value, and the text is cut as stated.
  - Render twice and chunk checks.

The default `versus-bars@*` and `hud-score@*` cases come for free from the per-primitive case
list. Their probe frames carry the fixed labels and coords.

## R7. Showcase dims and data

**Decision**: `ShowcaseCase` gains `dims?: { width; height }` and
`frameData?: (i: number) => { labels?: string[]; coords?: {x,y}[] }`. `renderShowcase` and
`generate-showcase.ts` use `c.dims ?? SHOWCASE_DIMS`. Existing cases set neither, so their
output is byte-identical (the showcase freshness check proves it).

- **`cps2-versus`** (384×224, `pixelMode`, creative):
  - a `dither` stage;
  - two `sprite` fighters, the second with `faceLeft: true`;
  - `versus-bars`;
  - `hud-score` versus;
  - data over 30 frames: the right side takes a hit at frame 10, its tail drains to the fill by
    frame 25, and the timer counts `99`, then `98` from frame 15.
- **`tate-shooter`** (224×288, `pixelMode`):
  - `dots` starfield;
  - `sprite` ship;
  - `hud-score` shooter;
  - the score rises over the loop.

## R8. Vocabulary

**Decision**: `VOCABULARY_VERSION` 18, recorded with
`npm run vocab:record -- "add versus-bars and hud-score: a data-bound arcade HUD (coords and labels)"`.
Both are in the `contrib` tier, so they are never offered by a kit, as with `type-reveal`.
