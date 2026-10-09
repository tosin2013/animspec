---

description: "Task list for the publishable npm package"
---

# Tasks: Publishable npm Package

**Input**: Design documents from `/specs/004-publishable-npm-package/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/package-surface.md, contracts/release.md, quickstart.md

**Tests**: No separate test suite was requested. The feature's check is a new gate script
(`scripts/verify-package.ts`) that proves the built package reproduces the golden hashes.

**Organization**: Tasks are grouped by user story in priority order. The build is foundational
because every story renders through the built package.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 to US4)
- Paths are relative to the repository root. Run every command from the repository root.

## Path Conventions

Single project: library code in `src/`, gate scripts in `scripts/`, workflows in
`.github/workflows/`. The build output is `dist/` (gitignored, never committed).

**Standing rule for every task**: no file under `golden/arm64/` or `golden/x64/` may change.
If `git status --short golden/arm64 golden/x64` shows anything after a task, that task has a
defect.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point.

- [X] T001 Confirm prerequisites and stop if any fails: feature `003-vocab-version-tiers` is merged to `main` (`golden/vocabulary.json`, `VOCABULARY.md` and `src/primitives/registry.ts` carrying `VOCABULARY_VERSION`/`tier` exist on `main`); `.specify/memory/constitution.md` on `main` is at version 2.2.0 or later; then create branch `004-publishable-npm-package` from `main`, confirm `.specify/feature.json` points at `specs/004-publishable-npm-package`, and confirm `npm run verify` passes with `git status --short golden/` empty

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The build. Every user story renders through the built package, so nothing can
proceed until the library compiles to `dist/`.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create `tsconfig.build.json` emitting ES modules plus declarations to `dist/` (`noEmit: false`, `declaration: true`, `outDir: "dist"`, `rootDir: "src"`, `module`/`moduleResolution: "NodeNext"`), and add `dist/` to `.gitignore` (the build output is never committed)
- [X] T003 Add `.js` extensions to every relative import in `src/**/*.ts` (`./registry`, `../rng`, `../types`, `./icons`, `./sprites`, `../fonts/index`, etc.) so the emitted ESM resolves under Node's resolver; `tsc` will name any import that still lacks one
- [X] T004 Rework `package.json`: remove `"private": true`; add `"build": "tsc -p tsconfig.build.json"` and `"verify:package": "tsx scripts/verify-package.ts"`; set `"files": ["dist"]`; set `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }` plus `"main"`, `"module"` and `"types"` pointing at `dist/`; add `"publishConfig": { "access": "public" }`
- [X] T005 Run `npm run build` and confirm `dist/index.js` and `dist/index.d.ts` exist, `tsc` emits no errors, and `node --input-type=module -e 'import("animspec")'` fails gracefully until the package is installed (the build itself is the deliverable)

**Checkpoint**: The library builds to `dist/`. Nothing renders differently; `npm run verify` still passes.

---

## Phase 3: User Story 1 - A consumer installs the package and renders identical frames (Priority: P1) 🎯 MVP

**Goal**: The built package reproduces the committed golden hashes (the M1 gate).

**Independent Test**: `npm run verify:package` builds the package, renders the reference cases
through its exports, and reports that every hash matches the committed golden set.

### Implementation for User Story 1

- [X] T006 [US1] Create `scripts/verify-package.ts`: run `npm run build`, then import the built `dist/index.js` and run `computeHashes` from `scripts/lib/goldenHashes.ts` with the package's exports as the injected `api` (the same render the source tree uses); fail unless every hash equals the committed `golden/<processorType()>/hashes.json` for this machine, and print `PASS  package reproduces the golden hashes`
- [X] T007 [US1] Add `verify:package` to the `npm run verify` chain in `package.json` (after `verify:gates`); run `npm run verify` and confirm it passes and `git status --short golden/` is empty

**Checkpoint**: The M1 gate is enforced on every run — the package renders identically to the source.

---

## Phase 4: User Story 2 - The package is self-contained (Priority: P1)

**Goal**: The published package carries only `dist/`; no asset or source file is read at
runtime, so it works from any folder and on a machine with no fonts.

**Independent Test**: `npm pack` shows only `dist/` + `package.json`, and the packed package
renders from a scratch folder with no `assets/` present.

### Implementation for User Story 2

- [X] T008 [US2] Confirm `npm pack --dry-run` lists only `dist/` and `package.json` (no `assets/`, no `src/`, no `golden/`); fix `files` in `package.json` if anything extra appears
- [X] T009 [US2] Follow quickstart.md step 2 end to end: pack the tarball, install it into a scratch consumer folder with no `assets/`, render a spec with text and an icon, and confirm it succeeds from that folder; record the result for the pull request description

**Checkpoint**: The package is self-contained and rendering does not depend on the working directory.

---

## Phase 5: User Story 3 - The public surface is clean and complete (Priority: P2)

**Goal**: Only the documented surface is exported; the leftover application types are gone and
the model-facing builders require a selection.

**Independent Test**: `npm run check` passes after the removals, and `buildVocabPrompt()` /
`buildJsonSchema()` called with no argument is a type error.

### Implementation for User Story 3

- [X] T010 [US3] In `src/types.ts` remove `SignalSource`, `SignalSourceMeta`, `SignalKind`, `AudioAnalysis` and `RenderOptions`, keeping only `SignalFrame`; in `src/index.ts` remove the exports of `SignalSource`, `SignalSourceMeta` and `SignalKind`
- [X] T011 [US3] In `src/primitives/registry.ts` remove the default argument from `buildVocabPrompt` and `buildJsonSchema` so `subset` is required; in `src/specValidator.ts` change `ANIMSPEC_JSON_SCHEMA = buildJsonSchema()` to `buildJsonSchema(PRIMITIVES)`
- [X] T012 [US3] Run `npm run check` and `npm run verify`; confirm `tsc` passes, no script calls either builder without an argument, and `git status --short golden/` is empty

**Checkpoint**: The public surface matches contracts/package-surface.md exactly.

---

## Phase 6: User Story 4 - Releases are automated and dependencies stay current (Priority: P2)

**Goal**: A tag-triggered release publishes the package, and Dependabot proposes weekly
dependency updates verified by the offline gate.

**Independent Test**: The release workflow validates and, on a tag push, builds and publishes;
`.github/dependabot.yml` is present and scoped to npm.

### Implementation for User Story 4

- [X] T013 [US4] Create `.github/workflows/publish.yml`: trigger on `push: tags: ["v*"]`, runs-on `ubuntu-latest`, steps `actions/checkout`, `actions/setup-node` (node 22, cache npm), `npm ci`, `npm run build`, `npm publish --provenance` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`; it does NOT run `npm run verify` (that runs before the tag via the pre-push hook and CI)
- [X] T014 [US4] Create `.github/dependabot.yml` with a single `npm` ecosystem entry on a weekly `schedule.interval`; note in the pull request description that until the repository is public (005) CI is manual-only, so a Dependabot branch is verified with `gh workflow run verify.yml --ref <branch>` before merge
- [X] T015 [US4] Run `gh workflow list` and confirm `publish.yml` is registered; note in the pull request description that the first real `npm publish` waits for the 005 legal review and secret scan

