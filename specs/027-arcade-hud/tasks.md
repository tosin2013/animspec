---

description: "Task list for the arcade HUD"
---

# Tasks: Arcade HUD

**Input**: Design documents from `/specs/027-arcade-hud/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/arcade-hud.md, quickstart.md

**Tests**: The checks live in the existing gates (spec FR-009 and FR-012), plus new reference
cases.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- No gate threshold changes.
- At most 3 failed `npm run verify` attempts, then stop and report.

## Phase 1: Setup

- [X] T001 Confirm the starting point: branch `feature/027-arcade-hud` from `main` at the #161 merge (verify green in CI), and Docker reachable.

## Phase 2: Foundational

- [X] T002 Bump `VOCABULARY_VERSION` to 18 in `src/primitives/registry.ts`. Record it after both primitives exist (T005, T009), with `npm run vocab:record -- "add versus-bars and hud-score: a data-bound arcade HUD (coords and labels)"`.

## Phase 3: User Story 1 - Data-bound versus bars (P1) 🎯 MVP

- [X] T003 [US1] Add `versus-bars` to `src/primitives/registry.ts`, after `hbars`, with the data-model params (`y` 0–0.9 default 0.06; `height` 0.01–0.2 default 0.045; `gap` 0–0.5 default 0.12; `angle` 0–45 default 8; `tail` default true; `drive` `level`|`none` default `level`). Category `signal-bars`, tier `contrib`.
- [X] T004 [US1] Implement its draw (research R1–R4):
  - per-row whole-pixel `fillRect`s for the outline, fill and tail;
  - the stair-step angled outer ends;
  - the `coords` reading with clamping and `tail = max(fill, tail)`;
  - the spectrum-half fallback;
  - the tail colour: accent (creative, accent ≠ fg) or `FG2_MONO`, and fg while flashing (`drive` level, energy ≥ 0.7).
- [X] T005 [US1] Add reference cases `versus-bars:full`, `versus-bars:hit`, `versus-bars:nodata` and `versus-bars:creative` to a new `HUD_CASES` map with per-case frame overrides (`coords`, `labels`) in `scripts/lib/goldenHashes.ts`, rendered at quiet, mid and loud.
- [X] T006 [US1] Add determinism checks in `scripts/verify-determinism.ts`:
  - the fill and tail lengths at the two data states, within 1 px;
  - 0 off-palette pixels in monochrome and creative mode;
  - the hit flash changes the frame only with `drive: "level"`;
  - one `coords` entry leaves the right bar full;
  - render twice.

## Phase 4: User Story 2 - Arcade HUD text (P2)

- [X] T007 [US2] Add `hud-score` to `src/primitives/registry.ts`, after `type-reveal`, with params `layout` (`shooter`|`versus`, default `shooter`), `size` (0.02–0.12, default 0.05), `captions` (default true) and `drive` (`level`|`none`, default `level`). Category `text`, tier `contrib`.
- [X] T008 [US2] Implement its draw (R5): the two layouts, the 12- and 3-character cuts, blank missing values, and the inverted emphasis on amplitude ≥ 0.6 with `drive` level. Restore `textAlign` and `textBaseline` afterwards.
- [X] T009 [US2] Add reference cases `hud-score:shooter`, `hud-score:versus` and `hud-score:nolabels` to `HUD_CASES` in `scripts/lib/goldenHashes.ts`.
- [X] T010 [US2] Add determinism checks:
  - labels change the frame;
  - `drive: "none"` ignores the signal;
  - no labels draws only captions, and `captions: false` with no labels is a blank frame;
  - over-long labels render like their cut versions.

## Phase 5: User Story 3 - Documented arcade profiles (P3)

- [X] T011 [US3] Add optional `dims` and `frameData` to `ShowcaseCase` in `scripts/lib/showcase.ts`, use them in `renderShowcase`, and use per-case dims in `scripts/generate-showcase.ts`. Existing cases are unchanged.
- [X] T012 [US3] Add the `cps2-versus` (384×224) and `tate-shooter` (224×288) loops (R7) to `SHOWCASE` in `scripts/lib/showcase.ts`, then run `npm run showcase:generate`.
- [X] T013 [US3] Add both primitives to the user guide's Features, and add a "Style profiles" section to `docs/user-guide.md`: CPS II 384×224 and arcade tate 224×288, with specs. It covers the mirrored fighter via `faceLeft` or `flip: "x"`, `pixelMode`, and the CRT finish belonging to Motion Studio (#90).

## Phase 6: Polish

- [X] T014 Run `npm run vocab:record` (T002), `npm run golden:update` (both sets; only added keys), `golden/CHANGES.md` rows, `npm run gallery:generate`, `npm run loops:generate` and `npm run site:generate`.
- [X] T015 [P] Add a spec 027 row to `specs/ROADMAP.md`, and update the retro style profiles row.
- [X] T016 Run `npm run verify` (at most 3 failed attempts), then mark the spec Implemented. Commit, push, and open a PR closing #106 and #105. In the PR, say that the CRT finish stays with Motion Studio and palette profiles stay with #102.
