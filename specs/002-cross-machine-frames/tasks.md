---

description: "Task list for making reference frames match on every machine"
---

# Tasks: Reference Frames Match on Every Machine

**Input**: Design documents from `/specs/002-cross-machine-frames/`

**Prerequisites**: plan.md, spec.md, investigation.md, research.md, data-model.md, contracts/reference-frames.md, contracts/fonts.md, quickstart.md

**Tests**: No separate test suite was requested. The feature is itself a set of checks, and each
story ends with a task that proves its check can fail.

**Organization**: Tasks are grouped by user story in priority order. The plan's order of work
(split the reference set and record x64 before touching text) is kept by putting the split in the
Foundational phase, so every later story can re-record both sets and each change stays
attributable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 to US5)
- Paths are relative to the repository root. Run every command from the repository root.

## Path Conventions

Single project: library code in `src/`, gate scripts in `scripts/`, shared helpers in
`scripts/lib/`, reference sets in `golden/<type>/`, font files in `assets/fonts/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point and bring in the font files.

- [X] T001 Confirm prerequisites and stop if any fails: feature `001-primitive-vetting-gates` is merged to `main` (`golden/CHANGES.md`, `scripts/verify-gates.ts` and `scripts/lib/gateKit.ts` exist); `.specify/memory/constitution.md` is at version 2.0.0 or later with Principle I stating the per-processor-type promise (if not, stop and run `/speckit-constitution`); `docker info` succeeds; then switch to branch `002-cross-machine-frames` (already created from `main` at the commit that merged feature 001; create it from `main` if it does not exist) and confirm `npm run verify` passes
- [X] T002 [P] Create `assets/fonts/` containing the three font files from their official releases, verifying each checksum with `shasum -a 256`: `DejaVuSansMono.ttf` (version 2.37, 340,712 bytes, SHA-256 `b4a6c3e4faab8773f4ff761d56451646409f29abedd68f05d38c2df667d3c582`, from `ttf/` inside `dejavu-fonts-ttf-2.37.zip` at https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip); `JetBrainsMono-Regular.ttf` (version 2.304, 273,900 bytes, SHA-256 `a0bf60ef0f83c5ed4d7a75d45838548b1f6873372dfac88f71804491898d138f`, from `fonts/ttf/` inside `JetBrainsMono-2.304.zip` at https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip); `IBMPlexMono-Regular.ttf` (version 2.005, 173,052 bytes, SHA-256 `7c6fbddca4b700be918f5f6183d9bd4464fa427fe435f0b480d77fe2bb8c5a43`, from `packages/plex-mono/fonts/complete/ttf/` of the IBM/plex repository); these release files were verified on 2026-10-01 to render all 96 reference cases byte-identically on macOS arm64 and Linux arm64, within 5 of 255 on Linux x64, and byte-identically to the builds measured earlier in planning (see research.md R3); add each font's licence text as `LICENSE-DejaVu.txt` (the `LICENSE` file in the DejaVu zip), `LICENSE-JetBrainsMono.txt` (`OFL.txt` in the JetBrains zip, SIL OFL 1.1) and `LICENSE-IBMPlexMono.txt` (SIL OFL 1.1); add `assets/fonts/README.md` recording each file's source URL, version, size and SHA-256
- [X] T003 [P] Add a `set` column to the table in `golden/CHANGES.md` (values `arm64`, `x64` or `both`) and mark the existing rows `arm64`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: One reference set per processor type, stored frames, and a way to render the other
type. No rendering changes in this phase: the arm64 hashes must not move.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `scripts/lib/referenceSets.ts` with: `processorType()` returning `process.arch` when it is `arm64` or `x64` and the platform is not Windows, and `null` otherwise (Windows is unsupported whatever its processor); `setDir(type)` returning `golden/<type>`; `caseFileName(key)` applying the rule from data-model.md, "File names are the case key with characters outside `a-z 0-9 @ + -` replaced by `_`"; `encodeFrame(rgba, width, height)` returning PNG bytes and `decodeFrame(png)` returning RGBA, both using `@napi-rs/canvas`; `comparePixels(a, b)` returning `{ maxDelta, pixels }` where `maxDelta` is the "largest absolute difference in any colour channel of any pixel"; and `readSet(type)` and `writeSet(dir, cases)` for `hashes.json` plus `frames/<case>.png`, where `writeSet` applies "A frame file is rewritten only when its decoded pixels change"
- [X] T005 In `scripts/lib/goldenHashes.ts` add `renderCases(api)` returning each case key with its raw RGBA, and make `computeHashes` derive its hashes from `renderCases`, so hashes and stored frames always come from the same render; existing keys and hashes must be unchanged
- [X] T006 Move the existing set with `git mv golden/hashes.json golden/arm64/hashes.json`, then change `scripts/verify-determinism.ts` to read `golden/<processorType()>/hashes.json`, print `ok    reference set: <type>`, fail with `no reference set for processor type "<arch>" — exact comparison not made` (on Windows: `no reference set for Windows — exact comparison not made`) when `processorType()` is `null`, name the set in the hash check (`hashes match golden/<type>`), and list EVERY mismatching case with a count instead of the first eight; make the existing `--update` mode write to `golden/<type>/hashes.json` for now (T007 replaces it); run `npm run verify` and confirm it passes with no hash change
- [X] T007 Create `scripts/golden-update.ts` with two modes. `--render-set --out <dir>` renders every case for the current processor type and writes `hashes.json` and `frames/` to `<dir>` with `writeSet`. The default mode renders the native set that way into a temporary directory, renders the other type with `docker run --rm --platform linux/<other> -v <repo>:/in:ro -v animspec-node-modules-<other>:/work/node_modules -v <tmp>:/out node:22` (inside: copy `/in` to `/work` without `node_modules`, `npm ci`, then `npx tsx scripts/golden-update.ts --render-set --out /out`), and then copies both results into `golden/arm64` and `golden/x64`; point the `golden:update` script in `package.json` at `tsx scripts/golden-update.ts` and remove the `--update` mode from `scripts/verify-determinism.ts`
- [X] T008 Run `npm run golden:update`; confirm with `git diff golden/arm64/hashes.json` that the arm64 hashes are byte-for-byte unchanged, that `golden/arm64/frames/`, `golden/x64/hashes.json` and `golden/x64/frames/` now exist with the same case keys, and that `npm run verify` passes; add a row to `golden/CHANGES.md`: primitive `all`, cases `x64 set recorded for the first time; frames stored for both sets`, set `both`, reason `one reference set per processor type; no rendering change`, spec `002`
- [X] T009 Run the determinism gate in a container for the other processor type (quickstart.md step 2: `docker run --rm --platform linux/amd64 -v "$PWD":/in:ro node:22 bash -c 'cp -r /in /work && cd /work && rm -rf node_modules && npm ci --silent && npm run verify:determinism'`) and confirm it reports `reference set: x64` and passes there; run only this gate in containers, because the speed gate from feature 001 has a time limit that emulation can exceed for reasons unrelated to this feature; note in the pull request description that on the real build machine the text cases are still expected to mismatch at this point, because machine fonts are still in use until User Story 1

**Checkpoint**: Two reference sets exist and verify picks the right one. Nothing renders differently.

---

## Phase 3: User Story 1 - Text looks the same on every machine (Priority: P1) 🎯 MVP

**Goal**: All text is drawn with fonts shipped in the library, a spec can choose among them, and
text frames are byte-identical on machines of the same processor type whatever fonts they have.

**Independent Test**: `npm run verify` passes on the Mac and in `linux/arm64` containers with and
without extra fonts installed; a spec naming each shipped font renders in that font; an unknown
font name falls back to the default with a message.

### Implementation for User Story 1

- [X] T010 [US1] Create `scripts/generate-fonts.ts`: for each `.ttf` in `assets/fonts/` (folder resolved from `import.meta.url`), write `src/fonts/dejavuSansMono.ts`, `src/fonts/jetbrainsMono.ts` and `src/fonts/ibmPlexMono.ts`, each exporting `DATA: string` (the file's bytes as base64) under a header stating the file is generated and is regenerated with `npm run fonts:generate`; export `checkFontData(): boolean` that regenerates in memory, compares with the committed modules, and prints `FAIL  font data is stale — run: npm run fonts:generate` on a difference; add `"fonts:generate": "tsx scripts/generate-fonts.ts"` to `package.json` and run it
- [X] T011 [US1] Create `src/fonts/index.ts` exporting `FONTS` with the three entries from contracts/fonts.md (`dejavu` DejaVu Sans Mono, licence `Bitstream Vera`; `jetbrains` JetBrains Mono, licence `OFL-1.1`; `plex` IBM Plex Mono, licence `OFL-1.1`), each with `key`, `family` ("the family name the font is registered under, unique to this library": use the neutral prefix `specfont-<key>`, which does not depend on the project's still-undecided public name), `label` and `licence`; `DEFAULT_FONT = "dejavu"` ("Exactly one font is the default: `dejavu`"); a `FontKey` type; `resolveFontFamily(key?: unknown): string` returning the family for a known key and the default family otherwise; and registration of all three with `GlobalFonts.register(Buffer.from(DATA, "base64"), family)` when the module loads ("Every font is registered once, when the library loads, from memory"); the module must not import any file or network module
- [X] T012 [US1] Add `font: string` to `DrawContext` in `src/primitives/registry.ts` and `font?: string` to `AnimSpec` in `src/specInterpreter.ts`; in `drawSpec` set the context's `font` to `resolveFontFamily(spec.font)`; update every other place that builds a draw context to pass the default family: `scripts/lib/gateKit.ts` (both `renderProbe` and `measureBudget`), and `scripts/verify-registry.ts`; `tsc` will name any place that was missed
- [X] T013 [US1] In `src/primitives/registry.ts` change the five text primitives to build their font string from the size and the context's font and never name a family: `caption`, `rain`, `text`, `crosshair` (add the `x` parameter to its `draw` signature) and `led` (the off-screen canvas font); no occurrence of `monospace` may remain in `src/`
- [X] T014 [US1] Extend the static scan in `scripts/verify-determinism.ts` to fail when any `.font =` assignment under `src/` does not build its value from the draw context's font (the rule is that every such assignment must reference the context's `font`, not that certain family names are banned), naming the offending files; and call `checkFontData()` from `scripts/generate-fonts.ts`, printing `ok    font data is up to date` or failing the gate when stale
- [X] T015 [US1] Run `npm run golden:update` and confirm with `git diff golden/arm64/hashes.json` and `git diff golden/x64/hashes.json` that in EACH set exactly these 24 existing keys changed and no others: `caption@*`, `rain@*`, `text@*`, `crosshair@*`, `led@*`, `composite:grid+wave+caption@*`, `composite:creative-accent@*` and `icon:led-unknown@*` (three levels each); any other changed key is a defect; add a row to `golden/CHANGES.md`: primitive `caption, rain, text, crosshair, led`, those cases, set `both`, reason `text now drawn with the shipped default font, not a machine font`, spec `002`
- [X] T016 [US1] Add the reference case `text:missing-glyphs` to `scripts/lib/goldenHashes.ts`: the `caption` primitive's validated default layer rendered with the label `Ω é ñ 日本語 😀 → ▓` at the three levels; run `npm run golden:update`, confirm 3 keys were added to each set and none changed, and add a row to `golden/CHANGES.md` (cases `text:missing-glyphs (3 added)`, set `both`, reason `guards that characters a font lacks never fall back to a machine font`)
- [X] T017 [US1] Validate the font choice in `src/specValidator.ts` per data-model.md: "a known key is kept. Anything else is removed, the default applies, and the validation result's errors include `font dropped (not a shipped font)`. The spec stays valid"; a spec with no `font` produces a spec with no `font` field; in `buildJsonSchema` in `src/primitives/registry.ts` add an optional `font` string property whose `enum` is generated from the keys of `FONTS`; export `FONTS`, `DEFAULT_FONT` and the `FontKey` type from `src/index.ts`
- [X] T018 [US1] Add checks to `scripts/verify-spec-validator.ts`: each of `dejavu`, `jetbrains` and `plex` is kept; `comic-sans` is dropped with the message `font dropped (not a shipped font)` and the spec stays valid; a non-string `font` is dropped the same way; a spec with no `font` has none after validation; and in `scripts/verify-registry.ts` check that the JSON schema's `font` enum equals the keys of `FONTS`
- [X] T019 [US1] Review text layout in every shipped font before recording it (FR-026): write a throwaway script outside the repository that renders `caption`, `text`, `rain`, `crosshair` and `led` (once with `scroll: false, effect: "static"` and once with the default layer) at 480×270 in each of `dejavu`, `jetbrains` and `plex` into one image per font; confirm by eye that no glyph is cut off, that LED text fits within its rows, and that captions wrap inside the frame; attach the three images to the pull request description; if any font fails, stop and report it instead of recording its reference cases
- [X] T020 [US1] Add per-font reference cases to `scripts/lib/goldenHashes.ts` with keys `font:<key>:<primitive>` for `<key>` in `jetbrains`, `plex` and `<primitive>` in `caption`, `text`, `rain`, `crosshair`, `led`, each rendering that primitive's validated default layer in a spec with `font` set, at the three levels (30 keys); run `npm run golden:update`, confirm 30 keys were added to each set and none changed, and add a row to `golden/CHANGES.md` (cases `font:* (30 added)`, set `both`, reason `reference cases for each non-default shipped font`)
- [X] T021 [US1] Prove text does not depend on installed fonts (SC-002): run quickstart.md step 3 in a `linux/<native type>` container with the stock `node:22` image (three font families) and again after installing `fonts-noto-cjk` and `fonts-noto-color-emoji`; `npm run verify:determinism` must pass in both, including the `text:missing-glyphs` and `font:*` cases
- [X] T022 [P] [US1] Update `NOTICE`: list DejaVu Sans Mono (Bitstream Vera licence), JetBrains Mono (SIL OFL 1.1) and IBM Plex Mono (SIL OFL 1.1) as fonts shipped inside the library, pointing to the licence texts under `assets/fonts/`
- [X] T023 [US1] Once the maintainer asks for the branch to be pushed, run the manual workflow once (`gh workflow run verify.yml --ref 002-cross-machine-frames`) and confirm it PASSES; this is the first comparison of text on the real x64 build machine with the emulated container that recorded the x64 set; if any text case mismatches there, STOP implementation and report it, because the assumption "all machines of one processor type agree" has failed for text and the spec must be revisited; later phases may be worked on locally before this run happens, but the feature is not complete, and T041 cannot pass, until this task has passed

**Checkpoint**: Text is the same on every machine of a processor type, and the automated build is green for the first time.

---

## Phase 4: User Story 2 - The check passes on every supported machine (Priority: P2)

**Goal**: The reference comparison is complete and honest on every machine: consistent sets,
real default behaviour recorded for every primitive, and clear reporting.

**Independent Test**: `npm run verify` passes natively and in containers of both processor types;
a deliberate rendering change fails on both and names the set and every affected case.

### Implementation for User Story 2

- [X] T024 [US2] Add the set-consistency check to `scripts/verify-determinism.ts` using `scripts/lib/referenceSets.ts`: fail if the two sets' case keys differ ("Both sets contain exactly the same case keys") or if any stored frame, decoded, does not hash to its stored hash ("For every case, the stored frame decodes to pixels whose hash equals the stored hash"), naming the cases
- [X] T025 [US2] Make each primitive's reference case render its validated default layer: add `sanitizeLayer` to the `GoldenApi` interface in `scripts/lib/goldenHashes.ts`, render `sanitizeLayer({ type })` for the `<primitive>@<level>` cases, and pass `sanitizeLayer` where the API object is built in `scripts/verify-determinism.ts` and `scripts/golden-update.ts`
- [X] T026 [US2] Run `npm run golden:update` and confirm with `git diff golden/arm64/hashes.json` and `git diff golden/x64/hashes.json` that in each set only `led@quiet`, `led@mid`, `led@loud` and `sprite@loud` changed (four keys: `sprite` differs only at loud, where its `jump` default matters above the amplitude threshold); any other changed key is a defect; add a row to `golden/CHANGES.md`: primitive `led, sprite`, those cases, set `both`, reason `reference cases now use validated default layers; no rendering change`, spec `002`
- [X] T027 [US2] Run quickstart.md step 2 for both `linux/amd64` and `linux/arm64` and confirm `npm run verify:determinism` passes in each and reports the matching reference set
- [X] T028 [US2] Confirm failure reporting (spec.md User Story 2, scenarios 3 and 5): temporarily change the default `amp` used by `wave` in `src/primitives/registry.ts`, run `npm run verify:determinism` natively and in a `linux/amd64` container, and confirm both fail, name `golden/arm64` and `golden/x64` respectively, and list all three `wave@*` cases plus any composite containing `wave`; revert the change; then temporarily make `processorType()` in `scripts/lib/referenceSets.ts` return `null`, confirm the gate fails with the `no reference set` message and does not print a passing hash check (spec.md User Story 2, scenario 4), and revert

**Checkpoint**: Both sets are consistent and cover real default behaviour; failures are fully reported.

---

## Phase 5: User Story 3 - Frames from different processor types are provably close (Priority: P3)

**Goal**: Every run checks that no case differs across processor types by more than the stated
tolerance, including specs with the maximum number of layers.

**Independent Test**: `npm run verify` prints the largest cross-type difference and passes; with
the limit temporarily lowered, it fails and names a case and its measured difference.

### Implementation for User Story 3

- [X] T029 [US3] Add the cross-type check to `scripts/verify-determinism.ts`: render every case locally, compare with the stored frame from `golden/<other type>/frames/` using `comparePixels`, and fail "when `maxDelta` is greater than 8" (keep the limit in one named constant, `CROSS_TYPE_TOLERANCE = 8`); print `ok    within tolerance of <other> (largest difference N of 255, allowed 8)` on success and `FAIL  within tolerance of <other> — <case> differs by N of 255 (allowed 8)` for each failing case; on an unsupported processor type also print `info  largest difference from arm64: N of 255; from x64: N of 255`
- [X] T030 [US3] Add two maximum-layer composites to `scripts/lib/goldenHashes.ts`, each with twelve validated default layers: `composite:layers12-dark` (creative, background `black`, accent `#ff2d2d`, layers `gridhorizon`, `tunnel`, `mesh3d`, `hbars`, `radial`, `spiral`, `tetris`, `particles`, `bars`, `orbits`, `dots`, `rain`) and `composite:layers12-light` (creative, background `white`, accent `#2d6bff`, layers `hbars`, `radial`, `tunnel`, `mesh3d`, `gridhorizon`, `spiral`, `grid`, `wave`, `rings`, `shape`, `lissajous`, `crosshair`); run `npm run golden:update`, confirm 6 keys were added to each set and none changed, and add a row to `golden/CHANGES.md` (cases `composite:layers12-* (6 added)`, set `both`, reason `cross-type tolerance checked at the maximum layer count`)
- [X] T031 [US3] Confirm the check holds and is enforced: `npm run verify` reports a largest difference of at most 8 on the Mac and in a `linux/amd64` container; then temporarily set `CROSS_TYPE_TOLERANCE` to 2 in `scripts/verify-determinism.ts`, confirm the gate fails naming at least one case with its measured difference, and restore it to 8

