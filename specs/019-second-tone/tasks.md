---

description: "Task list for the second tone"
---

# Tasks: Second Tone

**Input**: Design documents from `/specs/019-second-tone/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/second-tone.md, quickstart.md

**Tests**: No separate test suite. The checks live in the existing gates, plus new reference
cases.

**Organization**: US1 draws the second tone (#97). US2 makes it readable to models.

## Format: `[ID] [P?] [Story] Description`

- Paths are relative to the repository root.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- Never change a gate threshold or tolerance to make verify pass.
- At most 3 failed `npm run verify` attempts, then stop and report.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point:
  - Branch `feature/019-second-tone` is based on `main` at `a969d66` (PR #129 merged).
  - `.specify/feature.json` points at `specs/019-second-tone`.
  - `npm run verify` passes.
  - `docker info` works.

---

## Phase 2: Foundational

- [X] T002 In `src/primitives/registry.ts`, after `sanitizeRoles`, export:
  - `FG2_ROLE = "fg2"`.
  - `FG2_MONO = "#808080"`, with the comment "the second tone's monochrome value: an even bg–fg mix, the same on black and white (spec 019)".
  - `PRIMITIVE_ROLES: readonly string[] = [FG2_ROLE]`, with the comment "named roles read by primitives rather than characters".
  - A helper `secondTone(p: Palette): string`, returning `p.roles?.[FG2_ROLE] ?? FG2_MONO`.

  This moves nothing.

---

## Phase 3: User Story 1 - Draw a second tone (Priority: P1) 🎯 MVP

**Goal**: `b` cells draw `roles.fg2` in creative mode, and `#808080` otherwise.

**Independent Test**: Render a solid grid with pattern `#b.a/b#.b` and `roles.fg2` set, in creative mode. Every `b` cell is exactly `fg2`. With creative mode off, every `b` cell is exactly `#808080`.

- [X] T003 [US1] In `src/primitives/registry.ts` `parsePattern` (line ~106):
  - Accept `b` as a cell letter alongside `.`, `#`, `a` and `~`.
  - Remove the `reserved` flag and the `pattern: letter "b" is reserved; read as off` problem.
  - Update the doc comment to "`b` second tone (spec 019)".
- [X] T004 [US1] In `src/primitives/registry.ts`, add a `b` branch to each `paint`:
  - `grid` (line ~249): `if (letter === "b") return { style: secondTone(p), alpha: 1 };`, after the `a` branch.
  - `checker` (line ~370): `if (letter === "b") return secondTone(p);`.
  - Update the grid comment "Designed cells (`#`, `a`) are opaque" to include `b`.
- [X] T005 [P] [US1] In `scripts/verify-gates.ts` `rolesProbe`, probe `[...new Set([...declaredRoles(), ...PRIMITIVE_ROLES])].sort()` (import `PRIMITIVE_ROLES` from the registry).
- [X] T006 [US1] In `scripts/verify-determinism.ts`, add a "Second tone (spec 019)" block after the spec 018 block. Use `TWO_TONE = "##.a.##/#b...b#/..###../#b...b#/##.a.##"`, `accent "#ff2d2d"` and `fg2 "#d8c8a0"`, and reuse the quilt helpers' cell-centre sampling. Check:
  - (a) Creative, solid, with `fg2`: every `b` cell centre is exactly `216,200,160`, `#` cells `255,255,255`, `a` cells `255,45,45`, `.` cells `0,0,0`, at quiet, mid and loud levels.
  - (b) Monochrome: `b` cells are exactly `128,128,128`.
  - (c) Creative without `fg2`: `b` cells are `128,128,128`.
  - (d) Solid with the break `"1,1 r15"`: every pixel is in {bg, fg, accent, fg2}.
  - (e) Quiet and loud hashes are equal for a non-solid two-tone grid.
  - (f) Checker `"b./.b"` at `size: 40` tiles, with `b` squares grey in monochrome.
  - (g) Chunked frames 2–4 equal the whole render.
- [X] T007 [US1] In `scripts/lib/goldenHashes.ts`, add a `TWO_TONE` constant and three `PATTERN_CASES` entries:
  - `"grid:pattern-two-tone"`: creative false, `{ layers: [{ type: "grid", pattern: TWO_TONE }] }`.
  - `"grid:pattern-two-tone-fg2"`: creative true, `{ accent: "#ff2d2d", roles: { fg2: "#d8c8a0" }, layers: [{ type: "grid", pattern: TWO_TONE, solid: true }] }`.
  - `"checker:pattern-two-tone"`: creative true, `{ roles: { fg2: "#d8c8a0" }, layers: [{ type: "checker", pattern: "#b/b.", size: 40 }] }`.
