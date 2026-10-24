---

description: "Task list for designed grid patterns"
---

# Tasks: Designed Grid Patterns

**Input**: Design documents from `/specs/018-designed-grid-patterns/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pattern-and-breaks.md, quickstart.md

**Tests**: No separate test suite. The checks live in the existing validator, determinism,
registry and vetting gates and in new reference cases.

**Organization**: By user story in priority order: US1 pattern (#96), US2 breaks (#101), US3
models and vocabulary 13.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 pattern, US2 breaks, US3 models
- Paths are relative to the repository root; run commands from there.

**Standing rule**: no existing key in `golden/arm64/hashes.json` or `golden/x64/hashes.json`
may change value. A changed hash is a defect in the task, never a `golden/CHANGES.md` row.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point: branch `feature/018-designed-grid-patterns` is based on `main` at or after `b41bb03` (PR #125 merged), `.specify/feature.json` points at `specs/018-designed-grid-patterns`, `npm run verify` passes, and `git status --short golden/` is empty

---

## Phase 2: Foundational

**Purpose**: The param `example` and the parsers every story uses. Nothing renders differently yet.

- [X] T002 In `src/primitives/registry.ts` extend the `string` member of `ParamSpec` (line ~36) with `example?: string` and the comment "a valid sample value the gates probe instead of icon names (spec 018)". In `scripts/lib/goldenHashes.ts` add `example?: string` to the `string` member of `ParamSpecLike` (line ~29)
- [X] T003 [P] In `scripts/lib/gateKit.ts` `probeLayers` (line ~42): when a string param declares `example`, push `{ [k]: spec.example }` with variation `${k}=example`; otherwise keep the two icon probes. In `scripts/lib/goldenHashes.ts` `nonDefaultOverrides` (line ~420): when a string param declares `example`, set `out[name] = spec.example`, and update its doc comment ("`string` params with an `example` take it; others are skipped"). No existing param has an example, so no probe or case changes
- [X] T004 In `src/primitives/registry.ts`, near the other helpers (after line ~57), add and export `parsePattern(s: string): { cols: number; rows: number; cells: string[]; problems: string[] }` per research.md R2 and the contract: strip spaces, split on `/`, keep at most 64 rows and 64 letters per row (`pattern: cut to 64 × 64` once if either was cut), map each letter: `.`, `#`, `a`, `~` kept; `b` → `.` with `pattern: letter "b" is reserved; read as off`; anything else → `.` with `pattern: unknown letter "x" read as off` (once per distinct letter); pad short rows with `.` and report `pattern: rows padded to N columns` once; `cells` is one string per row of exactly `cols` letters. An empty or all-space input returns `{ cols: 0, rows: 0, cells: [], problems: [] }`
- [X] T005 In `src/primitives/registry.ts` add and export `parseBreaks(s: string, cols: number, rows: number): { cells: Map<string, { r: number; dx: number; dy: number }>; problems: string[] }` per research.md R3: split on `;`, trim, skip empties; an entry is `^(\d+),(\d+)((\s+(r|dx|dy)-?\d+(\.\d+)?)+)$`, else drop with `breaks: entry "…" dropped (malformed)`; keep the first 16 well-formed entries in written order and report `breaks: N entries dropped (at most 16)`; a cell with col ≥ `cols` or row ≥ `rows` is ignored with `breaks: cell c,r is outside the grid; ignored`; sum `r`, `dx`, `dy` per cell key `"c,r"`, then clamp r to -45..45 and dx, dy to -1..1. Run `npm run check`
- [X] T006 Declare the params and record vocabulary 13 in one step, because the registry gate fails on a changed primitive without a version rise. In `src/primitives/registry.ts`, add to both `grid` and `checker`:
  - `pattern: { type: "string", default: "", maxLen: 4159, example: "##.a.##/#.....#/..###../#.....#/##.a.##", desc: … }`. Grid desc: "one letter per cell, rows split by /: . off, # fg, a accent, ~ spectrum; sets the grid size". Checker desc: "… tiled from the top-left".
  - `breaks: { type: "string", default: "", maxLen: 512, example: "3,2 r15; 0,4 dx0.25", desc: "cells to turn or shift, e.g. '3,2 r15; 5,1 dx0.5 dy-0.25' (col,row from 0; r degrees -45..45; dx/dy cells -1..1)" }`.

  Then:
  - Set the descriptions to research.md R6's wording, raise `VOCABULARY_VERSION` to 13 with the changelog line "grid and checker pattern and breaks (designed grids)", and run `npm run vocab:record` and `npm run site:generate`.
  - The draws do not read the params yet, so no frame changes.
  - The gates now probe the examples, which still draw the default grid.
  - Run `npm run verify`.

