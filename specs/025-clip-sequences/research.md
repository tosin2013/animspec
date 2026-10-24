# Research: Clip Sequences

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Rendering structure

**Decision**: refactor `drawSpec` (`src/specInterpreter.ts`, around line 112) into three
private pieces with no behaviour change for single-shot specs:

1. **Palette resolution**: unchanged.
2. **`renderShot(ctx, dims, frame, layers, camera, palette, dctxBase, opts, seed)`**: fills the
   background, then runs today's layer loop (camera transform, legacy `_bitmap`, bindings,
   `layerSeed`, plugin isolation) exactly as written.
3. **The transparent lift** (`liftBackground`): runs once at the end.

Without `sequence`, `drawSpec` calls `renderShot` once with `spec.layers` and `spec.camera`,
then lifts. That is the same canvas calls in the same order, so no hash moves (FR-006). The
determinism gate's hashes prove it.

## R2. Clip time

- **The problem**: `drawSpec` has no frame rate, but `SignalFrame` carries `index` and `t`.
  The signal track has a fixed rate, so `t = index / fps`.
- **The formula**: clip-relative time is `t' = t·(index − from)/index` for `index > 0`, and 0
  when `index === from`, which is exactly `(index − from)/fps` without knowing `fps`.
- **The frame passed to a clip**: `{ ...frame, index: index − from, t: t' }`. The signal fields
  (values, spectrum, amplitude, energy, labels, coords, viseme, beat) stay absolute (FR-004).
  Clip cameras and binds' oscillators read the clip-relative index and time.
- **The outgoing clip during a transition** uses `index − from_out`, so its time keeps
  advancing past its `to` (FR-008).
- **Assumption**: a constant frame rate. This is true for ASFT tracks and every host frame
  loop. It is recorded in the contract.

## R3. Seeds per clip

`clipSeed = mixSeed(opts.seed, 0x51 + clipIndex)` (the existing `mixSeed`). It is passed as
the seed to `renderShot`, so `layerSeed`, binds and seeded primitives differ between clips
(edge case). Single-shot specs keep `opts.seed`.

## R4. Transitions

The progress for incoming clip B with `frames = k` is `p = (index − from_B + 1)/(k + 1)`,
taking values in (0, 1) over the k frames. So the first transition frame already shows a
little of B, and the frame after the transition is B alone (FR-008, "linear").

- **cut**: no blend. B renders from `from_B` (A renders until `from_B − 1`).
- **wipe, iris and fade**:
  - Render A and B, each with `renderShot`, into two off-screen canvases of the frame size.
    Neither is lifted.
  - Combine them per pixel into an `ImageData`, and `putImageData` it onto the main canvas.
  - **wipe** (direction right): a pixel comes from B when `x < round(p·W)`. Left, up and down
    are the mirror and transposed forms.
  - **iris**: a pixel comes from B when `(x+0.5−W/2)² + (y+0.5−H/2)² < (p·R)²`, where `R` is
    the half diagonal.
  - **fade**: `round(a·(1−p) + b·p)` on all four channels.

  Every wipe and iris pixel is wholly A's or B's (FR-009). Fade pixels lie between them
  (SC-004).
- **Gap before B**: A is the background alone (an empty shot).
- **Transparent background**: the combination happens on the opaque source-background
  renders, and the single lift runs afterwards. So a fade over a transparent background
  fades alpha consistently with spec 017's lift (edge case).

**Why off-screen and `ImageData`** instead of canvas clipping and `globalAlpha`: clip paths
anti-alias their edges and `globalAlpha` rounding differs by rasteriser path. Per-pixel
arithmetic on integer RGBA is exact, the same on both processor types, and keeps wipe and
iris pixels pure (FR-009).

**Cost**: two shots, plus one loop over the pixels (about 8 M byte operations at 1080p,
around 10 to 20 ms). Main-canvas operations are each shot's draws (on off-screen canvases,
so not counted by the operation proxy) plus one `putImageData`. A new composition-budget
case, a 12-layer shot fading into another 12-layer shot, confirms the time stays within
200 ms (edge case). If it does not, the layers per clip during transitions are capped.

