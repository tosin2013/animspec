# Tasks: Caption Params

- [x] T001 Edit `caption` in `src/primitives/registry.ts`: add `case`, `box`, `position`, `maxLines` params; honour them in `draw`; switch literal `"black"`/`"white"` to `palette.bg`/`palette.fg`.
- [x] T002 Raise `VOCABULARY_VERSION` 3 → 4.
- [x] T003 Run `npm run vocab:record -- "<summary>"` to record version 4 and regenerate `golden/vocabulary.json` and `VOCABULARY.md`.
- [x] T004 Run `npm run site:generate` to regenerate `docs/vocabulary.md` and `docs/gallery.md`.
- [x] T005 Write the spec-kit artifacts: `spec.md`, `data-model.md`, `research.md`, `quickstart.md`, `plan.md`, `tasks.md`, `checklists/requirements.md`.
- [x] T006 Run `npm run verify` and confirm it passes (registry, gates, determinism, site, package).
