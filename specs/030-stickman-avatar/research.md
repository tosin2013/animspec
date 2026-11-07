# Research: Stickman, the Default Avatar

The Technical Context had no open questions. Each decision below records a choice the spec
left to the plan.

## R1. Skeleton and poses

**Decision**: The skeleton is ported from the Stickman Lab:
- a hip, a neck at 1.9 units, and a head centred 0.12 units beyond its radius, where the radius
  is 0.48 × `headScale`;
- for each of the two arms, a shoulder and then an elbow (0.95 units) and a hand (0.9 units);
- for each of the two legs, a hip and then a knee and a foot (1 unit each);
- one unit is a sixth of the figure's height.

A pose is `{ dx, dy, lean, tilt, rot, A[2], E[2], T[2], K[2] }`:
- arm angles `A` are measured from straight down and grow forwards and up, and the forearm adds
  `E`;
- thigh angles `T` grow forwards, and the shin bends back by `K`;
- `rot` turns the whole body about the feet and then lifts it to rest on the ground (used by
  `fall` and `ko`).

Each action is a closed-form function of the figure's local time `t·speed + phase`. The lab
functions are kept, and these are added:
- **`point`**: the front arm is straight along the target angle.
- **`present`**: both arms open towards the target, the back arm 40° and the front arm 15° below it.
- **`reach`**: the front arm aims at the target, the back arm swings back, and the figure leans
  towards the target by up to 12°.
- **`look`**: the head tilts by the target's elevation (back for a target above the horizontal, forward for one below), `0.6 × (90° − aim)` clamped to ±35°, and the body idles. The other target actions glance the same way at reduced strength.

**Rationale**: The preview proved the proportions and motions. Angles are plain arithmetic, so
the pose is identical on every processor type.

## R2. Two renderers

**Decision**:
- **Line styles** stroke the nine bones with round caps and joins, then fill or ring the head.
  - Thickness is `thickness × scale × H / 120`, at least 1 pixel.
  - Style presets set the defaults: bold doubles the thickness, outline uses a ring head,
    chibi uses `headScale × 1.6`, and joints adds accent dots at the hands, feet and joints and
    an accent head.
- **Pixel style, or `x.pixel`**: every figure in the layer is rasterised into one off-screen
  `ImageData` covering the layer's bounding box.
  - Each bone is stamped with a whole-pixel square brush every pixel along its length, at
    integer centres.
  - The head is a pixel disc, filled or a ring by style.
  - The raster is drawn with one unsmoothed `drawImage` at a whole-pixel position. Colours come
    from `rgbOfColour` on palette roles only.

**Rationale**: Line output matches the lab look. The raster path keeps a 12-figure crowd at one
draw operation and every pixel exactly on the palette (spec 026), including under
`gameboy-dmg`/`genesis`.

## R3. Targets and facing

**Decision**:
- **Facing**: `facing: "auto"` faces the target for target actions, the direction of `travel`
  when it isn't zero, and otherwise right.
- **Arm aim**: the shoulder→target angle is converted into the arm convention, measured from
  down and mirrored by facing, and clamped to between 0° and 200°.
- **Reach**: if the target is nearer than the arm's length, the arm still points along the
  line. The spec promises direction, not contact.

## R4. Speech bubble

**Decision**: The bubble is drawn when `speech` is on and the frame has a label (cut to 40
characters).
- **Text**: `max(10, round(0.09 × figure height))` px in the shipped font.
- **Shape**: a rounded rectangle filled in `bg` with a 1–2 px outline in the figure's colour,
  above the head, and a triangular tail pointing at the head.
- **Placement**: the bubble is shifted sideways to stay inside the frame.
- **Who speaks**: in a crowd, only the highlighted figure, or else figure 1.

## R5. Coordinates

**Decision**: With `from: "coords"`, figure *i* uses `coords[index + i]`, clamped to 0..1:
`x` sets the horizontal centre and `y` the ground line. A figure without a coordinate falls back
to its arrangement position.

## R6. Crowds

**Decision**: For `count` greater than 1:
- **Positions**:
  - **row**: evenly spaced over 70% of the width, centred on `x`.
  - **cluster**: a jittered row. Slots are evenly spaced over 80% of the width; each figure is
    up to half a slot off its slot and ±4% of the height off the ground line, from
    `rng = mulberry32(mixSeed(seed, 1000 + i))`, scaled 85–100% by depth, and drawn back to
    front, sorted by ground y. (Plain ±18% jitter piled nine figures into a clump and hid
    the highlighted one, as the showcase review found.)
  - **split**: two halves on either side of `x`, facing each other.
