---

description: "Task list for go-public readiness"
---

# Tasks: Go-Public Readiness

**Input**: Design documents from `/specs/005-go-public-readiness/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/contributing.md, contracts/cla.md, quickstart.md

**Tests**: No separate test suite was requested. The feature's checks are: the secret scan, the
automatic CI triggers, the CLA merge gate, and the gallery freshness check.

**Organization**: Tasks are grouped by user story in priority order. The launch itself (make the
repository public and publish the package) is the final, fail-closed task that waits on the
secret scan, the CI triggers, and the recorded legal review.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 to US4)
- Paths are relative to the repository root. Run every command from the repository root.

## Path Conventions

Documentation lives at the repository root; the gallery generator joins `scripts/`, its output is
committed under `gallery/`; the CI lives in `.github/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point.

- [X] T001 Confirm prerequisites and stop if any fails: feature `004-publishable-npm-package` is merged to `main` (`tsconfig.build.json`, `scripts/verify-package.ts` and `.github/workflows/publish.yml` exist on `main`); `.specify/memory/constitution.md` on `main` is at version 2.3.0 or later and contains the "before going public" rules; then create branch `005-go-public-readiness` from `main`, confirm `.specify/feature.json` points at `specs/005-go-public-readiness`, and confirm `npm run verify` passes

---

## Phase 2: User Story 1 - The repository is safe to make public (Priority: P1) 🎯 MVP

**Goal**: The launch gates are in place: automatic CI, a passing secret scan, and a recorded
legal review.

**Independent Test**: CI runs on a pull request without a manual trigger, the secret scan reports
zero findings, and the legal review is recorded.

### Implementation for User Story 1

- [X] T002 [US1] In `.github/workflows/verify.yml` replace the `workflow_dispatch`-only trigger with `on: { push: { branches: [main] }, pull_request: }`, keeping the single `verify` job on `ubuntu-latest` with the 5-minute timeout (Principle VI: still one workflow, one job, no matrix, no cron); run `gh workflow list` and confirm `verify.yml` still resolves
- [X] T003 [US1] Add a secret scan and confirm it passes: enable the platform's secret scanning for the repository, and add a scan step to CI (a committed scanner action) so every push fails on a committed secret; run it and record `0 secrets` in the pull request description
- [X] T004 [US1] Record the legal review of the licence and CLA as complete in a launch record (a short `docs/` or `specs/005-go-public-readiness/validation.md` note) — this task is blocked (fail-closed) until the maintainer signs off; the launch task T017 cannot pass until it is recorded

**Checkpoint**: The repository can be made public safely.

---

## Phase 3: User Story 2 - Outside contributions are governed (Priority: P1)

**Goal**: A contributor can follow the rules and propose a primitive, and no outside
contribution merges without a signed CLA.

**Independent Test**: `CONTRIBUTING.md` states the rule and rubric; the proposal template and the
`good first primitive` label exist; the CLA gate blocks an unsigned merge.

### Implementation for User Story 2

