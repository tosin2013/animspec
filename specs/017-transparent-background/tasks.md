---

description: "Task list for the transparent background"
---

# Tasks: Transparent Background

**Input**: Design documents from `/specs/017-transparent-background/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/transparent-background.md, quickstart.md

**Tests**: No separate test suite. The checks live in the existing gates (vetting, validator,
determinism, CLI) and in new reference cases, as for specs 014 and 016.

**Organization**: By user story in priority order. US1 (the frame) is the feature; US2 (the
command line) and US3 (the schema) build on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 transparent frames, US2 command line, US3 models
- Paths are relative to the repository root; run commands from there.

**Standing rule**: no existing key in `golden/arm64/hashes.json` or `golden/x64/hashes.json`
may change value. A changed hash is a defect in the task, never a `golden/CHANGES.md` row.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point: branch `feature/017-transparent-background` is based on `main` at or after `3b04191` (spec 016 merged), `.specify/feature.json` points at `specs/017-transparent-background`, `npm run verify` passes, and `git status --short golden/` is empty. The branch also carries the T023 tick in `specs/016-camera-shake-range/tasks.md`; keep it

---

## Phase 2: Foundational

**Purpose**: The format every story uses.

- [X] T002 In `src/specInterpreter.ts` widen `AnimSpec.background` to `"black" | "white" | "transparent"` and add `ink?: "light" | "dark";` with the comment "Spec 017: with a transparent background, light (default) draws as on black with the black removed; dark draws as on white with the white removed. Ignored otherwise." Run `npm run check`
- [X] T003 In `src/specValidator.ts` `validateAnimSpec` (around line 89), keep `background` when it is `"black"`, `"white"` or `"transparent"`, else `"black"` as today. Then validate `obj.ink` per contracts/transparent-background.md: absent → omit; with `background` `"transparent"`, `"light"` or `"dark"` → keep; with `"transparent"` and any other value → push `ink must be light or dark; using light` and set `ink: "light"`; present with a solid background → push `ink dropped (only applies to a transparent background)` and omit. Add `...(ink ? { ink } : {})` to the returned spec (line ~140) after `background`

**Checkpoint**: Transparent specs validate; nothing renders differently yet (the interpreter still draws `"transparent"` on black).

---

## Phase 3: User Story 1 - Artwork with a transparent background (Priority: P1) 🎯 MVP

**Goal**: A transparent spec renders the artwork alone, with alpha; over the matching background it equals the solid render.

**Independent Test**: The transparency gate passes for every primitive and both inks; the determinism checks for empty, covered, repeated and chunked frames pass.

### Implementation for User Story 1

- [X] T004 [US1] In `drawSpec` (`src/specInterpreter.ts`), resolve the source background: `const transparent = spec.background === "transparent"; const dark = transparent && spec.ink === "dark"; const bg = spec.background === "white" || dark ? "white" : "black";` (an unknown `ink` is light). Keep `fg`, `accent`, the fill and the layers as they are, so the solid path issues exactly the same canvas calls as before
- [X] T005 [US1] In `src/specInterpreter.ts` add `function liftBackground(ctx: CanvasRenderingContext2D, dims: Dimensions, dark: boolean): void` implementing research.md R2 exactly: read `ctx.getImageData(0, 0, dims.width, dims.height)`; per pixel `a = dark ? 255 - min(r,g,b) : max(r,g,b)`; `a === 0` → `(0,0,0,0)`; else each channel `Math.round(((c - (dark ? 255 - a : 0)) * 255) / a)` and alpha `a`; write back with `ctx.putImageData(img, 0, 0)`. Call it at the very end of `drawSpec`, after every layer and camera `restore`, only when `transparent`. Comment that it is the un-composite against the source background (spec 017 FR-006, FR-007)
- [X] T006 [US1] In `scripts/lib/referenceSets.ts` change `comparePixels` to include alpha, and, per constitution 3.0.0 Principle I, to compare a pixel that is not fully opaque by its colour weighted by alpha (rounded up) plus its alpha; an opaque pair compares raw colour as before, so existing numbers do not change (research.md R7; amended after the raw comparison failed at T015)
- [X] T007 [US1] In `scripts/verify-gates.ts`, after the grid-solid pre-flight block (around line 396), add a transparency pre-flight: for every `PRIMITIVES` entry, for `ink` of `light` and `dark`, at the three probe levels (`signalFrame(12, level, GOLDEN_LABEL)` for 0.02, 0.5, 0.95 — reuse the gate's existing frame helper), render `{ background: "transparent", ink, layers: [sanitizeLayer({ type })] }` and the matching solid spec (`background` `"black"` for light, `"white"` for dark) through `drawSpec` at `PROBE_DIMS` with seed and options as the other probes; composite the transparent RGBA over the matching background per channel (`c·a/255 + bg·(1 − a/255)`) and require every channel within 1 of the solid render. Print `  ok    transparency: N/N primitives match their solid render over the matching background (light, dark)` or a FAIL line naming each failing primitive and ink, and push failures to `preFlightFails`. Also add one case to the whole-composition budget (around line 432): the first existing 12-layer reference composite with `background: "transparent"`, held to the same 12,000 ops and 200 ms per 1080p frame (analysis U1)
- [X] T008 [US1] In `scripts/verify-determinism.ts` add a section "Transparent background (spec 017)" using the camera section's `pixelsCam`-style helper (seed 7, 320×180, `frameAt`): for each ink, on a `grid` layer and on a `dots` layer at frame 12 — "empty pixels are transparent" (every pixel that equals the source background in the solid render has alpha 0 in the transparent render); "covered fg pixels are opaque" (every pixel exactly equal to the foreground in the solid render is `fg` at alpha 255 in the transparent one); "transparent renders identically twice"; "transparent chunk render equals the whole" (frames 3–5 alone equal the same frames within 0–7); and "a solid spec ignores ink" (a raw, unvalidated `{ background: "black", ink: "dark" }` renders identically to `{ background: "black" }`)
- [X] T009 [US1] Run `npm run verify`; confirm it passes and `git diff --stat golden/` is empty

**Checkpoint**: Transparent frames are correct for every primitive; no reference frame moved.

---

## Phase 4: User Story 2 - Transparent output from the command line (Priority: P2)

**Goal**: `animspec render` writes transparent PNGs and raw RGBA with real alpha.

**Independent Test**: The CLI gate's transparent checks pass.

### Implementation for User Story 2

- [X] T010 [US2] In `scripts/verify-cli.ts`, write a second spec file next to the existing fixture with `{ background: "transparent", ink: "light", layers: [{ type: "grid" }, { type: "wave" }] }` and a matching in-process reference (same pattern as `refRgba`, using that spec). Add: "transparent raw equals the library" (a full `--raw` render equals the concatenated in-process frames, alpha included, and at least one byte at an alpha position is below 255); "transparent chunk equals the full render" (`--start 3 --end 6`); and "transparent png keeps alpha" (render frames 3–4 with `--png`, decode `000003.png` with `loadImage` onto a fresh canvas, confirm some pixel has alpha 0 and that `comparePixels` against the in-process frame reports `maxDelta` 0). Import `comparePixels` from `./lib/referenceSets.js`. No change to `cli/` is expected (research.md R6); if a check fails, fix `cli/render.ts` and record why in research.md
- [X] T011 [US2] Run `npm run verify:cli`; confirm the three checks pass

**Checkpoint**: Pipelines get transparent frames from the command line.

---

## Phase 5: User Story 3 - Models can ask for it (Priority: P3)

**Goal**: The JSON schema describes the transparent background and `ink`.

**Independent Test**: The schema lists both, and the validator cases pass.

### Implementation for User Story 3

- [X] T012 [P] [US3] In `src/primitives/registry.ts` `buildJsonSchema` (around line 2047), change `background` to `{ type: "string", enum: ["black", "white", "transparent"] }` and add `ink: { type: "string", enum: ["light", "dark"] }` beside it
- [X] T013 [P] [US3] In `scripts/verify-spec-validator.ts`, add the five cases of the contract's validation table: `background: "transparent"` kept; `background: "purple"` → `"black"`; `ink: "dark"` with transparent kept; `ink: "sepia"` with transparent → `"light"` with message `ink must be light or dark; using light`; `ink: "dark"` with `background: "white"` dropped with message `ink dropped (only applies to a transparent background)`. Also check that `buildJsonSchema(select("auto"))` (or the existing schema export used in this file) lists `"transparent"` and the `ink` enum
- [X] T014 [US3] Run `npm run verify`; confirm it passes and no existing hash moved

**Checkpoint**: All three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 Add a background case table to `scripts/lib/goldenHashes.ts`, rendered like the camera table (validated layers, `reducedFlicker: true`) at the three reference frames: `background:transparent-light` (`background: "transparent"`, layers `grid`, `wave`, `figure`, `creative: false`); `background:transparent-dark` (same layers, `ink: "dark"`, `creative: false`); `background:transparent-accent` (`background: "transparent"`, `accent: "#ff2d2d"`, layers `rings`, `wave`, `creative: true`). Extend the local `Spec` type with `background?: "black" | "white" | "transparent"` and `ink?: "light" | "dark"`. Run `npm run golden:update` (Docker running); confirm 9 cases added per set, 0 changed, cross-type difference within 8; add one `golden/CHANGES.md` row per case with spec `017`
- [X] T016 [P] Update `docs/user-guide.md`: in the spec field table (around line 168) change `background` to `"black"`, `"white"` or `"transparent"` and add an `ink` row; add a short "Transparent background" section after the camera section with an example, light and dark ink, what happens to seams and greys, and the command-line note (PNG keeps alpha; raw carries it). Run `npm run site:generate`
- [X] T017 Amend `.specify/memory/constitution.md` to 3.1.0 (MINOR): in the baseline's "The format" entry add "a transparent background with light or dark ink"; add a Quality Gates row "A transparent frame over its matching background equals the solid render, for every primitive and both inks | Enforced (`verify-gates.ts`, `verify-determinism.ts`, `verify-cli.ts`)"; note in the existing cross-type rule's row or text that the comparison now includes alpha; append an amendment note in the existing style naming spec 017, no scope change, no new export, no golden render hash moves (nine cases added per set), `VOCABULARY_VERSION` untouched, and the recorded Principle V exception (FR-013); update the version line
- [X] T018 Update `specs/ROADMAP.md`: 017 row to "Implemented on branch `feature/017-transparent-background`" with a link to the spec; add to the `CHANGELOG.md` "Unreleased" section the transparent background with `ink`, the alpha-aware cross-type comparison, and the intended change for unvalidated specs that already said `"transparent"` (FR-013), with constitution 3.1.0
- [X] T019 Run every step of `specs/017-transparent-background/quickstart.md`, including step 7 by eye (render a light and a dark transparent frame of a busy spec and view them over a checkerboard), and record the outcomes in a new `specs/017-transparent-background/validation.md`; set the spec's Status to "Implemented (unreleased; ships in 0.5.0)"
- [X] T020 Commit, push the branch, open a pull request into `main` in milestone 0.5.0 that closes #100, and wait for its Verify check to finish and pass before asking the maintainer to merge

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** → stories.
- **US1 (T004–T009)** needs T003. **US2 (T010–T011)** needs T005. **US3 (T012–T014)** needs only T003.
- **Polish** needs all stories; T015 before T019.

### Tasks that share a file

- `src/specInterpreter.ts`: T002, T004, T005
- `src/specValidator.ts`: T003
- `src/primitives/registry.ts`: T012
- `scripts/verify-spec-validator.ts`: T013
- `scripts/verify-determinism.ts`: T008
- `scripts/lib/referenceSets.ts`: T006 (also read by T010)

### Parallel opportunities

- T012 with T013 (different files), any time after T003.
- T006 with T004–T005.
- T016 with T017.

## Parallel Example: User Story 3

```text
# After T003:
Task: "T012 background and ink in the JSON schema, src/primitives/registry.ts"
Task: "T013 background and ink validation cases, scripts/verify-spec-validator.ts"
```

## Implementation Strategy

### MVP (User Story 1)

T001–T009: transparent frames from the library for every primitive, with no existing frame
moved. It can merge alone.

### Incremental delivery

1. US1 → transparent frames.
2. US2 → proven from the command line.
3. US3 → models can ask for it.
4. Polish → reference cases, documents, constitution 3.1.0, pull request.

### Notes

- Every task ends with `npm run verify` passing.
- `npm run golden:update` runs once, in T015, and must report 0 changed existing cases.