- **Variation**: each figure gets a phase offset uniform over one cycle and a size of
  `1 ± 0.08 × (2u − 1)`, both from the same seeded stream.
- **`count: 1`**: no variation, so it is identical to the single-figure path.
- **Seed**: `x.layerSeed ?? x.seed`, as spec 024 gives each layer its own seed.

## R7. Drive

**Decision**:
- **`level`**: an idle bob of `(1 + 2·amplitude)` px per 100 px of figure height. Other
  actions keep their own motion plus this bob.
- **`beat`**: the `level` bob, plus a hop of `0.18 × height × (amplitude − 0.6)/0.4` whenever
  `amplitude ≥ 0.6`.
- **`none`**: the signal changes nothing.

**Rationale**: The reactivity gate needs the default layer to change between quiet and loud
frames, which `level` does.

## R8. Colours

**Decision**:
- **`colour`**: `fg`, `accent` or `fg2`. `fg2` uses `secondTone(p)`: `roles.fg2` in creative
  mode, else `#808080`.
- **`highlight`**: draws that figure in `p.accent`.
- **`joints` style**: the hands, feet and head take `p.accent`, or `p.fg` when the figure
  itself is accent-coloured.

## R9. Params

| Param | Type | Range / values | Default |
| --- | --- | --- | --- |
| `action` | enum | idle, walk, run, jump, punch, kick, hit, fall, ko, wave, dance, point, present, reach, look | idle |
| `style` | enum | classic, bold, outline, chibi, pixel, joints | classic |
| `colour` | enum | fg, accent, fg2 | fg |
| `x` | number | 0–1 | 0.5 |
| `y` | number | 0–1 (the ground line) | 0.86 |
| `scale` | number | 0.05–1 (height ÷ frame height) | 0.5 |
| `facing` | enum | auto, right, left | auto |
| `speed` | number | 0–4 (tempo multiplier) | 1 |
| `travel` | number | −1–1 (frame widths per second) | 0 |
| `thickness` | number | 1–16 (at a 120 px figure) | 3 |
| `headScale` | number | 0.5–2.5 | 1 |
| `targetX` | number | 0–1 | 0.8 |
| `targetY` | number | 0–1 | 0.35 |
| `speech` | boolean | | false |
| `from` | enum | params, coords | params |
| `index` | number | 0–63 | 0 |
| `drive` | enum | level, beat, none | level |
| `count` | number | 1–12 | 1 |
| `arrangement` | enum | row, cluster, split | row |
| `highlight` | number | 0–12 | 0 |

That is 20 params. Every one is scalar and passes `paramSpecProblems`.

## R10. Kits

**Decision**: `stickman` joins the `data-viz` (presenter), `minimal` and `arcade` kits in
`src/primitives/selector.ts`. It is in the core tier, so a model with no kit can be offered it.
The tier rules allow core primitives in kits.

## R11. Checks, cases, showcase

- **Determinism checks**:
  - Each of the 15 actions differs between t = 0.1, 0.5 and 0.9, and all 15 are pairwise
    distinct.
  - Two targets move the hand towards each.
  - The speech bubble changes with the label, and there is no bubble without one.
  - `coords` move the figure.
  - The drive gives quiet ≠ loud for `level` and `beat`, and quiet = loud for `none`.
  - A crowd of 8 has distinct figure poses, the same seed gives the same bytes, and `count: 1`
    equals a single figure.
  - Exactly one figure draws in the accent with `highlight`.
  - The pixel style and `pixelMode` have 0 off-palette pixels, and the figure uses only DMG
    greens under `gameboy-dmg` with pixels.
  - Chunk equals whole.
- **Reference cases** (`STICKMAN_CASES`, three frames each):
  - every action;
  - every style;
  - `point` at a target with speech;
  - `coords`;
  - row, cluster and split crowds with a highlight;
  - a pixel crowd under `gameboy-dmg`.
- **Composition**: 12 layers × `count: 12`, classic style, at 1080p.
- **Showcase**:
  - **`stickman-presenter`**: points at a `line-chart`'s head and speaks the label.
  - **`stickman-fight`**: two figures, with `sequence` clips for approach, punch/hit, kick/fall,
    and dance/ko.
  - **`stickman-dance`**: one crowd layer, `count: 9`, cluster, `drive: "beat"`, highlight 5.
- **Gallery demo**: a `point` at a target with a speech label.
