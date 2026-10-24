# Feature Specification: Designed Grid Patterns

**Feature Branch**: `feature/018-designed-grid-patterns`

**Created**: 2026-10-23

**Status**: Implemented (unreleased; ships in 0.6.0)

**Input**: Issues #96 (per-cell data for `grid` and `checker`) and #101 (per-cell transform overrides), planned for 0.6.0. Maintainer decisions (2026-10-23): a `pattern` string param, rows separated by `/`, one letter per cell (`.` off, `#` fg, `a` accent, `~` lit by the signal as today, one letter reserved for the spec-019 second tone), default empty so every existing frame is byte-identical; a `breaks` string param for a deliberate per-cell irregularity (rotate about the cell centre, offset by cell fractions), order-independent and clamped; honours `solid` and the transparent background; vocabulary 13. The second tone (#97) is spec 019.

## User Scenarios & Testing *(mandatory)*

`grid` lights its cells from the frame's spectrum, column by column, and `checker` flips its
squares the same way. An author cannot say which cells exist. A caller's quilt test (#96) came
back as a solid slab: all 35 cells lit, where the design needed about 40% empty fabric. Any
designed pattern (a quilt, a mosaic, a board, a reserved text zone) is impossible natively.
The caller's words: this one is "the authoring capability itself".

