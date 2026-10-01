---

description: "Task list for completing the primitive vetting gates"
---

# Tasks: Complete the Primitive Vetting Gates

**Input**: Design documents from `/specs/001-primitive-vetting-gates/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/gates.md, contracts/icon-data.md, quickstart.md

**Tests**: No separate test suite was requested. The feature itself is a set of gates, and each
gate ships with a deliberately rule-breaking fixture that the gate must reject (contracts/gates.md,
"Fixture self-test"). Those fixtures are implementation tasks, not optional tests.

**Organization**: Tasks are grouped by user story. Within each of US2, US3 and US4 the gate is
built first and must be seen to fail on the real offending primitive before that primitive is
fixed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 to US5)
- Paths are relative to the repository root. Run every command from the repository root.

## Path Conventions

Single project: library code in `src/`, gate scripts in `scripts/`, shared helpers in
`scripts/lib/`, fixtures in `scripts/fixtures/`, reference output in `golden/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A reviewable starting point and the files every later phase writes to.

- [X] T001 Create and switch to git branch `001-primitive-vetting-gates` from `main`, then run `npm run verify` and confirm it passes before any change
- [X] T002 [P] Create `golden/CHANGES.md` with a title, one paragraph stating that every intended change to `golden/hashes.json` needs an entry, and an empty table with the columns `date | primitive | cases | reason | spec` (fields from data-model.md, "Intended-change record")
- [X] T003 [P] Create `scripts/fixtures/badPrimitives.ts` exporting an empty `BAD_PRIMITIVES: Array<{ gate: "purity" | "palette" | "reactivity" | "budget"; def: PrimitiveDef }>` (import `PrimitiveDef` as a type from `../../src/primitives/registry`), with a header comment saying fixtures live outside `src/` so the library can never import them

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The probe set, the fixed-time signal frames, and the runner that every gate plugs into.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `scripts/lib/gateKit.ts` with `probeLayers(def)` returning `{ variation, layer }[]` built exactly as data-model.md "Probe layer" states: "the validated default layer; for each enum param, one layer per non-default value; for each boolean param, one layer with the value flipped; for each number param, one layer at its minimum and one at its maximum; for each string param, one layer with a known icon name and one with an unknown name" (use `"heart"` and `"zz-unknown"`), and pass every layer through `sanitizeLayer`
- [X] T005 Add signal probes to `scripts/lib/gateKit.ts`: `signalFrame(timeIndex, level, label)` building a closed-form `SignalFrame` at index 0, 12 or 47 (`t = index / 30`), with `level` any number from 0 to 1 (the gates use `0.02` near-silent, `0.5` mid and `0.95` loud) scaling `values`, `spectrum`, `amplitude` and `energy` the same way `goldenFrames()` in `scripts/lib/goldenHashes.ts` does, `labels: [label]`, and fixed position data `coords: [{ x: 0.25, y: 0.4 }, { x: 0.6, y: 0.55 }, { x: 0.8, y: 0.3 }]`; export the two fixed labels `"GOLDEN 0123"` and `"OTHER 9876"`
- [X] T006 Add `renderProbe(def, layer, { dims, frame, palette, under?, seed })` to `scripts/lib/gateKit.ts`: creates a canvas, fills it with `palette.bg`, draws any `under` primitive definitions first, then calls `def.draw` directly with `DrawContext { reducedFlicker: true, seed: 12345, text: frame.labels?.[0] }`, and returns the RGBA `Uint8ClampedArray`; it must not go through `getPrimitive`, so fixture definitions can be rendered
- [X] T007 Add the `GateResult` type to `scripts/lib/gateKit.ts` with the fields from data-model.md: `primitive`, `gate` (`purity | palette | reactivity | budget`), `pass`, `measured`, `allowed`, `case`
- [X] T008 Create `scripts/verify-gates.ts`: a runner that holds a list of gate functions `(defs: PrimitiveDef[]) => GateResult[]` (empty for now), runs them over `PRIMITIVES`, and prints the output format in contracts/gates.md: header `vetting gates (N primitives, M probes)`, one `FAIL  <gate>  <primitive>  <measured> (allowed <allowed>) — <case>` line per failing result, one `ok|FAIL  <gate>  passed/total` tally per gate, then `X/N primitives pass every gate` and `vetting gates passed` or `vetting gates FAILED (k result(s))`; exit non-zero if any result fails
- [X] T009 Add the fixture self-test to `scripts/verify-gates.ts`: before judging `PRIMITIVES`, run each registered gate over every `BAD_PRIMITIVES` entry for that gate (a gate may have more than one fixture) and fail the run with `FAIL  fixtures: <gate> did not reject <fixture>` if a fixture passes its own gate; print `ok    fixtures: each gate rejects its rule-breaking fixture (k/k)` otherwise
- [X] T010 In `package.json` add scripts `"verify:gates": "tsx scripts/verify-gates.ts"` and `"icons:generate": "tsx scripts/generate-icons.ts"`, and append `&& npm run verify:gates` to the `verify` script; run `npm run verify` and confirm it passes and ends with `29/29 primitives pass every gate`