**Checkpoint**: The cross-type promise is checked on every run.

---

## Phase 6: User Story 4 - The maintainer refreshes every reference set from one machine (Priority: P4)

**Goal**: One command updates both sets safely: together or not at all, with a report of what
changed.

**Independent Test**: On unchanged code `npm run golden:update` reports 0 changed and leaves `git
status` clean; with Docker unavailable it stops with an explanation and changes nothing.

### Implementation for User Story 4

- [X] T032 [US4] Make the refresh in `scripts/golden-update.ts` all-or-nothing: render both sets into a temporary directory, run the set-consistency rules and the cross-type tolerance check on the temporary sets, and only if all pass replace `golden/arm64` and `golden/x64` ("Sets are replaced together or not at all"); on any failure leave `golden/` untouched and exit non-zero
- [X] T033 [US4] Add the report from contracts/reference-frames.md to `scripts/golden-update.ts`: one line per set with the case count and the names of cases whose hash changed, were added or were removed, the largest cross-type difference, `replaced golden/arm64 and golden/x64`, and `next: add an entry to golden/CHANGES.md`; when nothing changed, say so and write nothing
- [X] T034 [US4] Handle the failure paths in `scripts/golden-update.ts`: if `docker info` fails, if the container exits non-zero, or if the container produced no set, print which step failed and that no reference set was changed, and exit non-zero without touching `golden/`
- [X] T035 [US4] Confirm the refresh behaviour (quickstart.md step 6): on unchanged code `time npm run golden:update` reports 0 changed in both sets, finishes in under five minutes on a second run (the `node_modules` volume is cached), and `git status --short golden/` is empty; then run it with Docker unreachable (`DOCKER_HOST=unix:///nonexistent npm run golden:update`) and confirm it stops with the explanation and `git status --short golden/` is still empty

