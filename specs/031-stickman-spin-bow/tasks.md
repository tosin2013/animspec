# Tasks: Stickman Spin, Bow and Off-Frame Position

- [X] T001 Add `bow` and `spin` to `POSES`, `STICK_ACTIONS` and `CYCLE`; add optional `scaleX` to `StickPose`, applied in `stickBones` only when set (`src/primitives/stickman.ts`).
- [X] T002 Change the `stickman.x` bounds to -0.5..1.5 with a centre/walk-in description; add the new actions to the `action` description; clamp coords `x` to -0.5..1.5 (`src/primitives/registry.ts`, `src/primitives/stickman.ts`).
- [X] T003 Set `VOCABULARY_VERSION` to 24 and run `vocab:record`.
- [X] T004 Add determinism checks (`scripts/verify-determinism.ts` section 14), reviewed against a contact sheet of bow, spin (both facings) and a walk-in.
- [X] T005 Add reference cases `stickman:bow`, `stickman:spin` and `stickman:walk-in` (`scripts/lib/goldenHashes.ts`).
- [X] T006 Update the user guide's stickman section, the ai-prompts stickman pages where they list actions, a spec 030 note and a ROADMAP row.
- [X] T007 Run `golden:update` (both sets), add the CHANGES rows, regenerate outputs, run `npm run verify`, and open the PR closing #179 and #182.