**Checkpoint**: The runner works with zero gates. Stories can now add gates one at a time.

---

## Phase 3: User Story 1 - Drawing never touches files or the network (Priority: P1) 🎯 MVP

**Goal**: A primitive that reads files or uses the network while drawing is rejected by name, and
`led` and `sprite` draw icons from in-memory data, identically from any folder.

**Independent Test**: `npm run verify:gates` rejects the purity fixture and passes all 29
primitives; rendering `led` with `icon: "heart"` from the repository root and from another folder
gives the same hash (quickstart.md steps 4 and 5).

### Implementation for User Story 1

- [X] T011 [US1] Add icon reference cases to `scripts/lib/goldenHashes.ts` as extra entries rendered at the three golden frames, with explicit full layers: `icon:led-heart` (`{ type: "led", icon: "heart", scroll: false, effect: "static", reactive: false }`), `icon:led-unknown` (same with `icon: "zz-unknown"`), `icon:sprite-heart` (`{ type: "sprite", character: "none", icon: "heart", motion: "static", reactive: false }`), `icon:sprite-unknown` (same with `icon: "zz-unknown"`); then run `npm run golden:update` WITH THE EXISTING LOADER and confirm with `git diff golden/hashes.json` that 12 keys were added and no existing key changed; add a row to `golden/CHANGES.md`: primitive `led, sprite`, cases `icon:* (12 added)`, reason `reference cases added to prove icon output is unchanged by the loader rewrite; no rendering change`, spec `001`
- [X] T012 [US1] Create `scripts/generate-icons.ts`: read every `*.svg` in `node_modules/pixelarticons/svg` (resolve the folder from `import.meta.url`, not `process.cwd()`), replace `currentColor` with `#000000`, rasterise with `@resvg/resvg-js` at `fitTo: { mode: "height", value }` for heights 11 and 14 with `background: "white"` and `font: { loadSystemFonts: false }`, mark a cell lit when luminance `0.299r + 0.587g + 0.114b` is below 128, and write `src/primitives/iconData.ts` exporting `ICON_DATA: Record<string, Record<number, readonly [width: number, bits: string]>>` with names lower-cased and sorted, bits row-major and hex-packed, under a header comment stating the file is generated and is regenerated with `npm run icons:generate`
- [X] T013 [US1] Add a `--check` mode to `scripts/generate-icons.ts` and an exported `checkIconData(): boolean` that regenerates in memory and compares with the committed `src/primitives/iconData.ts`, printing `FAIL  icon data is stale — run: npm run icons:generate` and exiting non-zero on a difference
- [X] T014 [US1] Run `npm run icons:generate` to create `src/primitives/iconData.ts`; confirm it covers 1,036 names at heights 11 and 14 and that running the generator twice produces no diff
- [X] T015 [US1] One-off equivalence proof before touching the loader: write a temporary script outside the repository that, for every icon name and for heights 11 and 14, compares the existing `getIconBitmap(name, height)` from `src/primitives/icons.ts` with the bitmap decoded from `ICON_DATA`; all 2,072 must be identical (the old loader takes about two minutes); record the result in the pull request description and do not commit the script
- [X] T016 [US1] Rewrite `src/primitives/icons.ts` as a pure lookup matching contracts/icon-data.md exactly: "a name in `customIcons` → that custom bitmap, at its own size, whatever `height` is asked for"; "a generated icon name, `height` 11 or 14 → the generated bitmap"; "a generated icon name, any other `height` → `null`"; "an unknown name → `null`"; names trimmed and lower-cased; decoded bitmaps memoised in a `Map`; remove every import of `fs`, `path` and `@resvg/resvg-js` and the use of `process.cwd`
- [X] T017 [US1] Run `npm run verify:determinism` and confirm every hash matches, in particular the 12 `icon:*` keys added in T011, proving icon output is pixel-identical to the file-based loader
- [X] T018 [US1] Extend the static scan (check 1) in `scripts/verify-determinism.ts` so it also fails when a file under `src/` imports `fs`, `path`, `net`, `http`, `https`, `dns`, `dgram`, `child_process` or `worker_threads` (with or without the `node:` prefix, via `import` or `require`), or references `fetch(`, `XMLHttpRequest`, `WebSocket` or `process.cwd`; name the offending files in the failure line
- [X] T019 [US1] Add `withIoGuard(label, fn)` to `scripts/lib/gateKit.ts`: wrap the file entry points (`fs` sync and callback functions `readFile*`, `writeFile*`, `appendFile*`, `open*`, `exists*`, `stat*`, `lstat*`, `readdir*`, `access*`, `createReadStream`, `createWriteStream`, and the same names on `fs.promises`), network entry points (`net.connect`, `net.createConnection`, `http.request`, `http.get`, `https.request`, `https.get`, `dns.lookup`, `dns.resolve`), `child_process.spawn|exec|execFile|fork` and `globalThis.fetch`; call `syncBuiltinESMExports()` after patching and after restoring; record the names of calls made while `fn` runs; file calls are recorded and then forwarded to the real function, but network, DNS, child-process and `fetch` calls are recorded and NOT forwarded (the wrapper throws `Error("blocked by purity gate")`), so the suite never makes a real connection; `withIoGuard` catches an error thrown by `fn` and returns it alongside the recorded names; always restore in `finally`
- [X] T020 [US1] Add the purity gate to `scripts/verify-gates.ts`: for every primitive and every probe layer, render at 320×180 on `signalFrame(12, 0.5, "GOLDEN 0123")` inside `withIoGuard`; fail with `measured` set to the call names (for example `readFileSync`), `allowed` set to `no file or network access in draw`, and `case` set to the probe variation; in addition, for `led` and `sprite` render the four icon layers from T011 once normally and once after `process.chdir(os.tmpdir())` (restoring the original directory in `finally`) and fail with `measured` set to `output depends on the working directory` if any pair of hashes differs (FR-007, SC-004)
- [X] T021 [US1] Add the purity fixture to `scripts/fixtures/badPrimitives.ts`: two primitives, each of which fills one rectangle with `p.fg`: one whose `draw` first calls `fs.readFileSync` on `package.json`, and one whose `draw` first calls `net.connect(80, "127.0.0.1")`; register the purity gate in the fixture self-test and confirm both are rejected with the call name in `measured`
- [X] T022 [US1] Call `checkIconData()` at the start of `scripts/verify-gates.ts` and print `ok    icon data is up to date` or the stale message, failing the run if stale
- [X] T023 [US1] In `package.json` move `@resvg/resvg-js` and `pixelarticons` from `dependencies` to `devDependencies` (versions unchanged), run `npm install` to refresh `package-lock.json`, and confirm `npm run verify` still passes
- [X] T024 [P] [US1] Update `NOTICE`: state that bitmaps derived from `pixelarticons` (MIT) ship inside the library, and move `@resvg/resvg-js` (MPL-2.0) out of the shipped third-party list into a build-time-only line

