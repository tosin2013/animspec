---

description: "Task list for stickman, the default avatar"
---

# Tasks: Stickman, the Default Avatar

**Input**: Design documents from `/specs/030-stickman-avatar/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/stickman.md, quickstart.md

**Tests**: There is no separate suite. The checks live in the existing gate scripts (spec FR-012 and SC-001–SC-007), plus reference cases.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- No gate threshold changes.
- At most 3 failed `npm run verify` attempts, then stop and report.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Confirm the starting point: branch `feature/030-stickman-avatar` from `main` (0.10.0, vocabulary 22), `npm run verify` green, and Docker reachable (`docker info`).

## Phase 2: Foundational (blocks every story)

- [X] T002 In `src/primitives/registry.ts`, add a `stickman` skeleton module above the `sprite` entry:
  - a `StickPose` type `{ dx, dy, lean, tilt, rot, A: [n,n], E: [n,n], T: [n,n], K: [n,n] }`;
  - a `STICK_POSES` table for idle, walk, run, jump, punch, kick, hit, fall, ko, wave and dance, using the tempos and functions in research R1 (walk 1.4 Hz, run 2.2 Hz, jump every 1.3 s, punch every 0.9 s, kick every 1.1 s, fall over 1.1 s then held);
  - `stickBones(pose, x, ground, size, face, headScale)`, which returns the bone segments, the head centre and radius, and the hand and foot points, with `rot` turning the body about the feet and then lifting it to rest on the ground. Proportions: torso 1.9, arm 0.95/0.9, leg 1/1, head radius 0.48 × headScale, unit = size/6.
- [X] T003 Add the `stickman` registry entry (tier `core`, category `sprite`) with the 20 params from research R9, with ranges, defaults and descriptions written verbatim from that table. Its description names the actions, styles, `coords`, speech and crowds. `draw` places one figure from `x`/`y`/`scale`/`facing`/`speed`/`travel`, poses it, and renders the classic style with strokes (R2). Raise `VOCABULARY_VERSION` to 23.
- [X] T004 Add `stickman` to the `data-viz`, `minimal` and `arcade` kits in `src/primitives/selector.ts`.

**Checkpoint**: `npm run verify:gates` passes for `stickman` (purity, palette, reactivity, budget, transparency).

## Phase 3: User Story 1 - An avatar that acts (P1) 🎯 MVP

- [X] T005 [US1] Complete the actions, `travel` (frame widths per second, wrapping) and `facing` (auto, right, left) in the `stickman` draw in `src/primitives/registry.ts`.
- [X] T006 [US1] Add determinism checks in `scripts/verify-determinism.ts`:
  - each of the 15 actions differs between t = 0.1, 0.5 and 0.9;
  - all 15 actions are pairwise distinct;
  - `fall` ends lying down;
  - `facing: "left"` mirrors the figure;
  - render twice and chunk checks.
- [X] T007 [US1] Add reference cases to a new `STICKMAN_CASES` map in `scripts/lib/goldenHashes.ts`: `stickman:<action>` for each of the 15 actions.

## Phase 4: User Story 2 - Interacting with the rest of the frame (P1)

- [X] T008 [US2] Add the target actions `point`, `present`, `reach` and `look` (R1, R3). The target angle is clamped to between 0° and 200°, and `facing: "auto"` faces the target.
- [X] T009 [US2] Add the speech bubble (R4): `labels[0]` cut to 40 characters, text at `max(10, round(0.09 × figure height))` px in `x.font`, in a bg-filled rounded box with an outline and a tail, shifted sideways to stay inside the frame. No label means no bubble.
- [X] T010 [US2] Add `from: "coords"` with `index` (R5): `coords[index]` gives `x` and the ground line `y`, clamped to 0..1, with a fallback to the params. Add the drive (R7):
  - `level`: a bob of `(1 + 2·amplitude)` px per 100 px of height;
  - `beat`: the bob plus a hop of `0.18 × height × (amplitude − 0.6)/0.4` when amplitude ≥ 0.6;
  - `none`: no reaction.
- [X] T011 [US2] Add checks:
  - for two targets, the hand lies within 8° of the shoulder-to-target direction;
  - `look` turns the head;
  - the speech bubble changes with the label, and there is no bubble without one;
  - `coords` move the figure, with a fallback when the entry is missing;
  - the drive gives quiet ≠ loud for `level` and `beat`, and quiet = loud for `none`;
  - a bind on `x` moves the figure.
- [X] T012 [US2] Add reference cases: `stickman:point-speech`, `stickman:present`, `stickman:look`, `stickman:coords` and `stickman:beat`.

## Phase 5: User Story 3 - Crowds in one layer (P2)

- [X] T013 [US3] Add crowds (R6):
  - `count` 1–12, `arrangement` row, cluster or split;
  - a seeded phase over one cycle and a size of ±8%, from `mulberry32(mixSeed(x.layerSeed ?? x.seed, 1000 + i))`;
  - clusters drawn back to front;
  - split groups facing each other;
  - `highlight` 0–12 in the accent;
  - one speaker;
  - `coords[index + i]` per figure.
- [X] T014 [US3] Add checks:
  - a crowd of 8 has figure poses that differ at the same moment;
  - the same seed gives the same bytes;
  - `count: 1` equals the single-figure path;
  - `highlight` gives exactly one accent figure;
  - only one bubble;
  - `coords` per figure.
- [X] T015 [US3] Add reference cases `stickman:crowd-row`, `stickman:crowd-cluster` (highlight 3) and `stickman:crowd-split`. Add a composition case to `scripts/verify-gates.ts`: 12 layers × `count: 12`, classic style, at 1080p, within the existing limits.

## Phase 6: User Story 4 - Styles and colours (P2)

- [X] T016 [US4] Add the styles (R2):
  - bold: twice the thickness;
  - outline: a ring head;
  - chibi: `headScale` × 1.6;
  - joints: accent head, hands and feet, and joint dots;
  - pixel: an off-screen whole-pixel raster with square brushes and a pixel disc head, one `drawImage` per layer. Every style uses this path under `x.pixel`.

  Add `colour` (fg, accent, fg2 via `secondTone`) and `thickness`/`headScale`.
- [X] T017 [US4] Add checks:
  - the six styles differ;
  - the pixel style and `pixelMode` have 0 off-palette pixels on a solid background (single figure and crowd);
  - under `gameboy-dmg` with pixels, only DMG greens;
  - `colour: "accent"`/`"fg2"` draw in those roles in creative mode;
  - in monochrome, `accent` is the foreground and `fg2` is mid grey.
- [X] T018 [US4] Add reference cases `stickman:style-<style>` for each of the six styles, and `stickman:pixel-gameboy` (a crowd under `gameboy-dmg` with `pixelMode`).

## Phase 7: User Story 5 - The house mascot (P2)

- [X] T019 [P] [US5] Add a `stickman` gallery demo in `scripts/lib/demos.ts`: `point` at a target with a speech label.
- [X] T020 [P] [US5] Add the showcase loops `stickman-presenter`, `stickman-fight` and `stickman-dance` to `scripts/lib/showcase.ts` (R11).
- [X] T021 [P] [US5] Add a "Stickman, the default avatar" section to `docs/user-guide.md` covering the actions, interaction, crowds and styles, and use it in the Quick Start example where that fits. Add a spec 030 row to `specs/ROADMAP.md`.

## Phase 8: Polish

- [X] T022 Run `npm run vocab:record -- "add stickman: the default avatar, an articulated stick figure with actions, targets, speech, coords-driven moves, crowds and six styles"`, then `golden:update` (both sets; only added keys). Add the `golden/CHANGES.md` rows. Run gallery, loops, showcase and site generation.
- [X] T023 Run `npm run verify` (at most 3 failed attempts), mark the spec Implemented, commit, push and open a PR.

## Dependencies & Execution Order

- **Setup (T001)** comes before **Foundational (T002–T004)**, which blocks every story.
- **US1 (T005–T007)** comes first. **US2 (T008–T012)** builds on US1's draw. **US3 (T013–T015)** and **US4 (T016–T018)** build on US2. **US5 (T019–T021)** needs every renderer.
- Most tasks edit the one registry entry, so they run in order.
- **Polish (T022–T023)** comes last.

## Parallel Opportunities

- T019, T020 and T021 touch separate files.
- Within a story, the checks file and the reference-cases file can be written alongside each other once the draw code exists.

## Implementation Strategy

1. **MVP**: Phases 1–3. The avatar acts, passes every gate and has reference cases.
2. **Increment 2**: Phase 4, interaction (targets, speech, coords, drive).
3. **Increment 3**: Phases 5 and 6, crowds and styles.
4. **Increment 4**: Phase 7, mascot docs and showcase. Then polish and the PR.