**Checkpoint**: Reference sets can only change together, deliberately, with a record of what moved.

---

## Phase 7: User Story 5 - The promise is stated accurately (Priority: P5)

**Goal**: The documentation says exactly what is guaranteed.

**Independent Test**: README and constitution both state the per-type guarantee, the tolerance of
8 and the two supported processor types; `NOTICE` lists the fonts.

### Implementation for User Story 5

- [ ] T036 [P] [US5] Update `README.md`: replace the "byte-identical pixels" claim with the promise table from contracts/reference-frames.md (same processor type: byte-identical; arm64 against x64: within 8 of 255 per channel; anything else: unsupported), list the two supported processor types and the unverified cases (Intel Macs, musl-based Linux); add a Fonts section with the three keys and the `font` field; replace the `golden:update` instructions with the new command, its need for Docker and the `golden/CHANGES.md` step; update the "What is here" table for `golden/<type>/`, `assets/fonts/` and `src/fonts/`
- [ ] T037 [P] [US5] Amend `.specify/memory/constitution.md` (at 2.0.0 or later) with a PATCH bump: change the three rows added as Planned by the 2.0.0 amendment to Enforced and add a row "Font data is up to date", all four Enforced by `verify-determinism.ts`; remove the transitional paragraph at the end of Principle I that describes the gaps this feature closes; in "Scope and Boundaries" add the three shipped fonts and their licences; confirm Principle I's wording matches the README
- [ ] T038 [P] [US5] Update `specs/ROADMAP.md`: mark spec 002 shipped, mark the two findings it resolves as resolved, and add the font choice to the notes for the vocabulary-versioning spec as a format field that already exists