**Checkpoint**: Purity is enforced. `src/` has no file or network imports. Runtime dependencies are down to `@napi-rs/canvas`.

---

## Phase 4: User Story 2 - Every pixel comes from the palette (Priority: P2)

**Goal**: A primitive that paints an off-palette colour is rejected by name, and `flash` stays on
palette when layered over accent colour and softens under the reduced-flicker setting.

**Independent Test**: `npm run verify:gates` rejects the palette fixture and passes all 29
primitives on both backgrounds, in monochrome and with accent, alone and layered.

### Implementation for User Story 2

- [X] T025 [US2] Add `paletteViolation(rgba, palette)` to `scripts/lib/gateKit.ts`: return the first pixel that lies outside the triangle of `palette.bg`, `palette.fg` and `palette.accent` in RGB space by more than 2 per channel (data-model.md: "a pixel complies if it lies inside the triangle of background, foreground and accent in RGB space, within 2 per channel"), plus the count of such pixels; when accent equals foreground the triangle is the line between background and foreground
- [X] T026 [US2] Add the palette gate to `scripts/verify-gates.ts`: for every primitive and every probe layer, render at 320×180 for each combination of background `black | white`, mode `monochrome (accent = fg) | accent #ff0000 | accent #0000ff`, and the three frames from `goldenFrames()` in `scripts/lib/goldenHashes.ts` (quiet, mid, loud); in the two accent modes also render the default layer layered over the `bars` and `rings` definitions; fail with `measured` set to `pixel r,g,b`, `allowed` set to `mix of bg/fg/accent`, and `case` naming background, mode, level and whether layered
- [X] T027 [US2] Add the palette fixture to `scripts/fixtures/badPrimitives.ts`: a primitive that fills a rectangle with the fixed colour `#00ff00`; register the palette gate in the fixture self-test
- [X] T028 [US2] Add a reference case for the full-strength flash to `scripts/lib/goldenHashes.ts`: let a case carry its own `reducedFlicker` value (default `true`, as today) and add `flash:full` (`{ type: "flash" }` rendered with `reducedFlicker: false`, `creative: false`) at the three golden frames; run `npm run golden:update` WITH THE EXISTING `flash` and confirm with `git diff golden/hashes.json` that 3 keys were added and no existing key changed; add a row to `golden/CHANGES.md`: primitive `flash`, cases `flash:full (3 added)`, reason `reference case added so the full-strength inversion is covered before flash is changed; no rendering change`, spec `001`
- [X] T029 [US2] Run `npm run verify:gates` and confirm it FAILS naming `flash` in a layered accent case and passes the other 28 primitives; this proves the gate catches the real offender before it is fixed
- [X] T030 [US2] Fix `flash` in `src/primitives/registry.ts` (add the `p` and `x` parameters to its `draw` signature). When the amplitude threshold is exceeded: if `x.reducedFlicker` is true, draw a soft foreground wash (`ctx.save()`, `globalAlpha = 0.25`, `fillStyle = p.fg`, full-frame `fillRect`, `ctx.restore()`), which honours constitution Principle III; else if `p.accent === p.fg`, keep the existing `difference` fill with white exactly as it is; else draw a strong foreground wash (same as the soft wash with `globalAlpha = 0.85`), which keeps accent-coloured layers on palette
- [X] T031 [US2] Run `npm run golden:update`, then confirm with `git diff golden/hashes.json` that exactly one existing key changed (`flash@loud`) and that the three `flash:full@*` keys from T028 did not change, proving the full-strength inversion is byte-identical; run `npm run verify` and confirm the palette gate reports 29/29; add a row to `golden/CHANGES.md`: primitive `flash`, cases `flash@loud`, reason `now honours reducedFlicker with a soft wash; full-strength accent mode washes instead of inverting, which produced the accent's complement`, spec `001`