**Checkpoint**: Parsers exist and are pure; vocabulary 13 is recorded; no frame changed.

---

## Phase 3: User Story 1 - Author which cells exist (Priority: P1) 🎯 MVP

**Goal**: `pattern` on grid and checker draws exactly the authored cells; no pattern → byte-identical.

**Independent Test**: The quilt's cells match the pattern at three signal levels; an all-`~` pattern equals the unpatterned grid; solid patterned grids are exact.

### Implementation for User Story 1

- [X] T007 [US1] In `grid`'s `draw` (`src/primitives/registry.ts` ~line 99), compute `const pat = parsePattern(str(l, "pattern", ""))`; when `pat.rows > 0`, use `pat.cols`/`pat.rows` instead of `cols`/`rows`, and per cell: `.` → skip; `#`/`a` → fill with `p.fg`/`p.accent` at full opacity (non-solid: `globalAlpha = 1`, same rect as today `c*cw+1, r*ch+1, cw-2, ch-2`; solid: the solid branch's whole-pixel rect); `~` → today's intensity code for that cell unchanged. Gridlines as today for the pattern's size. When `pat.rows === 0`, run today's code with no change to its canvas calls
- [X] T008 [US1] In `checker`'s `draw` (~line 183), when a pattern is set, the letter for square (c, r) is `pat.cells[r % pat.rows][c % pat.cols]`: `#`/`a` fill the square with fg/accent, `.` leaves it, `~` keeps today's `on !== lit` rule for that square. Without a pattern, today's code is unchanged
- [X] T009 [US1] In `src/specValidator.ts`, next to the bind reporting in the layer loop (~line 129): for a sanitized layer whose type is `grid` or `checker` and whose `pattern` is non-empty, push each `parsePattern(clean.pattern).problems` entry prefixed with the type (`grid pattern: …`). Import `parsePattern` from the registry
- [X] T010 [P] [US1] In `scripts/verify-spec-validator.ts` add pattern cases: a valid quilt reports nothing; `"#x#"` reports the unknown letter; `"#b#"` reports the reserved letter; `"###/#"` reports padding; a 70-letter row reports the cut; each layer is still present in `spec.layers`
- [X] T011 [US1] In `scripts/verify-determinism.ts` add a section "Designed patterns (spec 018)" with a 320×180 render helper (seed 7). Quilt `"##.a.##/#.....#/..###../#.....#/##.a.##"` with `solid: true`, at frames with levels 0.02, 0.5 and 0.95: for each cell, the pixel at the cell centre is bg for `.`, fg for `#` and accent (creative on, accent `#ff2d2d`) for `a` ("quilt cells match the pattern at quiet, mid and loud", SC-002). Add: "designed cells ignore the signal" (the non-solid quilt is identical at quiet and loud); "an all-~ pattern equals the unpatterned grid" (`pattern` of 7 columns × 5 rows of `~` equals `{ cols: 7, rows: 5 }`); "solid pattern uses only bg, fg and accent" (SC-006 without breaks); "patterned chunk render equals the whole"; "a transparent patterned grid has alpha 0 in . cells"; "checker pattern tiles" (square (c, r) and (c + pat.cols, r) match)
- [X] T012 [US1] Run `npm run verify`; confirm it passes and `git diff --stat golden/` is empty. Read the budget gate's info lines and confirm `grid` and `checker` (now probed with the example) stay under 3,000 ops

