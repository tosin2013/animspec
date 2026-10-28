---

description: "Task list for palette profiles"
---

# Tasks: Palette Profiles

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- No threshold changes.
- At most 3 failed `npm run verify` attempts, then stop and report.

## Phase 1: Setup

- [X] T001 Branch `feature/028-palette-profiles` from `primitive/133-line-chart` (vocabulary 20). Docker reachable.

## Phase 2: Foundational

- [X] T002 Add `profile?: "gameboy-dmg" | "genesis"` to `AnimSpec` in `src/specInterpreter.ts`, and `profile?: string` to `DrawContext` in `src/primitives/registry.ts`.
- [X] T003 Add `PROFILES`, `snap9` and `shade()` to `src/primitives/registry.ts` (research R2, R3).
- [X] T004 Validator in `src/specValidator.ts`: keep a known `profile`; drop any other value and report `profile dropped (must be gameboy-dmg or genesis)`. Add a schema enum entry.
- [X] T005 Resolve the profile in `drawSpec` (R1), in creative mode only, with spec overrides and transparent-background handling.

## Phase 3: US1 - Game Boy (P1)

- [X] T006 [US1] Route the fixed greys in `grid`, `rain`, `led`, `sprite`, `tetris` and `dither` through `shade()` (R3). The literals are unchanged for black and white.
- [X] T007 [US1] Add determinism checks:
  - the GB scene has exactly 4 colours (both arrangements, three levels);
  - every default layer passes `paletteViolation` under the GB palette;
  - profile without creative mode equals no profile;
  - a spec accent wins;
  - chunk equals whole.
- [X] T008 [US1] Add reference cases `profile:gameboy-light`, `profile:gameboy-dark` and `profile:gameboy-mono`.

## Phase 4: US2 - Genesis and checkerboard dither (P2)

- [X] T009 [US2] Add `BAYER2` and `dither.matrix` value `"2"`. Raise `VOCABULARY_VERSION` to 21 and run `vocab:record`.
- [X] T010 [US2] Add genesis snapping in `image` (R4), cached.
- [X] T011 [US2] Add checks: the genesis image is on the grid, the accent snaps (`#e02020` → `#db2424`), and the matrix 2 band is a checkerboard. Add reference cases `profile:genesis-image` and `dither:matrix2`.

## Phase 5: US3 - Profiles documented (P3)

- [X] T012 [US3] Add the `game-boy-dmg` (160×144) and `genesis` (320×224) showcase loops. Add a `line-chart` gallery demo in `scripts/lib/demos.ts`.
- [X] T013 [US3] User guide: `profile` in the fields table, the profiles under "Style profiles", and `matrix: "2"`.

## Phase 6: Polish

- [X] T014 Constitution 6.3.0 ("The format" names `profile`).
- [X] T015 Run `golden:update`, add the CHANGES rows, regenerate gallery, loops, showcase and site, and add the ROADMAP row.
- [X] T016 Run `npm run verify`, commit, and open a PR closing #102 and #104 (#104's 16-bit bar: two image planes, hero, checkerboard dither, grid colours).