**Checkpoint**: Palette is enforced. `flash` honours `reducedFlicker`. Output of the other 28 primitives is unchanged.

---

## Phase 5: User Story 3 - Every primitive responds to its signal (Priority: P3)

**Goal**: A primitive whose picture does not change with the signal at a fixed moment is rejected
by name, and `sweep` and `gridhorizon` respond to loudness.

**Independent Test**: `npm run verify:gates` rejects the reactivity fixture, passes `caption`,
`text` and `rain` on label, and passes all 29 primitives.

### Implementation for User Story 3

- [ ] T032 [US3] Add the reactivity gate to `scripts/verify-gates.ts`: for every primitive, with its validated default layer at 320×180, at each time index 0, 12 and 47 compare the render of level `0.02` against level `0.95` (same label) and the render of label `"GOLDEN 0123"` against `"OTHER 9876"` (same level `0.5`); data-model.md rule: "within one comparison, the time point is the same on both sides. Only level or only label differs"; pass if any of the six comparisons differs; fail with `measured` set to `identical output for silent/loud and for both labels`, `allowed` set to `output changes with signal level or text at a fixed time`
- [ ] T033 [US3] Add the reactivity fixture to `scripts/fixtures/badPrimitives.ts`: a primitive that draws a rectangle whose position depends only on `f.t`; register the reactivity gate in the fixture self-test
- [ ] T034 [US3] Run `npm run verify:gates` and confirm it FAILS naming exactly `sweep` and `gridhorizon`, and passes `caption`, `text` and `rain`
- [ ] T035 [US3] Change `sweep` in `src/primitives/registry.ts` so bar width scales with loudness: width becomes `num(l, "width", 4) * (0.5 + f.amplitude)`; position stays a function of `f.t`
- [ ] T036 [US3] Change `gridhorizon` in `src/primitives/registry.ts` so the sun pulses with loudness: its radius `sr` is multiplied by `(0.85 + 0.3 * f.amplitude)`; the grid and horizon are unchanged
- [ ] T037 [US3] Run `npm run golden:update`, then confirm with `git diff golden/hashes.json` that exactly six existing keys changed (`sweep@quiet|mid|loud`, `gridhorizon@quiet|mid|loud`) and nothing else; add two rows to `golden/CHANGES.md` (primitive, the three cases each, reason `moved only with the clock; now responds to loudness`, spec `001`)
- [ ] T038 [US3] Remove the informational reactivity report (check 4, the `info  N/29 primitives react to the signal` line) from `scripts/verify-determinism.ts` and update that file's header comment, since the reactivity gate supersedes it