**Checkpoint**: The quilt renders natively; nothing existing moved.

---

## Phase 4: User Story 2 - Break the grid once, on purpose (Priority: P2)

**Goal**: `breaks` rotate or shift named cells, order-independent, exact under `solid`.

**Independent Test**: One break changes only its cell's area; two orderings are identical; solid with a rotation stays exact.

### Implementation for User Story 2

- [X] T013 [US2] In both draws, `const brk = parseBreaks(str(l, "breaks", ""), cols, rows)` (the effective grid size; for checker, the board's squares). In the main cell pass, skip cells whose key is in `brk.cells`. After the pass, for each broken cell in row-major order, draw what the cell would draw (fg/accent/spectrum-lit; nothing if off) transformed: non-solid → `save`, `translate` to the cell centre plus `(dx·cw, dy·ch)`, `rotate(r·π/180)`, `fillRect(-w/2, -h/2, w, h)` with the cell's normal width and height, then `restore`
- [X] T014 [US2] Under `solid` in `grid`, draw a broken cell exactly: snap the moved centre to whole pixels; for each pixel row `y` across the rotated rectangle's bounding box, compute the interval of pixel-centre `x` values (`x + 0.5`) inside the rotated rectangle (intersect the row with its four edges) and `fillRect(xStart, y, xEnd - xStart, 1)` when non-empty. No anti-aliased edge (FR-007). Put the helper next to the grid entry as `fillRotatedRectSolid(ctx, cx, cy, w, h, rad)`
- [X] T015 [US2] In `src/specValidator.ts` extend T009: for a non-empty `breaks`, push `parseBreaks(clean.breaks, cols, rows).problems`, prefixed with the type. The grid size is the pattern's when set, else `cols`/`rows`; for checker, `ceil(320/size)` × `ceil(180/size)` cannot be known without dimensions, so for checker skip the outside-the-grid report and report only malformed and excess entries (note this in the contract's validation table)
- [X] T016 [P] [US2] In `scripts/verify-spec-validator.ts` add breaks cases: `"3,2 r15"` reports nothing; `"3,2 spin"` reports malformed; 17 entries report one dropped; `"40,2 r10"` on a 7-column quilt reports outside the grid; `"1,1 r90"` reports nothing and the draw clamps (checked in T017)
- [X] T017 [US2] In `scripts/verify-determinism.ts` add: "a break leaves every other pixel unchanged" (quilt with `"3,2 r15"` vs without: every pixel outside the union of the cell's original rectangle and its rotated bounding box is identical, SC-003); "break order does not matter" (`"1,1 r10; 3,2 dx0.5; 5,3 dy-0.25"` and the reverse order are byte-identical, SC-004); "a cell named twice adds" (`"3,2 r10; 3,2 r5"` equals `"3,2 r15"`); "breaks clamp" (`"3,2 r90"` equals `"3,2 r45"`); "solid pattern with a rotated break uses only bg, fg and accent" (SC-006); "broken chunk render equals the whole"
- [X] T018 [US2] Run `npm run verify`; confirm it passes, no existing hash moved, and the budget lines still hold

**Checkpoint**: The grid can be broken once, on purpose, deterministically.

---

## Phase 5: User Story 3 - Models can write patterns (Priority: P3)

**Goal**: The descriptions carry the grammar; vocabulary 13 is recorded.

**Independent Test**: `buildVocabPrompt` for a selection with grid shows the letters; the record is at 13.

### Implementation for User Story 3

- [X] T019 [US3] In `scripts/verify-registry.ts` add a check that `buildVocabPrompt([getPrimitive("grid")!, getPrimitive("checker")!])` contains `pattern`, `breaks`, `# fg` and `~ spectrum`, so the grammar cannot silently drop out of the prompt models see
- [X] T020 [US3] In `scripts/verify-spec-validator.ts` add "a model-style spec validates": the quilt with `breaks` written as a model would (extra spaces, a trailing `;`), with no problems reported, rendering the same as the tidy form
- [X] T021 [US3] Run `npm run verify`; confirm it passes

**Checkpoint**: All three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 Add `PATTERN_CASES` to `scripts/lib/goldenHashes.ts` (like `PARAM_CASES`, validated layers, `reducedFlicker: true`) and render them in `renderCases`: `grid:pattern-quilt` (the quilt, non-solid, `creative: false`), `grid:pattern-solid` (the quilt with `solid: true`, `creative: true` with accent `#ff2d2d`), `grid:pattern-breaks` (the quilt, solid, `breaks: "3,2 r15; 0,4 dx0.25"`), `checker:pattern` (`pattern: "#a/~."`, `size: 40`). Run `npm run golden:update` (Docker running): 12 added per set, 0 changed, cross-type within 8; add a `golden/CHANGES.md` row per case with spec `018`
- [X] T023 [P] Add two cases to `scripts/lib/showcase.ts` under `since: "0.6.0"`: "Quilt pattern" (the solid quilt, creative with an accent) and "Break it once" (the quilt with `breaks: "3,2 r15"`). Run `npm run showcase:generate` and `npm run site:generate`
- [X] T024 [P] In `docs/user-guide.md`, add a "Designed grids" section after the transparent-background section: the pattern letters, grid sizing versus checker tiling, `breaks` grammar and bounds, `solid`, and that bad input is reported, not fatal. Add a `CHANGELOG.md` "Unreleased" bullet for the params (#96, #101) and vocabulary 13. Run `npm run site:generate`
- [X] T025 Update `specs/ROADMAP.md`: add a 018 row ("Designed grid patterns (#96, #101)", 0.6.0, "Implemented on branch `feature/018-designed-grid-patterns`") and a 019 row ("Second tone (#97); Principle III amendment first", 0.6.0, "Not started"); remove #96 and #101 from the "Per-cell grid data" planned cluster
- [X] T026 Run every step of `specs/018-designed-grid-patterns/quickstart.md`, including step 6 by eye, record outcomes in a new `specs/018-designed-grid-patterns/validation.md`, and set the spec's Status to "Implemented (unreleased; ships in 0.6.0)"
- [ ] T027 Commit, push the branch, open a pull request into `main` in milestone 0.6.0 that closes #96 and #101, and wait for its Verify check to finish and pass before asking the maintainer to merge

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T006)** → stories.
- **US1 (T007–T012)** needs T002–T006. **US2 (T013–T018)** needs T005 and US1's draw changes (same functions). **US3 (T019–T021)** needs T006 (the params and descriptions) and is otherwise independent.
- **Polish** needs all stories; T022 before T026.

### Tasks that share a file

- `src/primitives/registry.ts`: T002, T004, T005, T006, T007, T008, T013, T014
- `src/specValidator.ts`: T009, T015
- `scripts/verify-spec-validator.ts`: T010, T016, T020
- `scripts/verify-determinism.ts`: T011, T017
- `scripts/lib/goldenHashes.ts`: T002, T003, T022

### Parallel opportunities

- T003 alongside T004–T005 (different files).
- T010 alongside T007–T009; T016 alongside T013–T015.
- T023 with T024.

## Parallel Example: User Story 1

```text
# After T004:
Task: "T007 grid pattern draw, src/primitives/registry.ts"
Task: "T010 pattern validation cases, scripts/verify-spec-validator.ts"
```

## Implementation Strategy

### MVP (User Story 1)

T001–T012: the quilt renders natively from a pattern, nothing existing moved. Mergeable alone;
vocabulary 13 is already recorded in T006.

### Incremental delivery

1. US1 → patterns.
2. US2 → breaks.
3. US3 → descriptions and vocabulary 13.
4. Polish → reference cases, showcase, docs, roadmap, PR.

### Notes

- Every task ends with `npm run verify` passing.
- `npm run golden:update` runs once, in T022, and must report 0 changed existing cases.
- `npm run vocab:record` runs once, in T020, after both params exist.