**Checkpoint**: Documentation, constitution and behaviour agree.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation against the spec's success criteria.

- [ ] T039 Run every step of `specs/002-cross-machine-frames/quickstart.md` and record the outcome of each step in the pull request description
- [ ] T040 Check SC-005 against the commit before this feature: compare `golden/arm64/hashes.json` with the old `golden/hashes.json` and confirm the only existing keys whose hashes changed belong to `caption`, `text`, `rain`, `crosshair`, `led`, `sprite`, `composite:grid+wave+caption`, `composite:creative-accent` and `icon:led-unknown`; every other existing key is identical; `golden/CHANGES.md` has a row for each change made in T008, T015, T016, T020, T026 and T030
- [ ] T041 Check cost: `time npm run verify` finishes in under 60 seconds locally, the workflow run from T023 (or a later one) finished in under two minutes, and importing `src/index.ts` (which decodes and registers the three fonts) adds less than 100 ms, measured with `node --import tsx -e` timing before and after the import; record the three figures in the pull request description
- [ ] T042 Run `npm run check` and confirm `tsc` passes with the generated font modules; confirm `npm run verify:gates` from feature 001 still reports every primitive passing, in particular the purity gate (no file access at load or draw) and the palette gate for the text primitives in the new font
- [ ] T043 In the pull request description, list for the private product what it must re-record: every text case, plus `led` and `sprite`; and that it must compare against the reference set for the processor type it runs on

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: needs feature 001 merged and the constitution at 2.0.0
- **Foundational (Phase 2)**: depends on Setup; blocks every story
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on Foundational; its T025 to T026 should follow US1 so the `led` hashes move once for the font and once for the validated layer, each attributable
- **US3 (Phase 5)**: depends on Foundational; best after US1, since text cases only come within tolerance of the other type once both use the shipped font
- **US4 (Phase 6)**: depends on US2 (set-consistency rules) and US3 (tolerance check), which the refresh runs before replacing anything
- **US5 (Phase 7)**: depends on US1 to US4
- **Polish (Phase 8)**: depends on everything