**Checkpoint**: Reactivity is enforced with time held fixed.

---

## Phase 6: User Story 4 - Every primitive stays within the speed budget (Priority: P4)

**Goal**: A primitive that issues too many drawing operations is rejected with measured and allowed
figures, every primitive's time is reported, and `plasma` is within budget with identical output.

**Independent Test**: `npm run verify:gates` rejects the budget fixture, reports `budget 29/29`,
prints the time line, and `plasma` shows 1 operation.

### Implementation for User Story 4

- [ ] T039 [US4] Add `countOperations(ctx)` to `scripts/lib/gateKit.ts`: a `Proxy` over the 2D context that counts calls to `fillRect`, `strokeRect`, `clearRect`, `fill`, `stroke`, `fillText`, `strokeText`, `drawImage` and `putImageData`, forwards property sets to the real context, and exposes the count
- [ ] T040 [US4] Add `measureBudget(def)` to `scripts/lib/gateKit.ts` with the conditions from data-model.md "Speed measurement": "1920×1080, default probe, loud signal at the last reference time" (index 47, level 0.95); `operations` is the count from one draw through the proxy, excluding the background fill; `milliseconds` is the "median of five draws after one warm-up" on an unproxied context, reading one pixel back after each draw so the work is flushed
- [ ] T041 [US4] Add the budget gate to `scripts/verify-gates.ts` with the limits from data-model.md: "operations at most 3,000 (blocking); time at most 50 ms (blocking); time is always reported"; a failing result has `measured` such as `32400 ops` or `61.2 ms` and `allowed` such as `≤ 3000 ops` or `≤ 50 ms`; after the tallies print `info  time per 1080p frame (ms): ...` listing every primitive, slowest first
- [ ] T042 [US4] Add the budget fixture to `scripts/fixtures/badPrimitives.ts`: a primitive that calls `fillRect` 20,000 times; register the budget gate in the fixture self-test
- [ ] T043 [US4] Run `npm run verify:gates` and confirm it FAILS naming `plasma` with about `32400 ops` and passes the other 28 primitives
- [ ] T044 [US4] Rewrite `plasma` in `src/primitives/registry.ts` per research.md R7: with `bs = 8`, `cols = ceil(width / bs)`, `rows = ceil(height / bs)`, compute the same four-sine value per block (using `x = (i * bs) / width`, `y = (j * bs) / height`, the same brightness formula and `Math.round(b * 255)`) into an `ImageData` on an off-screen `createCanvas(cols, rows)`, then draw it once onto the main context at `cols * bs` by `rows * bs` with `imageSmoothingEnabled = false`, restoring `imageSmoothingEnabled` afterwards
- [ ] T045 [US4] Run `npm run verify` and confirm the three `plasma@*` hashes are unchanged, the budget gate reports 29/29, and `plasma` shows 1 operation in the output

