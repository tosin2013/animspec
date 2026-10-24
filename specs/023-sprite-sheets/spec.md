# Feature Specification: Sprite Sheets

**Feature Branch**: `feature/023-sprite-sheets`

**Created**: 2026-10-24

**Status**: Shipped in 0.8.0

**Input**: Issue #110 (user-supplied sprite sheets: frames, fps, flip). This builds on spec 022's image assets. Maintainer decisions (2026-10-24):

- Sprite sheets are params on the existing `image` primitive, not a new primitive.
- The order of the next specs is 023 (this), then 024 (plugin slot, #92), then 025 (clip sequences, #91).

## User Scenarios & Testing *(mandatory)*

Spec 022 lets art into a spec, but a picture still only moves as a whole: it scrolls, zooms
or fades. A character's run cycle, a flickering torch or a blinking sign is drawn as a
**sprite sheet**: several frames laid out in a grid in one image. Callers have had to swap
frames by hand in their own code (#110's parallax-forest test). That breaks seeking and
defeats a declarative spec.

### User Story 1 - Play a sprite sheet (Priority: P1)

An author declares a sheet image as an asset and tells the `image` layer how the sheet is laid
out (columns, rows, frame count) and how fast to play it. The layer shows one frame at a time,
cycling.

**Why this priority**: This is #110's core request, and the reason the spec exists.

**Independent Test**: A 4-frame sheet at 8 fps shows frame 0 at t = 0, frame 1 at t = 0.125 s, and frame 0 again at t = 0.5 s.

**Acceptance Scenarios**:

1. **Given** an `image` layer with `sheetCols: 4`, `sheetRows: 1` and `fps: 8`, **When** frames are rendered over time, **Then** each frame shows one cell of the sheet, advancing every 1/8 s and wrapping after the last.
2. **Given** a sheet laid out in several rows, **When** it plays, **Then** cells are taken left to right, then top to bottom.
3. **Given** `frames` set below `sheetCols × sheetRows`, **When** it plays, **Then** only the first `frames` cells are used. This handles sheets with empty trailing cells.
4. **Given** `fps: 0`, **When** it is rendered, **Then** the layer holds a single frame, `frameStart`.
5. **Given** `frameStart`, **When** it plays, **Then** the cycle begins at that cell. Two layers with different starts can share one sheet without moving in lockstep.
6. **Given** any frame index, **When** it is rendered alone, **Then** it equals that frame from a sequential render. Seeking is exact.

---

### User Story 2 - Everything `image` already does still applies (Priority: P2)

A sheet frame is placed, fitted, flipped, faded, tiled, scrolled and colour-mapped exactly as a
whole image is today.

**Why this priority**: Characters need to face both ways and walk across scrolling
backgrounds. Reusing `image` gives that at no extra cost.

**Independent Test**: A flipped, scrolling sheet layer renders each frame as the matching cell, mirrored and moved.

**Acceptance Scenarios**:

1. **Given** `flip: x` on a sheet layer, **When** rendered, **Then** the current cell is mirrored, not the whole sheet.
2. **Given** a source rect (`srcX`…`srcH`) on a sheet layer, **When** rendered, **Then** it applies within the current cell, trimming each frame the same way.
3. **Given** `colour: palette`, or no creative mode, **When** rendered, **Then** each frame is mapped to the palette, exactly as a whole image is.
4. **Given** `fit`, `scale`, `anchor` and `wrap`, **When** rendered, **Then** they size and place one cell, not the whole sheet.

### Edge Cases

- **Defaults**: `sheetCols: 1`, `sheetRows: 1` and `frames: 0` mean "the whole image is one frame", so every existing `image` layer renders byte-identically.
- **A sheet whose size isn't a multiple of the grid**: the cell size is `floor(width / cols)` × `floor(height / rows)`, and the leftover pixels at the right and bottom are never drawn.
- **`frames` larger than the grid**: clamped to `cols × rows`.
- **`frameStart` beyond the frame count**: taken modulo the frame count.
- **The camera and `depth`**: unchanged; they apply to the layer as a whole.
- **`drive: level`**: the size pulse still applies, and the frame choice does not depend on the signal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `image` MUST gain the params `sheetCols` and `sheetRows` (1 to 64, default 1), `frames` (0 to 4096; 0 means every cell), `fps` (0 to 60, default 8) and `frameStart` (0 to 4095, default 0).
- **FR-002**: The current frame MUST be `(frameStart + floor(t × fps)) mod frameCount`, where `t` is the frame time and `frameCount` is `frames` (or every cell when 0), clamped to the grid. With `fps: 0` it MUST be `frameStart mod frameCount`.
- **FR-003**: Cells MUST be taken left to right, then top to bottom. A cell is `floor(width / cols)` by `floor(height / rows)` pixels.
- **FR-004**: The source rect, flip, fit, scale, anchor, placement, opacity, smoothing, wrap, scroll and colour mode MUST apply to the current cell exactly as they do to a whole image.
- **FR-005**: With the default params, every `image` layer MUST render byte-identically to before this feature.
- **FR-006**: A frame MUST be a pure function of spec, assets, signal and seed, with exact seeking, identical twice-rendered and chunked output, and output within the cross-type tolerance.
- **FR-007**: The vocabulary version MUST rise (new params). Every check MUST run inside the one offline verify command.

### Key Entities

- **Sprite sheet**: an image asset laid out as a grid of equal cells, read in reading order.
- **Frame selection**: the cell shown at a given time, computed from the frame time alone.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical, in both reference sets.
- **SC-002**: For a 4-frame, 8 fps sheet, the cell shown at each of 16 sampled frame indices matches the formula in 16 of 16 cases.
- **SC-003**: Any frame rendered alone equals the same frame from a sequential render (checked on at least three indices across a wrap).
- **SC-004**: A flipped sheet frame equals the mirrored cell, pixel for pixel, at nearest smoothing.
- **SC-005**: Verify passes offline, and the build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For authors, artists and Motion Studio**: animated art (walk cycles, flickers, blinks) from a single sheet, declared in the spec, with exact seeking.

### In scope

- Five new params on `image`, and the frame-selection rule.
- Reference cases from an in-code sheet, a showcase loop, checks and docs.

**Boundary change**: none. These are new params on an existing primitive, so a vocabulary change. There is no format change and no constitution amendment.

### Out of scope

- **Named pose rows** (idle, walk, jump) chosen by motion, the way built-in `sprite` characters do it. That is possible later, as an enum.
- **Variable frame durations** and per-frame offsets.
- **Animated image formats** (GIF, APNG).
- **The plugin slot** (#92, spec 024) and **clip sequences** (#91, spec 025).

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: frame selection is a closed form of time, so seeking is exact and chunks match.
- **Principle III (5.0.0)**: colour rules are unchanged (asset colours only in `asset` mode in creative mode).
- **Principle V**: every existing frame is unchanged.
- **Principle VI**: one offline verify command.

## Assumptions

- **64 × 64 cells and 4,096 frames** cover any practical sheet.
- **8 fps by default** suits pixel-art walk cycles. Authors set what their art was drawn for.
- **Reading order** (left to right, top to bottom) matches how sheets are commonly exported.
- **Scope source**: issue #110, spec 022, and the maintainer decisions of 2026-10-24.
