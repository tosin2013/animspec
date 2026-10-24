# Feature Specification: Camera Shake and a Wider Camera Range

**Feature Branch**: `feature/016-camera-shake`

**Created**: 2026-10-23

**Status**: Shipped in 0.5.0

**Input**: User description: "Camera shake and a wider camera range (issues #87 and the camera-range part of #111), amending spec 014's spec-level camera. Add an optional deterministic shake to the camera: scalar amplitude and frequency, seeded, a closed-form function of the frame so chunked and parallel renders stay byte-identical, scaled by layer depth under parallax, and off by default so no existing frame changes. Widen the camera's from/to x and y range beyond 0..1 so a camera can travel more than half a screen across scrolling parallax layers, without changing any spec whose values are already in range. Pixel mode from #111 stays out of scope."

## User Scenarios & Testing *(mandatory)*

Spec 014 gave the format a spec-level camera: pan, zoom, push and parallax between two
keyframes, with each layer's `depth` deciding how far it moves under parallax. Two things
are missing. A camera cannot shake, which is the usual way to give a frame impact or a
handheld feel (#87). And the camera point is held to 0..1, so a camera can travel at most
half a screen from the centre, which is too little for a scene that scrolls across several
parallax layers (#111).

This feature adds both, without changing any frame a spec draws today.

### User Story 1 - A camera can shake, the same way every time (Priority: P1)

A spec author adds a shake to the camera, with a strength and a speed. Every frame is
offset by a small, irregular amount, so the picture trembles. The same spec, signal and
seed always shake the same way, and a frame rendered on its own matches the same frame
inside a full render.

**Why this priority**: It is the request in #87, and it is the part an author sees.

**Independent Test**: Render a spec with a shake at two different frames and confirm they
differ from the unshaken frames; render the same frames again, alone and inside a full
render, and confirm they are byte-identical.

**Acceptance Scenarios**:

1. **Given** a camera with a shake, **When** frames are rendered, **Then** each frame is offset from the same camera without a shake, and the offset changes over time.
2. **Given** the same spec, signal and seed, **When** a frame is rendered twice, or once alone and once inside a full render, **Then** the frames are byte-identical.
3. **Given** two different seeds, **When** the same frame is rendered, **Then** the shake differs.
4. **Given** a shake with strength 0, **When** frames are rendered, **Then** they are byte-identical to the same spec without a shake.
5. **Given** a spec with no shake, **When** it is rendered after this feature, **Then** every frame is byte-identical to before.
6. **Given** a shake on a camera that does not move (`static`), **When** frames are rendered, **Then** the picture shakes in place.

---

### User Story 2 - Shake respects depth under parallax (Priority: P2)

Under a parallax camera, a far background layer moves less than a near layer. A shake
behaves the same way: the background trembles less than the foreground, so the shake reads
as a camera moving, not as the whole picture vibrating.

**Why this priority**: Without it, parallax scenes with a shake look wrong. It builds on the
first story.

**Independent Test**: Render a parallax spec with a shake and two layers at depth 0 and
depth 1, and confirm the depth-0 layer does not shake and the depth-1 layer does.

**Acceptance Scenarios**:

1. **Given** a parallax camera with a shake, **When** a layer has depth 0, **Then** that layer does not shake.
2. **Given** a parallax camera with a shake, **When** a layer has depth 1, **Then** it shakes by the full amount, and a layer at depth 0.5 by half of it.
3. **Given** a camera move other than parallax, **When** it has a shake, **Then** every layer shakes by the full amount, as depth is ignored by those moves today.

---

### User Story 3 - A camera can travel further (Priority: P3)

A spec author pans a camera across a wide scene of scrolling parallax layers, further than
half a screen. The camera point may now lie beyond the frame's edges, within a stated range.

**Why this priority**: It unblocks wider scrolling scenes (#111) and is a small change, but
it is less requested than the shake.

**Independent Test**: Render a pan whose keyframes lie outside 0..1, and confirm the camera
reaches them; render a pan whose keyframes lie inside 0..1, and confirm it is byte-identical
to before.

**Acceptance Scenarios**:

1. **Given** a pan from `x: 0.5` to `x: 1.5`, **When** the last frame is rendered, **Then** the camera is centred one full screen to the right of where it started.
2. **Given** a camera whose keyframes all lie inside 0..1, **When** it is rendered after this feature, **Then** every frame is byte-identical to before.
3. **Given** a keyframe beyond the new range, **When** the spec is validated, **Then** the value is clamped to the range.
4. **Given** a spec saved after validation by an earlier version, **When** it is rendered after this feature, **Then** it is unchanged, because validation had already clamped its keyframes. A spec saved unvalidated, with a keyframe outside 0..1, now renders at the stated position (FR-012).

---

### Edge Cases

- **Shake on a zooming camera**: the shake is measured in the frame, not in the zoomed scene, so a zoomed-in picture does not shake harder.
- **Very fast shake**: the speed is capped at 5 per second, so even the faster of the two oscillations (about 11.6 per second) stays below half of 24 frames per second and cannot alias into apparent stillness or flicker at 24 fps or above. Lower frame rates can alias; that is the author's choice.
- **Reduced flicker**: a shake is motion, not flashing, so the reduced-flicker option does not change it. An author who wants calm output leaves the shake off.
- **A shake with no camera move**: allowed; it needs a camera object with `static`.
- **A malformed shake** (a missing or non-number strength, a negative speed): the shake is dropped and reported; the rest of the camera stays.
- **Edges revealed**: shaking or travelling past a layer's drawn area shows the background, as panning does today. Tiling layers to fill the gap belongs to the image-layer work (#109).
- **Chunked renders**: the shake depends only on the frame's time and the seed, so any chunk renders alone.

## Requirements *(mandatory)*

### Functional Requirements

**Shake**

- **FR-001**: The camera MUST accept an optional shake with two scalar settings: strength (`amp`, the largest offset, as a fraction of the frame; required) and speed (`freq`, base oscillations per second; optional, default 3).
- **FR-002**: Strength MUST be bounded: at least 0 and at most a twentieth of the frame (0.05). Speed MUST be bounded: above 0 and at most 5 per second. A strength or speed above its bound, or a strength below 0, MUST be clamped; a speed at or below 0 is malformed (FR-009).
- **FR-003**: The shake offset for a frame MUST be a closed-form function of that frame's time, the render seed and the two settings, with no dependence on earlier frames.
- **FR-004**: The shake MUST move the picture in both directions (left-right and up-down). Each direction MUST combine two oscillations at non-harmonic rates (the faster about 2.31 times the base speed), and the two directions MUST use independent seeded phases, so the shake does not read as a single smooth sway.
- **FR-005**: The same spec, signal and seed MUST give byte-identical frames, and a frame rendered alone MUST match the same frame inside a full render.
- **FR-006**: Different seeds MUST give different shakes.
- **FR-007**: Under a parallax camera, each layer's shake MUST be scaled by its depth. Under every other move, every layer MUST shake by the full amount.
- **FR-008**: A spec without a shake, or with strength 0, MUST render byte-identically to the same spec before this feature.
- **FR-009**: A malformed shake MUST be dropped and reported in the same way as other rejected input; the rest of the camera MUST be kept.

**Range**

- **FR-010**: The camera point's `x` and `y` in each keyframe MUST accept values from -1 to 2, so the camera can travel one and a half screens from the centre in any direction. Values beyond that MUST be clamped.
- **FR-011**: A camera whose keyframes lie inside 0..1 MUST render byte-identically to before this feature.
- **FR-012**: A camera keyframe outside 0..1 MUST render at its stated position (within -1..2) once validated by this version. Today validation clamps such a value to 0..1, and the interpreter itself does not clamp. So a spec saved after validation already holds the clamped value and is unchanged; only a spec saved unvalidated and validated again at render time draws differently. That change MUST be recorded in the changelog as intended.

**Everywhere**

- **FR-013**: The description of the format given to models (the JSON schema) MUST describe the shake and the wider range.
- **FR-014**: All checks MUST run inside the one offline verify command.

### Key Entities

- **Shake**: an optional part of the camera with a strength (fraction of the frame) and a speed (oscillations per second).
- **Camera point**: the `x`, `y` a keyframe looks at, now allowed from -1 to 2, where 0.5 is the frame centre.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical after this feature, in both reference sets.
- **SC-002**: A spec with a shake renders byte-identical frames twice and in chunks, for 100% of frames checked.
- **SC-003**: At strength 0, 100% of frames match the same spec without a shake.
- **SC-004**: Under parallax with a shake, a depth-0 layer is byte-identical to the same scene without a shake, and a depth-1 layer differs.
- **SC-005**: A pan to `x: 1.5` ends one screen width to the right of a pan to `x: 0.5`.
- **SC-006**: Each malformed-shake case (non-object, missing strength, non-number strength, speed at or below 0) is dropped with a message, and the spec still renders (4 of 4).
- **SC-007**: The verify command passes offline, and the automated build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

The fifth entry, assumptions, is the Assumptions section below.

### Outcome

- **For a spec author**: a camera that can shake and can travel across a wide scene, written
  in the spec, with every frame still reproducible.
- **For a host**: nothing changes for specs that do not use either addition.

### In scope

- An optional `shake` on the spec-level camera: its two settings, validation, the transform
  in the interpreter, and the schema.
- A wider `x`/`y` range on camera keyframes.
- Checks for both in the verify command, and reference cases for the new behaviour.
- Amending spec 014's camera contract, and the constitution amendment the format change
  requires.

**Boundary change**: no new responsibility. The camera is already in the format (spec 014);
this extends it. As with specs 013 to 015, the baseline's "The format" entry and the Quality
Gates table are amended in the same change that ships it.

### Out of scope

- **Pixel mode** (the rest of #111): integer snapping and unsmoothed sampling. A later spec.
- **Rotational or zoom shake**: only left-right and up-down. Out of scope here.
- **Tiling or wrapping layers** so wide travel never shows the background: the image-layer
  work (#109).
- **Keyframes beyond two, or a shake that changes over time**: the camera keeps two
  keyframes and a constant shake; animating the shake strength is a future version.
- **Shake driven by the signal** (for example, on the beat): the existing `bind` map drives
  primitive params, not the camera; extending it is a separate decision.

### External dependencies

- None. The shake is closed-form arithmetic and the seeded random generator the library
  already has.

### Non-negotiable constraints

- **Principle I**: frames are a pure function of spec, signal and seed; chunked renders
  match; specs without the additions render byte-identically.
- **Principle IV**: a malformed shake is dropped and reported; the spec still renders.
- **Principle V**: no spec saved in validated form changes what it draws. The one intended change, an unvalidated spec with a keyframe outside 0..1, is a recorded and justified exception in the plan's Complexity Tracking and in the changelog (FR-012).
- **Principle VI**: every check runs inside the one offline verify command.

## Clarifications

### Session 2026-10-23

- Q: Should a spec saved unvalidated, with a keyframe outside 0..1, keep its old clamped rendering? → A: No. It renders at its stated position once validated by this version; the change is recorded in the changelog. Specs saved in validated form already hold clamped values and do not change.

## Assumptions

- **Strength is measured in the frame**, as a fraction of its width and height, so a shake
  looks the same at any resolution and is not magnified by zoom.
- **Bounds**: strength up to 0.05 (a twentieth of the frame) and speed up to 5 per second
  cover handheld and impact shakes and keep the shake from aliasing at 24 fps and above. They
  can be widened later without changing any frame drawn within them.
- **Range -1 to 2**: one and a half screens from the centre in each direction covers a
  several-layer parallax scroll (#111). Wider travel is better served by tiling layers.
- **Seed**: the shake uses the render seed, mixed with a fixed constant, so it is
  independent of the random streams the primitives use.
- **Reduced flicker**: does not change the shake (see Edge Cases).
- **Scope source**: issue #87, the camera-range part of #111, and the 0.5.0 plan in
  `specs/ROADMAP.md`.