**Checkpoint**: All four gates are enforced and all 29 primitives pass every gate.

---

## Phase 7: User Story 5 - One command proves the vocabulary is clean (Priority: P5)

**Goal**: The summary is trustworthy evidence for the first project gate, and the documentation
shows the four rules as enforced.

**Independent Test**: `npm run verify` ends with `29/29 primitives pass every gate`; breaking one
primitive makes it read `28/29` and exit non-zero; the documented gate lists match what runs.

### Implementation for User Story 5

- [ ] T046 [US5] Confirm the summary scenarios from spec.md User Story 5: run `npm run verify` (expect `29/29 primitives pass every gate`, exit 0); temporarily set a fixed `ctx.fillStyle = "#00ff00"` in `bars` in `src/primitives/registry.ts`, run `npm run verify:gates` (expect a `palette  bars` failure line, `28/29`, non-zero exit), then revert the change
- [ ] T047 [P] [US5] Update `README.md`: in "Verify" list the gates that `npm run verify` now runs (registry, validator, determinism, and the four vetting gates), mention `npm run icons:generate` and `golden/CHANGES.md`; add `scripts/verify-gates.ts`, `src/primitives/iconData.ts` and `golden/CHANGES.md` to the "What is here" table; remove the working-directory item from "Known limitations"; update "Third-party" to match `NOTICE`
- [ ] T048 [P] [US5] Amend `.specify/memory/constitution.md` with a PATCH bump from its current version (2.0.0 at the time of writing) and Last Amended set to the date of the change: in "Scope and Boundaries" change the Dependencies line to name `@napi-rs/canvas` as the only runtime dependency, with `@resvg/resvg-js` and `pixelarticons` as build-time dependencies; in the quality-gate table set "No network or file access in `draw`", "Reacts to the signal", "Uses palette colours only" and the speed-budget row to Enforced (`verify-gates.ts`), with the speed row reading "At most 3,000 drawing operations and 50 ms per 1080p frame"
- [ ] T049 [P] [US5] Update `specs/ROADMAP.md`: set spec 001's status to shipped and note that the icon bundling item of the npm package spec is delivered

**Checkpoint**: Evidence for the first project gate is one command, and the docs match it.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation against the spec's success criteria.