## R5. Validation (`src/specValidator.ts`)

- **Extract** today's per-layer loop (around line 159: the `ext:` rules, `sanitizeLayer`,
  bind reporting, pattern and dither reporting) and the image-asset pass after it into
  `sanitizeLayerList(rawLayers, { plugins, assets }, errors, dropped, label)`. The `label`
  prefixes messages for clips (`sequence[2]: …`); top-level messages keep exactly today's
  text.
- **`sanitizeSequence(raw, …)`**:
  - an array of at most 64 entries;
  - each entry an object with integer `from ≥ 0` and `to > from`, `layers` sanitized by
    `sanitizeLayerList` (dropped when no layers are left), an optional `camera`
    (`sanitizeCamera`), and an optional `transition` (type enum, `frames` integer 1..600,
    `direction` enum, defaulting to `right` for wipe);
  - clips kept in input order. A clip whose `from` is less than the previous kept clip's
    `to` is dropped (`overlaps or is out of order`).
  - A transition on the first kept clip is ignored. `frames > to − from` is clamped. Both
    are reported.
- **With `sequence`**: top-level `layers` and `camera` are ignored and reported. The spec is
  valid when at least one clip is kept. `layers: []` is stored so the `AnimSpec` shape still
  holds.

## R6. Schema, CLI, references

- **Schema**: `sequence: { type: "array", maxItems: 64, items: { from, to, layers (the same
  item schema as top-level), camera (the same), transition: { type, frames, direction } } }`.
- **CLI**: no change to rendering. The manifest gains `clips: <n>` when the spec has a
  sequence.
- **References**: `SEQUENCE_CASES` (`goldenHashes.ts`), each rendered at three chosen
  absolute frames (inside clip 1, inside the transition, inside clip 2), not the standard
  quiet/mid/loud trio. The trio's indices (0, 12, 47) are kept, and the sequences are
  designed around them:
  - `sequence:cut` (clips [0,12), [12,60));
  - `sequence:wipe` (transition 20 frames at [12,60), so frame 12 is inside it);
  - `sequence:iris`;
  - `sequence:fade`;
  - `sequence:gap` (clips [0,5), [20,60), so frame 12 is in the gap);
  - `sequence:camera` (a per-clip zoom).

  That is 6 × 3 = 18 per set.
- **Showcase**: `shot-list`, a loop: title card → `dither` scene (wipe) → `hero` (iris) →
  end card (fade), at 30 frames.

## R7. Constitution 6.1.0

"The format" gains "the optional `sequence` of clips (absolute frame ranges, per-clip layers
and camera, transitions cut, wipe, iris and fade)". The amendment note states that transitions
combine two renders of clips of the same spec inside animspec and are not effects applied to a
finished frame, so the permanent out-of-scope "post-process effects" and the #90 decision
stand. MINOR.

## Implementation findings (2026-10-24)

- **The refactors were exact.** The `renderShot` and `sanitizeLayerList` extractions left
  every hash and every validator message unchanged (the determinism and validator gates
  passed before any sequence code).
- **Transitions are cheap.** The 12 + 12-layer fade measured 55.4 ms per 1080p frame,
  against the 200 ms limit. Its operation count shows 1, because both shots draw on
  off-screen canvases, which the operation proxy does not count by design. The time limit
  bounds that work, and the user guide says so. No per-clip layer cap was needed.
- **Reference frames drawn from `goldenFrames()` work.** The reference indices are 0, 12
  and 47; the cases put 12 inside the second clip's transition (or in the gap) and 47 in
  that clip alone.
- **The showcase was adjusted after inspecting the pixels.** `chapter-card` text is cropped
  at 320 px, so the title is `text` and the end card `caption`. Clips 2 and 3 get different
  backdrops so the iris is visible.
- **One schema fix during implementation.** The schema now shares `cameraSchema` and
  `layerItem` between the top level and clips, and requires `layers` or `sequence` with
  `anyOf`.