- [X] T008 [US1] Run `npm run golden:update` (x64 via Docker). Then confirm key by key against `main` that 0 values changed and exactly 9 keys were added per set.
- [X] T009 [US1] Add three `golden/CHANGES.md` rows (2026-10-23, spec `019`, set `both`), one for each of the new cases (3 added each). The reasons: the second tone in monochrome is mid grey; with `fg2` in creative mode and solid, each pixel is bg, fg, accent or fg2 (#97); and the checker tiles `b`.

**Checkpoint**: The second tone draws, and the old frames are unchanged.

---

## Phase 4: User Story 2 - Models can use it (Priority: P2)

**Goal**: The descriptions name `b` and `fg2`, and validation accepts `b` with no report.

**Independent Test**: The vocab record and doc show the new `pattern` descriptions, and `validateAnimSpec` on a `b` pattern reports nothing.

- [X] T010 [US2] In `src/primitives/registry.ts`, update the two `pattern` params:
  - `grid` (line ~236):
    - desc: "one letter per cell, rows split by /: . off, # fg, a accent, b second tone (roles.fg2 in creative mode, else mid grey), ~ spectrum; sets the grid size (spaces count toward the length)".
    - example: `"##.a.##/#b...b#/..###../#b...b#/##.a.##"`.
  - `checker` (line ~359):
    - desc: the same letter list, with "tiled from the top-left".
    - example: `"#a/~b"`.

  Then run `npm run vocab:record`. It should report "unchanged at version 13" and refresh `VOCABULARY.md`.
- [X] T011 [P] [US2] In `scripts/verify-spec-validator.ts` (line ~208), replace the check "the reserved letter b is reported" with `check("a pattern with b reports nothing", gridOf({ pattern: "#b#" }).errors.length === 0)`. Add `check("a checker pattern with b reports nothing", gridOf({ pattern: "#b" }, "checker").errors.length === 0)`.
- [X] T012 [P] [US2] In `scripts/verify-registry.ts`, extend the role-name check to `[...declaredRoles(), ...PRIMITIVE_ROLES]`.

---

## Phase 5: Polish

- [X] T013 [P] In `scripts/lib/showcase.ts`, add `two-tone-quilt` (since `0.7.0`): a still, creative, caption "`b` cells take the second tone, `roles.fg2`, next to `#` and the accent; in monochrome they draw mid grey". The spec is `{ accent: "#c8963e", roles: { fg2: "#d8c8a0" }, layers: [{ type: "grid", solid: true, pattern: "##.a.##/#b...b#/..###../#b...b#/##.a.##" }] }`. Then run `npm run showcase:generate` and `npm run site:generate`.
- [X] T014 [P] Docs:
  - `docs/user-guide.md`: in "Designed grids", add `b` to the letter list. In "Palette roles", note that the `fg2` role is read by `b` cells.
  - `CHANGELOG.md` Unreleased: add a second-tone bullet.
  - `specs/ROADMAP.md`: set row 019 to "In progress", with a link to the spec.
- [X] T015 (verify attempt 1 failed in the palette gate's roles mode on anti-aliased `b` edges; the maintainer chose to widen the role rule to bg/fg/role, constitution 4.1.0, research.md R5; attempt 2 below) Run `npm run verify`, at most 3 failed attempts. Then look at `showcase/two-tone-quilt.png`.
- [X] T016 Commit, push, open the PR to `main` ("feat(grid): second tone `b` with roles.fg2 (spec 019)"), and comment on #97.

---

## Dependencies & Execution Order

- T001 → T002 → US1.
- **US1**:
  - T003 → T004.
  - T005 can run in parallel after T002.
  - T006 and T007 come after T004.
  - T008 after T007, then T009.
- **US2**: T010 after T004. T011 and T012 can run in parallel after T003 and T002.
- **Polish**: T013 and T014 can run in parallel after US1 and US2. Then T015, then T016.

## Parallel Examples

- After T002: T005 (`verify-gates.ts`) alongside T003 and T004 (`registry.ts`).
- US2: T011 and T012 together.
- Polish: T013 and T014 together.

## Implementation Strategy

- **MVP**: Phases 1–3. `b` draws the second tone, and the references are recorded.
- **Then**: US2 descriptions and checks, then polish.
- One PR.