**Checkpoint**: The release and dependency-update machinery is in place, stopping short of a live public publish.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, governance and end-to-end validation.

- [X] T016 [P] Update `README.md`: add an "Installing" note (`npm install animspec` once public, or a local `npm pack`), the `npm run build` and release instructions, and state that the package name is `animspec`
- [X] T017 [P] Update `specs/ROADMAP.md`: mark spec 004 shipped with the date, and note that the public launch (legal review, secret scan, auto-run CI on PRs) is spec 005
- [X] T018 Amend `.specify/memory/constitution.md` (MINOR bump): in "Scope and Boundaries" add publishing to the package registry to "In scope" and the registry to "External dependencies"; update the version line and Last Amended date; change no principle
- [X] T019 Run every step of `specs/004-publishable-npm-package/quickstart.md` and record the outcome of each in `specs/004-publishable-npm-package/validation.md`, including the success criteria each step covers (SC-001 to SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 blocks everything.
- **Foundational (Phase 2)**: after Setup. Blocks every user story.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after Foundational (independent of US1; both render through `dist/`).
- **US3 (Phase 5)**: after Foundational (independent of US1/US2; it edits `src/` and re-verifies the build).
- **US4 (Phase 6)**: after Foundational (independent of the other stories).
- **Polish (Phase 7)**: after all four stories.

### Within Each Story

- US1: T006 → T007.
- US2: T008 → T009.
- US3: T010 and T011 together → T012.
- US4: T013, T014 in parallel → T015.

### Tasks That Share a File

These cannot run in parallel with each other whatever their story:

- `src/types.ts`: T010
- `src/primitives/registry.ts`: T003 (imports), T011 (default removal)
- `package.json`: T004, T007
- `.gitignore`: T002

### Parallel Opportunities

- T010 (`src/types.ts` + `src/index.ts`) and T011 (`registry.ts` + `specValidator.ts`) touch
  different files.
- T013 (`publish.yml`) and T014 (`dependabot.yml`).
- T016 (`README.md`) and T017 (`ROADMAP.md`).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 2: Foundational (the build).
3. Phase 3: US1 — `verify:package` proves the built package reproduces the golden hashes.
4. **Stop and validate**: the M1 gate is green; the private product can consume the package.

### Incremental Delivery

1. Setup → Foundational → the library builds to `dist/`.
2. US1 → the package renders identically (M1 gate enforced).
3. US2 → the package is provably self-contained.
4. US3 → the public surface is clean and complete.
5. US4 → release and dependency-update machinery.
6. Polish → docs, roadmap, constitution amendment, end-to-end validation.

### Notes

- Every task ends with `npm run verify` passing (or the gate it touches passing).
- No task runs `npm run golden:update`. A moved reference frame is a defect.
- Commit after each task or logical group.