A related request (#101): pattern designs often need one deliberate break ("build the grid,
break it once": one block rotated, one shifted). Faked in post, the break reads as damage
instead of design.

### User Story 1 - Author which cells exist (Priority: P1)

A spec author (a person or a model) writes a small text picture of the grid, one letter per
cell, and the grid draws exactly that picture: empty cells stay empty, filled cells take the
foreground or the accent, and cells the author leaves to the signal keep reacting as today.

**Why this priority**: It is #96 and the core of the feature; without it no designed pattern
exists.

**Independent Test**: Render a grid with the 7×5 quilt pattern from #96 and confirm every
`.` cell is background, every `#` cell foreground and every `a` cell accent, at every
signal level.

**Acceptance Scenarios**:

1. **Given** a grid with a pattern of 5 rows of 7 letters, **When** a frame is rendered, **Then** the grid has 7 columns and 5 rows, and each cell shows its letter: `.` nothing, `#` the foreground colour, `a` the accent colour.
2. **Given** the same patterned grid at a quiet and a loud signal, **When** both are rendered, **Then** every `.`, `#` and `a` cell looks the same in both: designed cells do not react to the signal.
3. **Given** a pattern with `~` cells, **When** the signal changes, **Then** only the `~` cells light and fade with the spectrum, exactly as unpatterned cells do today.
4. **Given** a grid or checker without a pattern, **When** it is rendered after this feature, **Then** every frame is byte-identical to before.
5. **Given** a patterned grid with `solid: true`, **When** a frame is rendered, **Then** every pixel is exactly the background, foreground or accent colour.
6. **Given** a patterned spec with a transparent background (spec 017), **When** a frame is rendered, **Then** `.` cells are fully transparent and `#` cells are opaque foreground.
7. **Given** a checker with a pattern, **When** a frame is rendered, **Then** the pattern repeats across the board's squares from the top-left, each square showing its letter.

---

### User Story 2 - Break the grid once, on purpose (Priority: P2)

An author names one or a few cells and turns or shifts them: one block rotated 15° about its
centre, one cell nudged half a cell to the right. Every other cell stays in place.

**Why this priority**: It is #101, a design move that today only happens in post. It builds on
the first story's cell addressing.

**Independent Test**: Render a patterned grid with one break that rotates cell (3, 2) by 15°
and confirm that cell is drawn rotated about its centre while every other cell is
byte-identical to the same grid without the break.

**Acceptance Scenarios**:

1. **Given** a break that rotates one cell, **When** a frame is rendered, **Then** that cell is drawn turned about its own centre by the stated angle, and every other cell is unchanged.
2. **Given** a break that offsets one cell by a fraction of a cell, **When** a frame is rendered, **Then** that cell is drawn moved by that fraction, and every other cell is unchanged.
3. **Given** the same breaks written in a different order, **When** frames are rendered, **Then** they are byte-identical.
4. **Given** a break naming a cell outside the grid, an angle or offset past its bound, or a malformed entry, **When** the spec is validated, **Then** out-of-bounds values are clamped, a cell outside the grid is ignored, and malformed entries are dropped and reported; the rest of the layer still renders.

---

### User Story 3 - Models can write patterns (Priority: P3)

A model writing a spec from the vocabulary prompt and schema can see the `pattern` and `breaks`
params, what their letters and entries mean, and their size limits.

**Why this priority**: Most specs are written by models; a param they cannot read about is
barely there.

**Independent Test**: The vocabulary prompt and the JSON schema describe both params with
their letters, grammar and limits; a pattern a model would plausibly write validates and
renders.

**Acceptance Scenarios**:

1. **Given** the vocabulary prompt for a selection that includes `grid`, **When** a model reads it, **Then** `pattern` and `breaks` are listed with their letters and grammar.
2. **Given** the vocabulary record, **When** this feature ships, **Then** the vocabulary version rises to 13 and the record lists the new params.

---

### Edge Cases

- **Ragged rows**: a row shorter than the longest row is padded with `.` (off); this is
  reported.
- **Unknown letters**: read as `.` and reported, so a typo leaves a hole rather than breaking
  the layer.
- **Too large**: a pattern beyond 64 columns or 64 rows is cut to 64 × 64 and reported.
- **Empty pattern** (`""`, the default): the layer behaves exactly as today.
- **Pattern and `cols`/`rows` on grid**: the pattern decides the grid's size; `cols` and
  `rows` are ignored while a pattern is set.
- **Checker square size**: `size` still sets the square size; the pattern tiles across the
  squares, repeating from the top-left.
- **The letter reserved for the second tone** (`b`, spec 019): read as `.` and reported until
  spec 019 gives it a meaning, so a pattern written for 019 still renders.
- **Breaks on an off cell**: a break moves what the cell draws; an off cell draws nothing, so
  nothing moves.
- **A broken cell crossing its neighbours**: a rotated or offset cell may overlap the cells
  around it; it is drawn after them, on top.
- **Many breaks**: at most 16 are applied; more are dropped and reported.
- **`threshold` with a pattern**: applies to `~` cells only.
- **Camera, bind and transparency**: a patterned layer works with the camera, with `bind` on
  its number params, and with the transparent background, unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Pattern (#96)**

- **FR-001**: `grid` and `checker` MUST accept an optional `pattern` param: a string of rows separated by `/`, one letter per cell.
- **FR-002**: The letters MUST mean: `.` off (background), `#` foreground, `a` accent, `~` lit by the spectrum exactly as unpatterned cells are today.
- **FR-003**: Without a pattern (the default empty string), both primitives MUST render byte-identically to before this feature.
- **FR-004**: On `grid`, a pattern MUST set the number of columns (the longest row) and rows (the number of rows); `cols` and `rows` MUST be ignored while a pattern is set.
- **FR-005**: On `checker`, a pattern MUST tile across the squares from the top-left; `size` keeps setting the square size.
- **FR-006**: Designed cells (`.`, `#`, `a`) MUST NOT change with the signal; only `~` cells react.
- **FR-007**: Patterned cells MUST honour `solid`: with `solid: true`, every pixel is exactly the background, foreground or accent colour.
- **FR-008**: A pattern MUST be at most 64 columns by 64 rows. Larger patterns MUST be cut to that size and the cut reported.
- **FR-009**: Short rows MUST be padded with `.`, and unknown letters (including the letter `b` reserved for spec 019) MUST be read as `.`. Both MUST be reported by the validator, and the layer MUST still render.

**Breaks (#101)**

- **FR-010**: `grid` and `checker` MUST accept an optional `breaks` param: a list of entries, each naming one cell by column and row (counted from 0 at the top-left) with a rotation in degrees and/or an offset in fractions of a cell.
- **FR-011**: A rotation MUST turn the cell's drawing about the cell's own centre; an offset MUST move it. Rotation MUST be clamped to -45..45 degrees and each offset to -1..1 cells.
- **FR-012**: Every cell not named by a break MUST draw exactly as without breaks, except where a broken cell is drawn over it.
- **FR-013**: The result MUST NOT depend on the order of the entries. If a cell is named more than once, its rotations add and its offsets add, and the sums are clamped.
- **FR-014**: At most 16 breaks MUST be applied. Malformed entries and entries beyond 16 MUST be dropped and reported, and entries naming a cell outside the grid MUST be ignored; the layer still renders.
- **FR-015**: Without breaks (the default empty string), the layer MUST render byte-identically to the same layer before this feature.

**Everywhere**

- **FR-016**: Frames MUST stay a pure function of spec, signal and seed; patterned and broken layers MUST render identically twice and in chunks, and within the cross-type tolerance.
- **FR-017**: The vocabulary prompt and JSON schema MUST describe both params, their letters and grammar, and their limits; the vocabulary version MUST rise to 13.
- **FR-018**: All checks MUST run inside the one offline verify command.

### Key Entities

- **Pattern**: a small text picture of a grid; each letter is one cell's role (off, foreground, accent, signal).
- **Break**: an instruction for one named cell: turn it by an angle, move it by a fraction of a cell, or both.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical after this feature, in both reference sets.
- **SC-002**: The 7×5 quilt pattern from #96 renders with 100% of its `.` cells empty, 100% of its `#` cells foreground and 100% of its `a` cells accent, at quiet, mid and loud signal levels.
- **SC-003**: With one break, 100% of the pixels outside the broken cell's area (before and after its move) are byte-identical to the same grid without breaks.
- **SC-004**: Breaks written in any order give byte-identical frames (checked on at least two orderings of three breaks).
- **SC-005**: Each malformed-input case (unknown letter, ragged row, oversized pattern, malformed break, too many breaks) is reported and the layer still renders (5 of 5).
- **SC-006**: A patterned grid with `solid: true` has 0 pixels outside the background, foreground and accent colours.
- **SC-007**: The verify command passes offline, and the automated build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

The fifth entry, assumptions, is the Assumptions section below.

### Outcome

- **For a spec author or model**: designed grids (quilts, mosaics, boards, reserved zones)
  written in the spec, with one deliberate break where the design wants it, every frame
  reproducible.
- **For a host**: nothing changes for specs that do not use the new params.

### In scope

- The `pattern` and `breaks` params on `grid` and `checker`: their grammar, validation,
  drawing, and their description in the vocabulary prompt and schema.
- Vocabulary version 13 and its record.
- Checks in the verify command, reference cases, and a showcase example.

**Boundary change**: none. New params on existing primitives are a vocabulary change, as in
0.4.0. Both params are ordinary string params with declared defaults and a maximum length, so
Principle II's rule that every param declares its type, bounds and default holds unchanged.

### Out of scope

- **A second tone** (#97): spec 019, with its Principle III amendment. Its pattern letter `b`
  is reserved here.
- **Per-cell tone or opacity** beyond off / foreground / accent / signal.
- **Patterns on other primitives** (`dots`, `led`, `tetris`): later, if asked for.
- **Structured (array or object) params**: not needed; a pattern is a string.
- **Palette profiles and sprite format v2** (#102 to #107).
- **Animated patterns** (a pattern that changes over time): one pattern per layer.

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure function of spec, signal and seed; chunked renders match; within the
  cross-type tolerance.
- **Principle II**: both params live in the registry entries, declared with type, default and
  maximum length; the prompt, schema and validator follow from them.
- **Principle III**: patterned cells colour only with background, foreground and accent.
- **Principle IV**: malformed patterns and breaks are corrected or dropped and reported; the
  layer still renders.
- **Principle V**: every existing frame is unchanged (both params default to empty).
- **Principle VI**: every check runs inside the one offline verify command.

## Assumptions

- **Designed cells are static.** A quilt is fabric, not a meter; authors who want reaction
  use `~`.
- **Designed cells draw at full strength.** `#` and `a` cells are opaque; the faint
  background gridlines stay as today unless `solid` removes them.
- **Grid takes its size from the pattern; checker tiles it.** A grid is the design; a checker
  is a board that fills the frame.
- **64 × 64 is enough** for any pattern a model writes by hand, and bounds the work per frame.
- **16 breaks is enough** for "break it once"; the bound keeps the grammar small.
- **Breaks use cell coordinates counted from 0 at the top-left**, the same for grid and
  checker.
- **Scope source**: issues #96 and #101, the 0.6.0 milestone, and the plan of 2026-10-23.