- [ ] T050 Run every step of `specs/001-primitive-vetting-gates/quickstart.md` and record the outcome of each step in the pull request description
- [ ] T051 Check stability (SC-006): run `npm run --silent verify:gates` ten times and confirm ten zero exit codes
- [ ] T052 Check cost (SC-007): `time npm run verify` finishes in under 60 seconds; if the palette gate dominates, reduce work without reducing coverage (for example render each probe once per palette and reuse the buffer)
- [ ] T053 Check SC-003 against `main`: `git diff main -- golden/hashes.json` shows exactly seven existing keys changed (`sweep@*`, `gridhorizon@*`, `flash@loud`) and 15 keys added (12 `icon:*`, 3 `flash:full@*`); `golden/CHANGES.md` has rows for the icon cases, the `flash:full` cases, `flash`, `sweep` and `gridhorizon`
- [ ] T054 Run `npm run check` and confirm `tsc` passes with the new scripts and the generated `src/primitives/iconData.ts`; confirm `src/index.ts` exports are unchanged
- [ ] T055 Once the maintainer asks for the branch to be pushed, run the manual workflow once on it (`gh workflow run verify.yml --ref 001-primitive-vetting-gates`) and record in the pull request description the verdict of `verify:gates` and the job duration (FR-002, SC-007); the determinism gate is expected to fail on the Linux runner until the cross-platform finding in `specs/ROADMAP.md` is resolved, so judge this feature on the four vetting gates and the duration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks every story
- **US1 to US4 (Phases 3 to 6)**: each depends only on Foundational
- **US5 (Phase 7)**: depends on US1 to US4, since it documents and evidences all four gates
- **Polish (Phase 8)**: depends on everything

### User Story Dependencies

- **US1 (P1)**: independent. Largest story; contains the icon work.
- **US2 (P2)**: independent of US1.
- **US3 (P3)**: independent of US1 and US2.
- **US4 (P4)**: independent of the others.
- **US5 (P5)**: needs US1 to US4 complete.

US1 to US4 are independent in behaviour but share three files (`scripts/lib/gateKit.ts`,
`scripts/verify-gates.ts`, `src/primitives/registry.ts`), so one person should take them in
priority order.

### Within Each User Story

- US1: T011 must run before T016. The icon reference hashes are recorded with the old loader, and
  must not move after the loader is replaced (T017).
- US2, US3, US4: gate, then fixture, then observe the real failure, then fix the primitive, then
  confirm.
- Golden updates happen only in T011 (12 added), T028 (3 added), T031 (`flash@loud`) and T037
  (six keys). Any other change to `golden/hashes.json` is a defect.
- US2: T028 must run before T030, for the same reason T011 runs before T016.

### Parallel Opportunities

- T002 and T003 (different new files)
- T024 (`NOTICE`) alongside any other US1 task
- T047, T048 and T049 (three different documents)

Most other tasks touch `gateKit.ts`, `verify-gates.ts` or `registry.ts` and must be sequential.

---

## Parallel Example: User Story 5

```bash
# Three documents, no shared files:
Task: "Update README.md Verify, What is here, Known limitations and Third-party sections"
Task: "Amend .specify/memory/constitution.md with a PATCH bump"
Task: "Update specs/ROADMAP.md status for spec 001"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **Stop and validate**: purity is enforced, icons work from any folder, runtime dependencies are
   down to one. This alone unblocks packaging (the npm package spec on the roadmap).

### Incremental Delivery

1. Setup + Foundational → the runner reports `29/29` with no gates
2. US1 → purity enforced, icons pre-generated
3. US2 → palette enforced, `flash` fixed (one golden hash moves)
4. US3 → reactivity enforced, `sweep` and `gridhorizon` fixed (six golden hashes move)
5. US4 → budget enforced, `plasma` fixed
6. US5 → docs and constitution match; first project gate has its evidence

`npm run verify` passes at the end of every story, so each is a safe stopping point. It fails on
purpose between the "observe the real failure" task and the fix that follows it (T029 to T031,
T034 to T037, T043 to T044); do not push in those windows, because the pre-push hook runs it.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task
- Commit at story checkpoints, when the maintainer asks
- No attribution lines in commit messages
- The private project name must not appear in code, docs or commit messages
- Not in scope, recorded in research.md and `specs/ROADMAP.md`: golden hashes differing between
  macOS and the Linux build machine (F1) and the unvalidated layers in the existing golden cases (F2)
