# Tasks: Community Pages Site

**Input**: Design documents from `/specs/006-community-pages/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (site.md, deploy.md, generator.md), quickstart.md

**Tests**: Not requested by the specification. Validation is embedded as checkpoint tasks per story, and the quickstart.md run is the final validation gate.

**Organization**: Tasks are grouped by user story. The stories implement independently; the phases run in priority order (P1 stories first).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 home, US2 gallery, US3 contribute, US4 deploy
- File paths are exact; the contracts under `specs/006-community-pages/contracts/` are the source of truth for every task that touches them.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The VitePress project exists and the npm scripts run.

- [x] T001 Add `vitepress` (and its `vue` peer) as devDependencies in `package.json`, pinned to exact versions, and add the npm aliases `site:dev` (`vitepress dev docs`), `site:build` (`vitepress build docs`), `site:generate` (`tsx scripts/generate-site.ts`), `site:check` (`tsx scripts/generate-site.ts --check`) and `loops:generate` (`tsx scripts/generate-loops.ts`). Do not touch the library's `dependencies`, `files` or any verify alias (FR-004).
- [x] T002 [P] Create `docs/.vitepress/config.mts`: `base: '/animspec/'`, nav (Home, Gallery, Contribute, plus a Documentation section), sidebar grouping the document pages in order (user guide, vocabulary, deployment, design document, contributing), and local search enabled. Add nav entries only for pages that exist at that point: VitePress fails the build on dead links, and `contribute.md` lands in Phase 6.
- [x] T003 [P] Create the theme extension in `docs/.vitepress/theme/` (extend the default theme, one `custom.css` with the monochrome accent from the library's palette, optional `@font-face` layer over the shipped font files copied to `docs/public/fonts/` with their licence texts), and add `docs/.vitepress/dist` and `.vitepress/cache` to `.gitignore`.

**Checkpoint**: `npm run site:dev` serves the three existing documents with nav and search.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Both generators exist and their outputs are committed. The deploy workflow and every story depend on them.

**⚠️ CRITICAL**: `npm run verify` runs `tsc` over `scripts/`, so both generators must type-check clean or the pre-push hook and CI fail.

- [x] T004 Create `scripts/generate-loops.ts`: for every primitive in `src/primitives/registry.ts`, render its validated default layer at a fixed seed over a short synthetic signal cycle (sweep quiet to loud and back), low resolution (320x180), encode with the `GifEncoder` of the existing `@napi-rs/canvas` dependency, and write `loops/<type>.gif`. Deterministic: "No `Date`, no `Math.random`, no file timestamps" (contracts/generator.md); stable registry order; the generator never becomes part of `src/` or of `npm run verify` (data-model.md, AnimationLoop invariants).
- [x] T005 Create `scripts/generate-site.ts`: read `PRIMITIVES`, `gallery/*.png`, `loops/*.gif`, `VOCABULARY.md` and `CONTRIBUTING.md`; emit `docs/gallery.md`, copy thumbnails to `docs/public/gallery/`, loops to `docs/public/loops/`, and the two root documents to `docs/vocabulary.md` and `docs/contributing.md` with fixed front matter added (content otherwise untouched). `--check` mode regenerates in memory, compares byte for byte, exits 1 listing stale, missing or hand-edited files, and reports unexpected files without removing them. Fail loudly naming any primitive whose thumbnail or loop is missing. Deterministic per the generator contract.
- [x] T006 Run `npm run loops:generate && npm run site:generate`, and commit the generated outputs (`loops/*.gif`, `docs/gallery.md`, `docs/public/gallery/`, `docs/public/loops/`, `docs/vocabulary.md`, `docs/contributing.md`). Then run `npm run site:check` and confirm exit 0.

**Checkpoint**: Foundation ready. `npm run site:check` passes on a clean tree.

---

## Phase 3: User Story 1 - A visitor understands the project in one minute (Priority: P1) 🎯 MVP part 1

**Goal**: The home page states the promise, the install and the quick start, and shows the library moving.

**Independent Test**: `npm run site:dev`, open `/`: the promise table, the install command and the quick start are visible, at least one loop plays, and every link resolves (spec.md, Story 1 acceptance scenarios).

- [x] T007 [US1] Write `docs/index.md`: the determinism promise as the README's promise table (linked to the README as the source of truth), at least one sample loop embed from `docs/public/loops/` with a caption stating it was rendered by the committed library from a fixed seed, the `npm install animspec` command copyable, the quick-start example matching `docs/user-guide.md` verbatim in behaviour (the guide is canonical), and links to the user guide, the design document, the gallery, the contribute entry point (add the nav entry when this page exists in Phase 6, see T002 note), the npm package page and the repository root.
- [x] T008 [US1] Add the gallery entry to the nav in `docs/.vitepress/config.mts` (`docs/gallery.md` exists from Phase 2), and validate the home page with `npm run site:build`: zero dead links, zero external asset requests in the built output.

**Checkpoint**: The home page is complete and independently testable.

---

## Phase 4: User Story 4 - The site publishes itself (Priority: P1) 🎯 MVP part 2

**Goal**: A site-affecting push to `main` regenerates, checks, builds and deploys; an unrelated push triggers nothing.

**Independent Test**: quickstart.md, Deployed validation steps 1 and 2 (spec.md, Story 4 acceptance scenarios).

- [x] T009 [US4] Create `.github/workflows/site.yml` exactly per `specs/006-community-pages/contracts/deploy.md`: name `Site`, paths-filtered push to `main` (`docs/**`, `gallery/**`, `loops/**`, `VOCABULARY.md`, `CONTRIBUTING.md`, `scripts/generate-site.ts`, `scripts/generate-loops.ts`, the workflow itself, `package.json`, `package-lock.json`) plus `workflow_dispatch`, never pull requests; permissions `contents: read`, `pages: write`, `id-token: write`; one job: checkout, Node 22, `npm ci`, `npm run loops:generate`, `npm run site:generate`, `npm run site:check`, `npm run site:build`, configure, upload `docs/.vitepress/dist`, deploy; `concurrency` with cancel-in-progress; `timeout-minutes: 5`; never runs `npm run verify`; never pushes anything back.
- [x] T010 [US4] One-time enablement: the maintainer sets Settings, Pages, Build and deployment, Source to GitHub Actions, then a `workflow_dispatch` of the Site workflow confirms a green deploy at `https://tosin2013.github.io/animspec/` (spec.md, Assumptions; the setting is a flip, not code).
- [x] T011 [US4] Update `README.md`: link the site and at least one sample loop (FR-015), in the Documentation table.

**Checkpoint**: The MVP is live: promise, install, quick start, one loop, deployed automatically.

---

## Phase 5: User Story 2 - A visitor sees what the library draws, moving (Priority: P2)

**Goal**: The generated gallery shows one animated card per primitive, matching the registry exactly.

**Independent Test**: quickstart.md, Deployed validation step 5: card count equals the "29 primitives" line in `VOCABULARY.md`, and every card animates (spec.md, Story 2 acceptance scenarios).

- [x] T012 [US2] Implement the gallery card template in `scripts/generate-site.ts`: per primitive, a card with the thumbnail (alt text `"<type>: <description>"`), the animated loop, `type` as the heading, `category` and `tier` labels, `description` verbatim from the registry, a link to the primitive's entry in `src/primitives/registry.ts` on GitHub, and, when `replacedBy` is set, a line naming the replacement. Add the grid styling to `docs/.vitepress/theme/custom.css`. Constraint, verbatim (data-model.md): "Exactly one card per registry primitive, no more and no fewer", registry order.
- [x] T013 [US2] Add the "vocabulary version N" caption and the lead-in sentence linking the vocabulary page for full param tables (contracts/site.md, `/gallery/` obligations), regenerate with `npm run site:generate`, commit, and confirm `npm run site:check` passes.

**Checkpoint**: The gallery is complete and independently testable.

---

## Phase 6: User Story 3 - A would-be contributor finds the path in (Priority: P2)

**Goal**: The contribute page hands a newcomer the rule, the rubric, the gates and the CLA, and the proposal template is at most two clicks from the home page.

**Independent Test**: quickstart.md, Step 6: reach the primitive-proposal issue template from `/` in at most two clicks (spec.md, Story 3 acceptance scenarios).

- [x] T014 [US3] Write `docs/contribute.md`: the new-primitive rule and the four style questions summarised with links to the contributing page (never restated differently, FR-007), the five steps in order (open a proposal issue from the template, implement one registry entry, run `npm run verify`, sign the CLA, open the pull request), the gates described as the one-command quality bar, and links to the primitive-proposal template, the CLA, `good first primitive` and the contributing page.
- [x] T015 [US3] Add the contribute entry to the nav in `docs/.vitepress/config.mts`, and add the contribute link to `docs/index.md`. Validate the two-click depth and a clean `npm run site:build`.

**Checkpoint**: All four stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: The governance the constitution requires, and the final validation run.

- [x] T016 Amend the constitution baseline in `.specify/memory/constitution.md` in the same pull request that ships the site (FR-012): add the community site to in-scope, add GitHub Pages to external dependencies, record VitePress as a development dependency, and bump the version 2.3.0 to 2.4.0 (MINOR, materially expanding scope) with the Last Amended date.
- [x] T017 Run the full local validation in `specs/006-community-pages/quickstart.md` (Steps 1 through 7), including the self-containment check (zero requests to any origin other than the site's own, SC-004) and the verify-untouched check (`git diff main -- .github/workflows/verify.yml` empty, `npm run verify` green, SC-006).
- [ ] T018 Confirm the deployed validation in quickstart.md (steps 1 through 6) once the site is live, and update the spec status and the ROADMAP row for 006 to shipped.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 first (T002's preview and T004/T005's aliases need it).
- **Foundational (Phase 2)**: Depends on T001 (the aliases). T004 and T005 can run in parallel; T006 depends on both.
- **US1 (Phase 3)**: Depends on Phase 2 (the home page embeds a generated loop and links the gallery).
- **US4 (Phase 4)**: Depends on Phase 2 (the workflow runs both generators) and benefits from US1 (an empty site is a poor first deploy; US1 plus US4 is the MVP).
- **US2 (Phase 5)**: Depends on Phase 2; refines the gallery template inside `generate-site.ts`.
- **US3 (Phase 6)**: Depends on Phase 1 (theme, nav); the page itself is independent of the other stories.
- **Polish (Phase 7)**: Last. T016 must land in the same pull request as the site (FR-012), not after it.

### User Story Dependencies

- **US1 (P1)**: No dependencies beyond the foundation.
- **US4 (P1)**: No dependencies beyond the foundation; T010 needs maintainer access to repository settings.
- **US2 (P2)**: Extends the foundation's generator; no dependency on US1 or US3.
- **US3 (P2)**: No dependency on US1 or US2 beyond the shared theme and nav.

### Within Each User Story

- Generators before their committed outputs; content before nav wiring; everything before its checkpoint.

### Parallel Opportunities

- T002 and T003 run in parallel (different files under `docs/.vitepress/`).
- T004 and T005 run in parallel (different scripts).
- T014 (the contribute page) is pure content: it can be written in parallel with Phase 4 and 5 work.
- The two P2 stories (Phases 5 and 6) can be worked in parallel by two people.

---

## Parallel Example: Phase 2

```bash
# Launch both generators together (different files, shared only by imports of the registry):
Task: "Create scripts/generate-loops.ts"
Task: "Create scripts/generate-site.ts"
# Then, when both are green:
Task: "Run both generators and commit the outputs"
```

---

## Implementation Strategy

### MVP First (US1 + US4)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (both generators, committed outputs).
3. Complete Phase 3: US1, the home page.
4. Complete Phase 4: US4, the deploy workflow and the README link.
5. **STOP and VALIDATE**: the site is live with the promise, the install, a quick start and a loop, deployed by push. This alone is a shippable increment.

### Incremental Delivery

1. Setup + Foundational, then US1 + US4: the MVP, live.
2. Add US2: the gallery animates all 29 primitives.
3. Add US3: the contribution path, and the two-click criterion.
4. Polish: the constitution amendment (same pull request as the site), the full quickstart run, the roadmap update.

---

## Notes

- `npm run verify` must stay byte-identical: FR-004 and SC-006 are checked at T017 and by review.
- The two generators are the only new code under `scripts/`; they are type-checked by `npm run check` but nothing from the site ever enters `src/` or the published package.
- Everything generated is committed and staleness-checked (`site:check`), the same discipline as the fonts, the icons and the gallery.
- `loops/*.gif` files are binary; review them by eye in the pull request, the way gallery thumbnails are reviewed.