### User Story Dependencies

- **US1 (P1)**: independent after Foundational
- **US2 (P2)**: independent in behaviour; ordered after US1 for attribution
- **US3 (P3)**: needs US1 for the text cases to pass the tolerance
- **US4 (P4)**: needs US2 and US3
- **US5 (P5)**: needs all of the above

### Within Each User Story

- A reference set changes only through `npm run golden:update`, and only in these tasks: T008 (x64 recorded, frames added), T015 (24 text keys), T016 (3 added), T020 (30 added), T026 (`led`, `sprite`), T030 (6 added). Any other change to a file under `golden/` is a defect.
- Each of those tasks states exactly which keys may change. Check the diff before moving on.
- T023 is the gate on the one open assumption. Do not continue past it on a text mismatch, and do not call the feature complete until it has passed.
- T019 must pass before T020 records per-font reference cases; a recorded hash cannot tell a correct layout from a clipped one.

### Parallel Opportunities

- T002 and T003 (font assets; change log)
- T022 (`NOTICE`) alongside any other US1 task
- T036, T037 and T038 (three different documents)

Most other tasks touch `scripts/verify-determinism.ts`, `scripts/lib/goldenHashes.ts` or
`scripts/golden-update.ts`, or re-record the reference sets, and must be sequential.

---

