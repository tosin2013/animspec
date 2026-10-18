# Tasks: type-reveal

- [x] T001 Add the `type-reveal` entry to `src/primitives/registry.ts`: type, `category: "text"`, `tier: "contrib"`, description, params (`text` string maxLen 500 default ""; `mode` enum `word|line` default `word`; `startFrame` 0–1,000,000 default 0; `framesPerUnit` 1–600 default 12; `fontSize` 12–160 default 48; `emphasisStart`/`emphasisEnd` −1–10,000 default −1; `x`/`y` 0–1 default 0.5/0.45; `align` enum `left|center|right` default `center`; `maxWidth` 0–1 default 0.8) and a `draw` that reveals units on the schedule, wraps words to `maxWidth`, colours the emphasis span with `palette.accent`, and draws nothing for empty text.
- [x] T002 Raise `VOCABULARY_VERSION` from 6 to 7 in `src/primitives/registry.ts`.
- [x] T003 Run `npm run check` for fast type/registry feedback.
- [x] T004 Run `npm run vocab:record -- "add type-reveal: sequential word/line text reveal with an accent emphasis span"`.
- [x] T005 Run `npm run gallery:generate` to commit the new thumbnail.
- [x] T006 Run `npm run golden:update`, then add the `golden/CHANGES.md` row: `type-reveal`, its cases, set `both`, reason (new primitive).
- [x] T007 Run `npm run loops:generate` to commit the new loop.
- [x] T008 Run `npm run site:generate` and `npm run site:check` for the fresh site pages.
- [x] T009 Write the spec-kit artifacts: `spec.md`, `research.md`, `plan.md`, `tasks.md`, `checklists/requirements.md`.
- [x] T010 Run `npm run verify` and confirm every gate passes with `VOCABULARY_VERSION` 7 and no other hash moved.
- [x] T011 Update `specs/ROADMAP.md` if the table tracks shipped primitives (otherwise note the vocabulary change in the PR description only), and comment the resolution on issue #23.
