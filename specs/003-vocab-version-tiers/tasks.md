---

description: "Task list for the vocabulary version and primitive tiers"
---

# Tasks: Vocabulary Version and Tiers

**Input**: Design documents from `/specs/003-vocab-version-tiers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vocabulary-version.md, contracts/tiers-and-selection.md, quickstart.md

**Tests**: No separate test suite was requested. The feature's checks live in the existing gate
scripts, and each rule is proven by a fixture that breaks it.

**Organization**: Tasks are grouped by user story in priority order. Version 1 of the vocabulary
is recorded in the last story, so that everything this feature adds to the registry (tiers,
`replacedBy`) is part of version 1 and not a rise to 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 to US4)
- Paths are relative to the repository root. Run every command from the repository root.

## Path Conventions

Single project: library code in `src/`, gate scripts in `scripts/`, shared helpers in
`scripts/lib/`, fixtures in `scripts/fixtures/`, committed reference data in `golden/`.

**Standing rule for every task**: no file under `golden/arm64/` or `golden/x64/` may change.
If `git status --short golden/arm64 golden/x64` shows anything after a task, that task has a
defect; do not run `npm run golden:update`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point and make the spec agree with the plan.

- [X] T001 Confirm prerequisites and stop if any fails: feature `002-cross-machine-frames` is merged to `main` (`golden/arm64/hashes.json`, `golden/x64/hashes.json`, `src/fonts/index.ts` and `scripts/lib/referenceSets.ts` exist on `main`, and `specs/002-cross-machine-frames/tasks.md` has no unchecked task); `.specify/memory/constitution.md` on `main` is at version 2.1.0 or later and contains "VII. Explicit Boundaries"; then create branch `003-vocab-version-tiers` from `main`, set `.specify/feature.json` to `{"feature_directory": "specs/003-vocab-version-tiers"}`, and confirm `npm run verify` passes and `git status --short golden/` is empty
- [X] T002 [P] In `specs/003-vocab-version-tiers/spec.md` bring two requirements into line with the contracts, changing wording only: FR-008 becomes "The vocabulary version MUST rise whenever a primitive is added; a setting or allowed value of a primitive is added, removed or changed, including its bounds or default; or a primitive changes tier or replacement."; and FR-013 gains the sentence "An extended primitive named by the caller MUST be refused unless the chosen kit lists it."

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared shape for rule checks and fixtures, used by User Stories 2, 3 and 4.
User Story 1 does not depend on this phase.

**⚠️ CRITICAL**: User Stories 2 to 4 cannot begin until this phase is complete

- [X] T003 Create `scripts/lib/vocabularyRules.ts` exporting `interface Problem { subject: string; message: string }` (`subject` is the primitive type, the kit name, or a file path that is at fault) and `formatProblem(p: Problem): string` returning `<subject>: <message>`; the file must import nothing from `node:fs` or the network, so every rule added to it later stays a pure function of its arguments
- [X] T004 In `scripts/verify-registry.ts` add two helpers beside the existing `check`: `checkNone(name: string, problems: Problem[])`, which passes when the list is empty and otherwise fails and prints each `formatProblem` line indented; and `checkCaught(name: string, problems: Problem[], subject: string)`, which passes only when at least one problem has exactly that `subject`, and otherwise fails with `rule did not catch its fixture`; run `npm run verify` and confirm it still passes

**Checkpoint**: Rules have a shape and a way to be proven. Nothing behaves differently.

---

## Phase 3: User Story 1 - Every saved spec says which vocabulary it was written against (Priority: P1) 🎯 MVP

**Goal**: Validation writes a vocabulary version into every spec it returns; the version never
changes what is drawn.

**Independent Test**: `npm run verify:validator` passes every row of the validation table in
contracts/vocabulary-version.md, and a spec renders byte-identical frames with and without
`vocabulary`.

### Implementation for User Story 1

- [X] T005 [US1] In `src/primitives/registry.ts` add `export const VOCABULARY_VERSION = 1;` directly above the `PRIMITIVES` array, with a comment stating: it is a whole number, "First value: 1, the vocabulary as it stands when this feature ships", and it "rises by one when a primitive is added; a param or allowed value is added, removed or changed; a primitive changes tier or replacement" (see contracts/vocabulary-version.md)
- [X] T006 [US1] In `src/specInterpreter.ts` add `vocabulary?: number` to the `AnimSpec` interface with a comment that the interpreter does not read it; make no other change to that file ("`vocabulary` has no effect on what is drawn")
- [X] T007 [US1] In `src/specValidator.ts` validate `vocabulary` and always write it on the returned spec, as the first key: absent → `VOCABULARY_VERSION`, no message; `Number.isInteger(v) && v >= 1 && v <= VOCABULARY_VERSION` → kept, no message; an integer above `VOCABULARY_VERSION` → `VOCABULARY_VERSION` and push to `errors` exactly `vocabulary N is newer than this library (M); recorded as M` (N the input, M the current version); anything else, including strings, fractions, `0`, negatives, `null`, booleans and objects → `VOCABULARY_VERSION` and push exactly `vocabulary dropped (not a valid version)`; the spec stays valid in every case, and the early returns for invalid specs are unchanged; rule from data-model.md: "After validation, `vocabulary` is an integer from 1 to the library's current version"
- [X] T008 [US1] In `src/index.ts` export `VOCABULARY_VERSION` from `./primitives/registry`
- [X] T009 [P] [US1] In `scripts/verify-spec-validator.ts` add a section "vocabulary version" with checks for: no `vocabulary` → result has `vocabulary === VOCABULARY_VERSION` and no vocabulary message; `vocabulary: 1` → kept, no message; `vocabulary: VOCABULARY_VERSION + 1` → current version and the exact newer-version message; each of `"1"`, `1.5`, `0`, `-1`, `null`, `true`, `{}` → current version and the exact dropped message; the result of one validation fed into `validateAnimSpec` again keeps the same `vocabulary` and adds no message; every existing valid case in the file now also has an integer `vocabulary`; a spec whose layers are all unknown is still invalid
- [X] T010 [P] [US1] In `scripts/verify-registry.ts` add two checks: `json schema does not list vocabulary` (`!("vocabulary" in buildJsonSchema(PRIMITIVES).properties)`); and `vocabulary does not change what is drawn`, which renders the spec `{ layers: [{ type: "grid" }, { type: "wave" }, { type: "caption" }] }` through `validateAnimSpec` and `drawSpec` at 320×180 three times (as validated, with `vocabulary` deleted, and with `vocabulary: 999`) using the script's existing `frame`, seed 12345, `reducedFlicker: true`, `creative: false`, and compares the SHA-256 of the RGBA data, which must be equal for all three
- [X] T011 [US1] Run `npm run verify`; confirm it passes and that `git status --short golden/` is empty

**Checkpoint**: Every validated spec carries a version. User Story 1 is complete and shippable on its own.

---

## Phase 4: User Story 2 - A model is offered only the primitives its tier allows (Priority: P2)

**Goal**: Every primitive has a tier, and selection offers core by default, a kit's extended
primitives with that kit, contrib only when named, and legacy never.

**Independent Test**: `npm run verify:registry` reports at least 1,000 selections with no kit and
at least 1,000 per kit with 0 tier violations, on the real registry and on a fixture vocabulary
that contains contrib and legacy primitives.

### Implementation for User Story 2

- [X] T012 [US2] In `src/primitives/registry.ts` add `export const TIERS = ["core", "extended", "contrib", "legacy"] as const;` and `export type Tier = (typeof TIERS)[number];`; add to `PrimitiveDef` the required field `tier: Tier` and the optional field `replacedBy?: string` ("the replacement's type; required when `tier` is `legacy`, absent otherwise"); set `tier` on all 29 entries exactly as data-model.md lists them: `"extended"` for `sprite`, `tetris`, `plasma`, `gridhorizon`, `tunnel`, and `"core"` for the other 24; set `replacedBy` on none; then add `tier: "core"` to every other `PrimitiveDef` literal that `tsc` reports (at least `scripts/fixtures/badPrimitives.ts`); run `npm run verify` and confirm it passes with selection output unchanged, since the selector does not read tiers yet
- [X] T013 [US2] In `src/primitives/selector.ts` export the kit lists as `KITS` and restructure selection around one pure function, `selectFrom(vocab: { primitives: PrimitiveDef[]; kits: Record<string, string[]> }, kit, breadth, seed, named: string[] = [])`, returning `{ primitives: PrimitiveDef[]; refused: { type: string; reason: string }[] }`, with these rules from contracts/tiers-and-selection.md: with no kit, `auto`, or an unknown kit name, sample from core only, "one from each category that has a core primitive, then more core primitives up to the target (12 to 20, by breadth)"; with a kit, take "the kit's own list, then up to 6 extra core primitives, by breadth", skipping any kit member whose tier is `contrib` or `legacy` so the guarantees hold even if a kit is wrong; "If there are fewer core primitives than the target, the selection is the core primitives there are. It is never filled from another tier."; then handle each named type in the order given: core → added; contrib → added; extended → kept if the chosen kit lists it, otherwise refused with reason exactly `extended; offered only through its kit`; legacy → refused with reason exactly `legacy; replaced by <type>` using its `replacedBy`; a type not in `vocab.primitives` → refused with reason exactly `not a primitive`; finally add `caption` if it exists and is missing, and remove duplicates keeping first position; keep the random stream as `mulberry32(mixSeed(seed, Math.round(b * 1000)))` and use no other source of variation
- [X] T014 [US2] In `src/primitives/selector.ts` export `selectDetailed(kit?, breadth = 0.3, seed = 0, named: string[] = [])` returning `selectFrom({ primitives: PRIMITIVES, kits: KITS }, ...)`, and keep `select(kit?, breadth = 0.3, seed = 0)` with its current three inputs, returning `selectFrom({ primitives: PRIMITIVES, kits: KITS }, kit, breadth, seed, []).primitives`, so naming is possible only through `selectDetailed` and a caller who names a primitive is always told when it is refused (FR-014); update the file's header comment to describe the tier rules; in `src/index.ts` export `selectDetailed`, `KIT_NAMES`, `TIERS` and the types `Tier` and `KitName`
- [X] T015 [P] [US2] Create `scripts/fixtures/tierFixtures.ts` exporting `SELECTION_VOCAB: { primitives: PrimitiveDef[]; kits: Record<string, string[]> }` built from the real `PRIMITIVES` and `KITS` plus four fixture primitives that draw a filled rectangle in `palette.fg` and have empty `params`: `fixture-contrib` (tier `contrib`), `fixture-old` (tier `legacy`, `replacedBy: "fixture-new"`), `fixture-new` (tier `core`), and `fixture-extended` (tier `extended`, listed only by an added kit named `fixture-kit` whose list is `["grid", "fixture-extended", "caption"]`); and `SMALL_VOCAB`, a vocabulary of five real core primitives (`grid`, `wave`, `bars`, `text`, `caption`) plus `fixture-contrib` and `fixture-extended`, with the single kit `fixture-kit`; fixtures live outside `src/` so the library can never import them
- [X] T016 [US2] In `scripts/verify-registry.ts` replace the existing section "3. Selector is deterministic and honors kits" with tier checks run twice, once on the real registry through `selectDetailed` and once on `SELECTION_VOCAB` through `selectFrom`: a sweep with no kit over seeds 0 to 199 and breadths 0, 0.25, 0.5, 0.75, 1 (1,000 selections) in which every offered primitive is core; a sweep per kit over the same 1,000 combinations in which every offered primitive is core or is extended and listed by that kit; `caption` is in every selection; the same kit, breadth, seed and named list give an identical ordered selection twice; on `SELECTION_VOCAB`, `fixture-contrib` and `fixture-old` are offered in 0 unnamed selections, naming `fixture-contrib` adds it, naming `fixture-old` refuses it with `legacy; replaced by fixture-new`, naming `fixture-extended` with kit `fixture-kit` keeps it and with any other kit or none refuses it with `extended; offered only through its kit`, and naming `nope` refuses it with `not a primitive` while the rest of the selection equals the selection without it; for one selection per kit, `buildVocabPrompt(selection)` has exactly one line per selected primitive and the layer `type` enum of `buildJsonSchema(selection)` equals the selected types; on `SMALL_VOCAB` with no kit at breadth 1 (target 20), the selection is exactly the five core primitives for seeds 0 to 199 and contains neither fixture ("It is never filled from another tier"); print the sweep results as `PASS  1000 selections with no kit: core only` and `PASS  1000 selections per kit (<n> kits): tiers respected`; on failure print the kit, breadth, seed and the offending type of the first violation; keep the existing check that an unkitted selection has between 12 and 22 primitives
- [X] T017 [US2] In `scripts/verify-registry.ts` add the any-tier checks for FR-017: render `fixture-contrib` and `fixture-old` from `scripts/fixtures/tierFixtures.ts` with `renderProbe` from `scripts/lib/gateKit.ts` and confirm neither throws; and a static check that fails, naming the file, if the text of `src/specValidator.ts` or `src/specInterpreter.ts` contains the word `tier` ("the validator and interpreter do not read tiers")
- [X] T018 [US2] Run `npm run verify`; confirm it passes, that `git status --short golden/` is empty, and record in the pull request description that `select` now returns a different selection for the same kit, breadth and seed, with one before-and-after example for `auto` and one for `retro`

**Checkpoint**: Tiers decide what a model is offered. User Stories 1 and 2 both work on their own.

---

## Phase 5: User Story 3 - A primitive can be replaced without changing anyone's saved spec (Priority: P3)

**Goal**: A legacy primitive names its replacement, keeps rendering identically, keeps its
reference frames, and is never offered.

**Independent Test**: A fixture primitive rendered as core and again as legacy gives
byte-identical frames, is offered in 0 selections, and the replacement rules catch each broken
fixture.

### Implementation for User Story 3

- [X] T019 [P] [US3] In `scripts/lib/vocabularyRules.ts` add `replacementProblems(primitives: PrimitiveDef[]): Problem[]` applying the rules from data-model.md: a legacy primitive with no `replacedBy` → `legacy but names no replacement`; a `replacedBy` that names no existing primitive → `replaced by "<type>", which does not exist`; a primitive that is not legacy but has `replacedBy` → `names a replacement but is not legacy`; and "Following `replacedBy` repeatedly ends at a primitive that is not legacy, without visiting any primitive twice" → otherwise `replacement chain does not end at a primitive that is not legacy`; the `subject` of each problem is the primitive's type
- [X] T020 [P] [US3] In `scripts/fixtures/tierFixtures.ts` add `REPLACEMENT_BAD`, a list of `{ name, primitives, subject }` entries, one per rule in T019: a legacy primitive with no `replacedBy`; a legacy primitive whose `replacedBy` is `"missing"`; a core primitive with `replacedBy` set; and two legacy primitives that name each other; and add `OLD_AS_CORE`, the `fixture-old` definition with `tier: "core"` and no `replacedBy`, sharing the same `draw` function object as `fixture-old`
- [X] T021 [US3] In `scripts/verify-registry.ts` add a section "replacement": `checkNone` on `replacementProblems(PRIMITIVES)`; `checkNone` on `replacementProblems(SELECTION_VOCAB.primitives)`; `checkCaught` for every entry of `REPLACEMENT_BAD`; render `OLD_AS_CORE` and `fixture-old` with `renderProbe` at signal levels 0, 0.5 and 1 and require the three pairs of frames to be byte-identical (`PASS  replaced fixture renders identically as core and as legacy`); confirm over the sweeps from T016 that `fixture-old` was offered 0 times and `fixture-new` at least once; and confirm that `getPrimitive`-style lookup on the fixture reports tier `legacy` and `replacedBy` `fixture-new`
- [X] T022 [US3] Confirm FR-022 in `scripts/lib/goldenHashes.ts`: `renderCases` must build a case for every entry of `api.PRIMITIVES` with no filter on tier; add a one-line comment there stating that legacy primitives keep their reference cases, and add a check in `scripts/verify-registry.ts` that the keys of `golden/<type>/hashes.json` for this machine's processor type include `<type>@quiet`, `<type>@mid` and `<type>@loud` for every primitive of every tier; run `npm run verify` and confirm it passes with `git status --short golden/` empty

**Checkpoint**: The replace-beside path is proven before it is first needed.

---

## Phase 6: User Story 4 - The checks keep tiers and the version honest (Priority: P4)

**Goal**: The verify command fails, naming what is at fault, when a tier rule is broken or the
vocabulary changes without the version rising; the version and tiers are documented.

**Independent Test**: Each of the six violations in FR-023 and FR-024 is caught by its fixture, and
breaking a rule by hand in the working tree makes `npm run verify:registry` exit 1 naming the
primitive or kit.

### Implementation for User Story 4

- [X] T023 [P] [US4] In `scripts/lib/vocabularyRules.ts` add `tierProblems(primitives: PrimitiveDef[], kits: Record<string, string[]>): Problem[]`: a primitive whose `tier` is not one of `TIERS` → subject the primitive, `not a valid tier: "<value>"` ("Exactly one tier per primitive"); a kit that lists a type that does not exist → subject the kit, `lists "<type>", which does not exist` ("Every type a kit lists exists"); a kit that lists a contrib or legacy primitive → subject the kit, `lists "<type>", which is <tier>` ("A kit lists only core and extended primitives"); an extended primitive listed by no kit → subject the primitive, `extended but in no kit` ("Every extended primitive is listed by at least one kit"); and `caption` missing or not core → subject `caption`, `must be core`
- [X] T024 [P] [US4] In `scripts/fixtures/tierFixtures.ts` add `TIER_BAD`, a list of `{ name, primitives, kits, subject }` entries, one per rule in T023: a primitive with tier `"gold"`; a kit listing `"missing"`; a kit listing `fixture-contrib`; a kit listing `fixture-old`; `fixture-extended` with `fixture-kit` removed; and `caption` re-tiered as `extended`
- [X] T025 [US4] In `scripts/verify-registry.ts` add a section "tiers": `checkNone` on `tierProblems(PRIMITIVES, KITS)`; `checkNone` on `tierProblems(SELECTION_VOCAB.primitives, SELECTION_VOCAB.kits)`; `checkCaught` for every entry of `TIER_BAD`; and a check that the registry has 24 core and 5 extended primitives and none contrib or legacy, printed as `PASS  29 primitives: 24 core, 5 extended, 0 contrib, 0 legacy` with the real counts (this count check is removed by whoever first changes a tier on purpose)
- [X] T026 [US4] In `scripts/lib/vocabularyRules.ts` add the record functions: `snapshot(primitives)` returning, "for each primitive, in registry order: `type`, `tier`, `replacedBy`, and each param's declaration (type, bounds, default, allowed values)", omitting `replacedBy` when absent and omitting each param's `desc`; `snapshotHash(snap)` returning the SHA-256 hex of `JSON.stringify(snap)`; the type `VocabularyRecord = { versions: { version: number; hash: string; summary: string }[]; current: { version: number; primitives: Snapshot } }`; `recordProblems(record: VocabularyRecord | null, version: number, primitives): Problem[]` with subject `golden/vocabulary.json` (or the differing primitive's type where one is named) and these messages: no record, or last entry below `version` → `no record for version <version>; run npm run vocab:record`; entries not numbered 1 to current without gaps → `versions are not numbered 1 to <n> without gaps`; last entry above `version` → `record is at version <n> but VOCABULARY_VERSION is <version>`; hash of `current.primitives` not equal to the last entry's hash → `current snapshot does not match the hash for version <n>`; two consecutive entries with the same hash → `version <n> records no change from version <n-1>`; derived snapshot hash not equal to the entry for `version` → `vocabulary differs from version <version>; raise VOCABULARY_VERSION and run npm run vocab:record`, followed by one problem per primitive that was added, removed or differs, with subject that primitive's type; and `renderVocabularyDoc(record, primitives): string` returning the full text of `VOCABULARY.md`: a first line saying the file is generated by `npm run vocab:record` and must not be edited, the current version, a history table (version, summary), the count of primitives per tier, and a table with one row per primitive in registry order (type, category, tier, replaced by, description)
- [X] T027 [US4] Create `scripts/vocabulary-record.ts` and add `"vocab:record": "tsx scripts/vocabulary-record.ts"` to `package.json`; the script reads `golden/vocabulary.json` if it exists, takes the summary from the first command-line argument, and: with no record and `VOCABULARY_VERSION === 1` → writes the first entry; with an entry for the current version and an equal hash → adds no entry, rewrites `VOCABULARY.md` only, prints `vocabulary unchanged at version <n>; VOCABULARY.md refreshed`, exits 0; with an entry for the current version and a different hash → exits 1 with `version <n> is already recorded with a different vocabulary; raise VOCABULARY_VERSION` ("An entry, once written, is not rewritten"); with `VOCABULARY_VERSION` one above the last entry and a changed vocabulary → appends the entry and replaces `current`; with the version raised and the vocabulary unchanged → exits 1 with `vocabulary has not changed since version <n>; do not raise the version`; with the version more than one above the last entry → exits 1 naming the gap; with a new entry to write and no summary → exits 1 with `a one-line summary is required: npm run vocab:record -- "<summary>"`; it writes `golden/vocabulary.json` with two-space indentation and a trailing newline, and `VOCABULARY.md` from `renderVocabularyDoc`; it uses no clock and no randomness
- [X] T028 [US4] Run `npm run vocab:record -- "first recorded vocabulary: 29 primitives, 24 core and 5 extended"`; confirm `golden/vocabulary.json` has one entry with `version` 1 and a `current` snapshot of 29 primitives, and that `VOCABULARY.md` lists version 1 and 29 rows; run it a second time and confirm it reports the vocabulary unchanged and leaves `golden/vocabulary.json` byte-identical
- [X] T029 [US4] In `scripts/verify-registry.ts` add a section "vocabulary record": read `golden/vocabulary.json` (a missing file is a `null` record); `checkNone` on `recordProblems(record, VOCABULARY_VERSION, PRIMITIVES)` printed as `PASS  vocabulary matches the record for version <n>`; a freshness check comparing `renderVocabularyDoc(record, PRIMITIVES)` with the committed `VOCABULARY.md`, failing with `VOCABULARY.md is stale; run npm run vocab:record`; and `checkCaught` against in-memory fixtures built from the real record: the real primitives with one param added to `wave` and the version unchanged (caught, with `wave` named); the version raised by one with the record unchanged (`no record for version`); a record whose entries are numbered 1 and 3; and a record whose `current` snapshot was altered without its hash
- [X] T030 [US4] Prove the checks fail for real, following quickstart.md steps 7 and 8, undoing each edit with `git checkout -- src` afterwards: change `grid`'s tier to `"gold"` (tsc fails; with a cast, the registry gate names `grid`); remove `plasma` from the `retro` kit (names `plasma`); add a boolean param to `wave` without raising the version (names `wave`); raise `VOCABULARY_VERSION` without recording (`no record for version 2`); then, on a scratch copy, raise the version, run `npm run vocab:record -- "quickstart test"`, confirm `npm run verify` passes and no file under `golden/arm64` or `golden/x64` changed, and discard the scratch copy; record the four failure messages in the pull request description

**Checkpoint**: All four stories work. Tiers and the version cannot drift without the verify command saying so.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, governance and end-to-end validation.

- [X] T031 [P] Update `README.md`: add `VOCABULARY.md`, `golden/vocabulary.json`, `scripts/vocabulary-record.ts` and `scripts/lib/vocabularyRules.ts` to the "What is here" table; add a short "Vocabulary version and tiers" section that states the current version comes from `VOCABULARY_VERSION`, that validation writes `vocabulary` into every spec, the four tiers with who is offered each (the table from contracts/tiers-and-selection.md), that tiers limit what a model is offered and not what a spec may contain, and the four steps for raising the version; add `npm run vocab:record` to the Verify section; state that `select` returns a different selection than before this feature for the same inputs; and say that anything shown to a model must be built from a selection, not from `buildVocabPrompt()` or `buildJsonSchema()` with no argument
- [X] T032 [P] Update `specs/ROADMAP.md`: mark spec 003 as shipped with the date, and note under 004 that removing the full-registry default from the prompt and schema builders was left to that spec (research.md R10)
- [X] T033 Amend `.specify/memory/constitution.md` (MINOR, 2.1.0 to 2.2.0, or from whatever the current version is): add two rows to the quality-gate table, both `Enforced (verify-registry.ts)`: "Every primitive has a valid tier; kits offer only core and extended primitives; a legacy primitive names its replacement" and "The vocabulary version rises when the vocabulary changes"; update the version line and the Last Amended date; change no principle
- [X] T034 Run every step of `specs/003-vocab-version-tiers/quickstart.md` and record the outcome of each in a new `specs/003-vocab-version-tiers/validation.md`, including the success criteria each step covers (SC-001 to SC-010); trigger the Verify workflow by hand with `gh workflow run verify.yml --ref 003-vocab-version-tiers` and record its duration against the two-minute budget
- [X] T035 Final check before merge: `npm run verify` passes; `git diff main --stat -- golden/arm64 golden/x64` is empty (SC-006); `golden/CHANGES.md` is unchanged, since no reference frame moved; the pull request description carries the note for the private product: its model prompts change because selections change, its saved specs gain `vocabulary` on their next validation, and its reference frames do not move

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 blocks everything.
- **Foundational (Phase 2)**: after Setup. Blocks User Stories 2, 3 and 4. Does not block User Story 1.
- **User Story 1 (Phase 3)**: after Setup. Independent of every other story.
- **User Story 2 (Phase 4)**: after Foundational. Independent of User Story 1.
- **User Story 3 (Phase 5)**: after User Story 2 (needs `tier`, `replacedBy`, `selectFrom` and `SELECTION_VOCAB`).
- **User Story 4 (Phase 6)**: after User Story 3, so that version 1 is recorded with every registry field in place. T023 to T025 (tier rules) need only User Story 2.
- **Polish (Phase 7)**: after all four stories.

### Within Each Story

- **US1**: T005 → T006 → T007 → T008, then T009 and T010 together, then T011.
- **US2**: T012 → T013 → T014; T015 can be written alongside T013; then T016 → T017 → T018.
- **US3**: T019 and T020 together → T021 → T022.
- **US4**: T023 and T024 together → T025; T026 → T027 → T028 → T029 → T030.

### Tasks That Share a File

These cannot run in parallel with each other whatever their story:

- `scripts/verify-registry.ts`: T004, T010, T016, T017, T021, T022, T025, T029
- `scripts/lib/vocabularyRules.ts`: T003, T019, T023, T026
- `scripts/fixtures/tierFixtures.ts`: T015, T020, T024
- `src/primitives/registry.ts`: T005, T012
- `src/primitives/selector.ts`: T013, T014
- `src/index.ts`: T008, T014

### Parallel Opportunities

- T002 alongside T001's checks.
- T009 (`verify-spec-validator.ts`) and T010 (`verify-registry.ts`).
- T015 (`tierFixtures.ts`) alongside T013 (`selector.ts`).
- T019 (`vocabularyRules.ts`) and T020 (`tierFixtures.ts`).
- T023 (`vocabularyRules.ts`) and T024 (`tierFixtures.ts`).
- T031 (`README.md`) and T032 (`ROADMAP.md`).

---

## Parallel Example: User Story 1

```text
# After T008, in parallel:
Task: "T009 version cases in scripts/verify-spec-validator.ts"
Task: "T010 schema and render checks in scripts/verify-registry.ts"
```

## Parallel Example: User Story 3

```text
# In parallel:
Task: "T019 replacementProblems in scripts/lib/vocabularyRules.ts"
Task: "T020 REPLACEMENT_BAD and OLD_AS_CORE in scripts/fixtures/tierFixtures.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 3: User Story 1 (T005 to T011).
3. **Stop and validate**: every validated spec carries `vocabulary`; no reference frame moved.

This is the part that cannot wait for the package to be public, because it changes the saved
format. It can merge on its own.

### Incremental Delivery

1. Setup → User Story 1 → merge. Specs are versioned.
2. Foundational → User Story 2 → merge. Tiers decide what a model is offered. This is the one
   step callers notice, because selections change.
3. User Story 3 → merge. Replacement is proven with fixtures.
4. User Story 4 → merge. Rules and the version are enforced; version 1 is recorded.
5. Polish → the constitution amendment and end-to-end validation.

### Notes

- Every task ends with `npm run verify` passing.
- No task runs `npm run golden:update`. A moved reference frame is a defect in the task.
- Commit after each task or logical group, and never commit `golden/vocabulary.json` without the
  matching `VOCABULARY.md`.