- [X] T005 [US2] Create `CONTRIBUTING.md` with the new-primitive rule and the four style-review questions, exactly as [contracts/contributing.md](contracts/contributing.md) specifies (the file is the human-facing rendering of the constitution, not a new source of truth)
- [X] T006 [US2] Create `.github/ISSUE_TEMPLATE/primitive-proposal.md` asking for the proposed `type`, `category`, what it draws and why no existing primitive can, and its `params` (bounds/defaults), mirroring the new-primitive rule
- [X] T007 [US2] Create the `good first primitive` label: `gh label create "good first primitive" --description "A self-contained primitive, good for a first contribution" --color 0e8a16`
- [X] T008 [US2] Create `CLA.md` with the licence-agreement text
- [X] T009 [US2] Set up the CLA sign-up and merge gate per [contracts/cla.md](contracts/cla.md): a signature record that is committed only to `main` (never editable by a contributor's own pull request) plus a CI check that fails a pull request whose author is not in the record; document the mechanism in `CONTRIBUTING.md` so the sign-up path is clear

**Checkpoint**: Contributions are governed and the CLA is enforced.

---

## Phase 4: User Story 3 - The community is supported (Priority: P2)

**Goal**: A user can report a vulnerability, and expected conduct is stated.

**Independent Test**: `SECURITY.md` and `CODE_OF_CONDUCT.md` exist and are linked from
`CONTRIBUTING.md`.

### Implementation for User Story 3

- [X] T010 [P] [US3] Create `SECURITY.md` naming a vulnerability-reporting channel and the supported versions (Node 22+ on arm64 and x64)
- [X] T011 [P] [US3] Create `CODE_OF_CONDUCT.md` stating expected behaviour and enforcement

**Checkpoint**: The community basics are present.

---

## Phase 5: User Story 4 - The project is showcased (Priority: P2)

**Goal**: A gallery shows one reference thumbnail per primitive, generated from the reference
frames.

**Independent Test**: `npm run gallery:generate` produces 29 committed thumbnails under `gallery/`.

### Implementation for User Story 4

- [X] T012 [US4] Create `scripts/generate-gallery.ts`: for each `PRIMITIVES` entry, render its validated default layer at a fixed frame (reusing the render path and the PNG encoder in `scripts/lib/referenceSets.ts`) into `gallery/<type>.png`; no file/network access in the render, and the output must not depend on the working directory
- [X] T013 [US4] Add `"gallery:generate": "tsx scripts/generate-gallery.ts"` to `package.json`, and add a freshness check to `scripts/verify-registry.ts` that fails if a committed `gallery/<type>.png` is missing or stale (reuse the generate/commit/check pattern of the icon and font generators)
- [X] T014 [US4] Run `npm run gallery:generate`, confirm 29 files under `gallery/`, and commit them

**Checkpoint**: The gallery shows every primitive.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation links, the roadmap, and the launch itself.

- [X] T015 [P] Update `README.md`: link the gallery and `CONTRIBUTING.md` (and `SECURITY.md`/`CODE_OF_CONDUCT.md`)
- [X] T016 [P] Update `specs/ROADMAP.md`: mark spec 005 shipped with the date, and note that 006 (command-line renderer) remains blocked on the "does it ship in v1" decision
- [ ] T017 Launch (fail-closed): make the repository public and run the first `npm publish` under `animspec`; this task MUST NOT be marked done unless T002 (CI triggers), T003 (secret scan) and T004 (legal review) are all complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 blocks everything.
- **US1 (Phase 2)**: after Setup.
- **US2 (Phase 3)**: after Setup (independent of US1).
- **US3 (Phase 4)**: after Setup (independent of US1/US2).
- **US4 (Phase 5)**: after Setup (independent of the others).
- **Polish (Phase 6)**: after US1–US4. T017 depends on T002, T003 and T004.

### Within Each Story

- US1: T002 → T003 → T004 (T004 is maintainer-blocked).
- US2: T005 → T006, T007, T008 → T009.
- US3: T010 and T011 in parallel.
- US4: T012 → T013 → T014.

### Parallel Opportunities

- T010 (`SECURITY.md`) and T011 (`CODE_OF_CONDUCT.md`).
- T015 (`README.md`) and T016 (`ROADMAP.md`).
- T006, T007, T008 (different files / a repo label) after T005.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 2: US1 — CI triggers, secret scan, and the recorded legal review.
3. **Stop and validate**: the launch gates are met; the repository can go public safely.

### Incremental Delivery

1. Setup → US1 → the repository is safe to make public.
2. US2 → contributions are governed and the CLA is enforced.
3. US3 → the community basics are present.
4. US4 → the gallery shows every primitive.
5. Polish → links, roadmap, and the launch (T017, fail-closed on US1).

### Notes

- Most of this feature is documentation and configuration; the only real code is the gallery
  generator (T012) and the CI/CLA checks (T002, T003, T009).
- No task runs `npm run golden:update`; no reference frame moves.
- T004 (legal review) and T017 (launch) are human-gated and cannot be completed by an agent.
