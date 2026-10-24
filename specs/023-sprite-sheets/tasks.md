---

description: "Task list for sprite sheets"
---

# Tasks: Sprite Sheets

**Input**: Design documents from `/specs/023-sprite-sheets/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sprite-sheets.md, quickstart.md

**Tests**: No separate suite. The checks go in the existing gates, plus new reference cases.

**Organization**: US1 plays a sheet. US2 makes the existing `image` features apply per cell.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- No gate or tolerance edits.
- At most 3 failed `npm run verify` attempts.
- Fixtures are drawn in code.
- Showcase loops are inspected by rendering real pixels. Decode any file with `loadImage`.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point:
  - Branch `feature/023-sprite-sheets` is based on `main` at `aafb5ab`.
  - `.specify/feature.json` points at `specs/023-sprite-sheets`.
  - `npm run verify` passes.
  - `docker info` works.

---

## Phase 2: Foundational

- [X] T002 In `scripts/lib/goldenHashes.ts` `goldenAssets()`, add `sheet`:
  - A 64 × 16 canvas of four 16 × 16 cells.
  - Cell `i` has a background block in a distinct colour (`#c83030`, `#30a050`, `#3050c8`, `#e0c040`).
  - Each cell also has a 4 × 4 white "leg" square at `x = 2 + 3i`, `y = 10`, so the cell index can be read from fixed pixels.

  This changes nothing yet: no case uses it.

---

## Phase 3: User Story 1 - Play a sprite sheet (Priority: P1) 🎯 MVP

**Goal**: The `image` layer shows one sheet cell per frame, chosen as a closed form of time.

**Independent Test**: For the 4-frame, 8 fps fixture, the cell shown at each of 16 frame indices matches `(frameStart + floor(t·fps)) mod 4`, and any frame rendered alone equals the same frame in sequence.

- [X] T003 [US1] In `src/primitives/registry.ts`, the `image` entry params (after `srcH`), add exactly per data-model.md:
  - `sheetCols` (number 1..64, default 1, desc "sprite sheet columns");
  - `sheetRows` (number 1..64, default 1, desc "sprite sheet rows");
  - `frames` (number 0..4096, default 0, desc "frames used, in reading order; 0 = every cell");
  - `fps` (number 0..60, default 8, desc "sheet playback rate; 0 holds frameStart");
  - `frameStart` (number 0..4095, default 0, desc "first frame of the cycle").
- [X] T004 [US1] In the `image` draw (around line 601), compute the current cell before the source rect, per research.md R1:
  - `cols` and `rows` rounded and clamped; `cellW = floor(asset.width / cols)` and `cellH = floor(asset.height / rows)`.
  - `count = frames > 0 ? min(round(frames), cols·rows) : cols·rows`.
  - `i = fps > 0 ? (round(frameStart) + floor(f.t·fps)) mod count : round(frameStart) mod count`, with the mod kept non-negative.
  - `cx = (i mod cols)·cellW` and `cy = floor(i / cols)·cellH`.
  - Replace the source rect with `sx = cx + round(srcX·cellW)`, `sw = min(cellW − (sx − cx), round(srcW·cellW))`, and likewise for y.
  - Return when `cellW` or `cellH` is less than 1.

  Add a comment that the defaults reproduce the pre-023 expressions exactly.
- [X] T005 [US1] Run `npm run check && npm run verify:determinism`. The only failures allowed are missing-hash and vocabulary ones. Every existing hash, `image@*` and `image:*` included, must be unchanged.
- [X] T006 [US1] In `scripts/verify-determinism.ts`, add a "Sprite sheets (spec 023)" block inside the spec 022 image block's helpers, or as a sibling block reusing its pattern. Use `sheetCols: 4`, `fps: 8`, `fit: none`, `scale: 4`, `drive: none` and creative mode. Check:
  - (a) For frame indices 0..15 (`t = i/30`), the cell read from the leg-square pixel position equals `floor(t·8) mod 4`, 16 of 16.
  - (b) `frameStart: 2` shifts the cell by 2.
  - (c) `fps: 0` with `frameStart: 3` shows cell 3 at every index.
  - (d) `frames: 3` never shows cell 3.
  - (e) Frame 37 rendered alone equals frame 37 within a 30–40 sequence.

**Checkpoint**: Sheets play with exact seeking.

---

## Phase 4: User Story 2 - Existing image features apply per cell (Priority: P2)

**Goal**: Flip, the source rect, fit and wrap, and the colour modes act on the current cell.

**Independent Test**: A flipped sheet frame equals the mirrored cell, pixel for pixel, at nearest smoothing.

- [X] T007 [P] [US2] In `scripts/verify-determinism.ts`, check:
  - `flip: x` on the sheet at frame 0 equals cell 0 mirrored, not the sheet mirrored (compare against an unflipped single-cell render).
  - `srcW: 0.5` trims within the cell (only the left 8 px of the cell are drawn).
  - `colour: palette` gives only palette colours across four frames.

---

## Phase 5: Vocabulary, references, showcase

- [X] T008 Raise `VOCABULARY_VERSION` from 15 to 16 in `src/primitives/registry.ts`, then run `npm run vocab:record -- "spec 023: sprite sheets on image (sheetCols, sheetRows, frames, fps, frameStart)"`.
- [X] T009 In `scripts/lib/goldenHashes.ts`, add three cases with `assets: { sheet: { sha256: ZERO_SHA, width: 64, height: 16 } }`:
  - `image:sheet-walk`: creative, `sheetCols: 4`, `fps: 8`, `fit: none`, `scale: 4`, `drive: none`.
  - `image:sheet-start`: the same, plus `frameStart: 2` and `flip: x`.
  - `image:sheet-fps0`: creative false, `fps: 0`, `frameStart: 3`, `colour: palette`, `fit: none`, `scale: 4`.

  Run `npm run golden:update`. Confirm key by key against `main`: 0 changed, 9 added. Add `golden/CHANGES.md` rows (2026-10-24, spec 023, both).
- [X] T010 In `scripts/lib/showcase.ts`, add `sheet-walk` (since `0.8.0`, a loop, creative), with an in-code 8-frame, 32 × 40 walk sheet supplied through the case's `assets` factory:
  - The art is a simple figure with legs and arms in 8 poses, using fixed colours.
  - The figure is centred at `scale: 3`, `fps: 8`, `drive: none`, over a `dither` ground band.

  Run `npm run showcase:generate` and `npm run site:generate`. Render a frame strip (frames 0, 4, 8, 12) from real pixels and confirm the pose changes.

---

## Phase 6: Polish

- [X] T011 [P] Docs:
  - `docs/user-guide.md` "Images": a "Sprite sheets" paragraph with the five params and the frame formula.
  - `CHANGELOG.md` Unreleased: a bullet, with the vocabulary at 16.
  - `specs/ROADMAP.md`: a 023 row, and the "Image assets" row noting that #110 is in 023.
- [X] T012 Run `npm run verify`, at most 3 failed attempts.
- [X] T013 Commit, push, and open the PR ("feat(image): sprite sheets (spec 023)"). Comment on #110.

---

## Dependencies & Execution Order

- T001 → T002 → T003 → T004 → T005 → T006.
- T007 can run in parallel with T006 (same file region; do it sequentially in practice).
- T008 → T009 → T010.
- T011 can run alongside T010. Then T012, then T013.

## Parallel Examples

- T011 (docs) alongside T010 (showcase).

## Implementation Strategy

- **MVP**: Phases 1–3. Sheets play with exact seeking.
- **Then**: the per-cell checks, references, showcase and docs.
- One PR.