## Parallel Example: User Story 5

```bash
# Three documents, no shared files:
Task: "Update README.md with the promise table, fonts and refresh instructions"
Task: "Amend .specify/memory/constitution.md gate table and scope"
Task: "Update specs/ROADMAP.md status for spec 002"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (two reference sets, no rendering change)
3. Complete Phase 3: User Story 1 (shipped fonts, font choice)
4. **Stop and validate**: the automated build is green for the first time (T023), and text is
   identical on every machine of a processor type.

### Incremental Delivery

1. Setup + Foundational → verify picks a set by processor type; non-text cases pass on x64
2. US1 → text is deterministic; build goes green; specs can choose a font
3. US2 → sets are consistent and record real default behaviour
4. US3 → cross-type tolerance checked on every run
5. US4 → refresh is all-or-nothing with a change report
6. US5 → README and constitution state the real promise

`npm run verify` passes on the developer machine at the end of every task that runs it. On the
real build machine it is expected to fail on text cases until T023.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task
- Commit at story checkpoints, when the maintainer asks; push only when the maintainer asks
- No attribution lines in commit messages
- The private project name must not appear in code, docs or commit messages
- The font files are the official release files identified by the checksums in T002, verified
  across machines on 2026-10-01; a file with a different checksum is a different build and must be
  re-verified across machines before it is used
