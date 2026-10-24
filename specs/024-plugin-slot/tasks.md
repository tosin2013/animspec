---

description: "Task list for the plugin slot"
---

# Tasks: Plugin Slot

**Input**: Design documents from `/specs/024-plugin-slot/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/plugin-slot.md, quickstart.md

**Tests**: No separate suite. The checks go in the existing gates, using fixture plugins.

**Organization**:
- US1: register a plugin and use it from a spec.
- US2: verify a plugin with the shared core checks.
- US3: isolation from models, plus CLI records.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change, and none is added: core references
  never include plugins.
- The gate-code move (T002–T004) must leave every gate verdict identical.
- No gate or threshold edits. At most 3 failed `npm run verify` attempts.
- `src/` stays free of `fs` imports and of `Math.random`, `Date` and `performance.now`.
- **Checkpoint**: passed. Motion Studio reviewed the contract in PR #148 (2026-10-24), and
  its five requests are folded in as T007a, T009a, T016 and T017 changes, plus contract
  section 5.

---

## Phase 1: Setup

- [ ] T001 Confirm the starting point:
  - Branch `feature/024-plugin-slot` is based on `main` at `613107e`.
  - `.specify/feature.json` points at `specs/024-plugin-slot`.
  - `npm run verify` passes. Save its full output as the verdict baseline:
    `npm run verify > <scratchpad>/v24-baseline.log`.
  - The contract checkpoint has been confirmed (done: PR #148 review).

---

## Phase 2: Foundational - one implementation of the checks (no behaviour change)

**Purpose**: Move the gate checks into `verify/` so core gates and `verifyPlugin` share them (R5).

- [ ] T002 Set up the new entry point:
  - Create `tsconfig.verify.json`: include `verify/**/*`, outDir `dist-verify`, rootDir `verify`, NodeNext, strict, types node.
  - In `package.json`: add the `exports` entry `"./verify": { "types": "./dist-verify/index.d.ts", "import": "./dist-verify/index.js" }`, add `dist-verify` to `files`, and append `&& tsc -p tsconfig.verify.json` to the `build` script. `check` already runs `build`.
- [ ] T003 Create `verify/index.ts` by moving, unchanged in behaviour:
  - **From `scripts/lib/gateKit.ts`**: `probeLayers`, `signalFrame`, `GOLDEN_LABEL`/`OTHER_LABEL`, `RenderOpts`, `renderProbe`, `countOperations`, `measureBudget`, `rgbOf`, `paletteViolation` with its geometry and `PALETTE_TOLERANCE`, the IO guard (`withIoGuard` and its patch tables), and `probeAssets`.
  - **Imports**: from `../dist/index.js` (`PRIMITIVES`, `sanitizeLayer`, `drawSpec`, types) so the built entry works from the package. Fonts come via the existing exported `resolveFontFamily`, which is added to the `src/index.ts` exports if it isn't there.

  Rewrite `scripts/lib/gateKit.ts` to re-export these from `../../verify/index`, keeping its other helpers (`totalProbes`, `measureCompositionBudget`) in place.
- [ ] T004 Extract the per-primitive bodies into `verify/index.ts`:
  - From `scripts/verify-gates.ts`: `runPurityGate`, `runPaletteGate` (with `rolesProbe` and the palette modes), `runReactivityGate` and `runBudgetGate` become exported `checkPurity(def)`, `checkPalette(def, opts?)`, `checkReactivity(def)` and `checkBudget(def, clock)`, each returning a `GateResult`-shaped object.
  - The budget clock is a parameter: `verify/` may use `performance.now` as its default, because it is not under `src/`.
  - `verify-gates.ts` maps the core defs through them.
  - Run `npm run verify` and diff it against the T001 baseline. The PASS/FAIL lines and the measured info lines must be identical (timing values may vary).

**Checkpoint**: verify is green, with identical verdicts, and `animspec/verify` builds.

---

## Phase 3: User Story 1 - Register and use a plugin (Priority: P1) 🎯 MVP

**Goal**: A registered plugin's primitives validate and render from a spec, with binds, the camera and transparency.

**Independent Test**: The `good` fixture registers. A spec declaring it renders `ext:good/starfield` identically twice and chunked, with a bind and the camera. Each invalid use is dropped with its reason.

- [ ] T005 [US1] In `src/primitives/registry.ts`:
  - Add `"external"` to `TIERS`.
  - Add `export const EXTERNALS = new Map<string, PrimitiveDef>()`, an internal `export function addExternal(def: PrimitiveDef)`, and `export const externalPrimitives = () => [...EXTERNALS.values()]`.
  - `getPrimitive` and `sanitizeLayer` look up `byType.get(t) ?? EXTERNALS.get(t)`.
  - Extract the registry gate's param well-formedness rules into an exported `paramSpecProblems(def): string[]` (the number bounds and default inside them, enum default in values, string maxLen ≥ 1 and default within it), and use it from `scripts/verify-registry.ts` too.
- [ ] T006 [US1] In `scripts/lib/vocabularyRules.ts` `tierProblems`, report a core primitive with tier `external`. Add a fixture to `scripts/fixtures/tierFixtures.ts` and a `checkCaught` line in `verify-registry.ts`.
- [ ] T007 [US1] Create `src/plugins.ts`:
  - `export interface Plugin { id: string; version: string; licence: string; primitives: PrimitiveDef[] }`.
  - `registerPlugin(p)`, enforcing research.md R3 exactly:
    - an id that is `ROLE_NAME`;
    - a version 1–64 characters and a licence 1–128 characters;
    - a type that is `ROLE_NAME`, unique within the plugin;
    - `paramSpecProblems` empty;
    - the same id at a different version throws; the same version is a no-op.

    It registers `{ ...def, type: "ext:<id>/<type>", tier: "external" }` via `addExternal`.
  - `registeredPlugins(): Array<{ id, version, licence, types }>`.
  - `sanitizePlugins(raw): { plugins: Record<id, { version }>; problems: string[] }`.
- [ ] T007a [US1] SPDX validation (R9):
  - Add `spdx-license-ids` and `spdx-exceptions` as devDependencies.
  - Create `scripts/generate-spdx.ts`, which writes `src/spdxData.ts` (sorted id and exception arrays, plus a header naming the source versions and their CC0 licence).
  - Create `src/spdx.ts` with `isSpdxExpression(s: string): boolean`, a recursive-descent parser over ids, `LicenseRef-…`, `+`, `WITH`, `AND`, `OR` and parentheses.
  - `registerPlugin` rejects with the message `licence must be a valid SPDX license expression (got "<s>")`.
  - Add a freshness check for `src/spdxData.ts` in `scripts/verify-registry.ts`, following the font/icon data pattern.
  - Add parser checks:
    - accepted: `MIT`, `Apache-2.0`, `MIT OR Apache-2.0`, `GPL-2.0-or-later WITH Classpath-exception-2.0`, `(MIT AND BSD-3-Clause)`, `LicenseRef-acme-1`;
    - rejected: `Apache 2`, `MIT OR`, `Foo-1.0`, the empty string.
- [ ] T008 [US1] In `src/specValidator.ts`:
  - Sanitize `obj.plugins`, push its problems, and keep the result when non-empty.
  - For each layer whose raw type starts with `ext:`, apply research.md R2 in order, with these exact messages:
    - `plugin <id> is not declared in plugins`;
    - `plugin <id> is not registered`;
    - `plugin <id> is version <r>, spec wants <d>`;
    - `plugin <id> has no type <t>`.

    A failing layer is dropped and its type pushed to `dropped`.
  - Add `plugins` to the returned spec. Add `plugins` to `AnimSpec` in `src/specInterpreter.ts`.
- [ ] T009 [US1] In `src/specInterpreter.ts` `drawSpec`:
  - Wrap only layers whose type starts with `ext:` in `ctx.save()`, `try { def.draw(...) } catch (e) { opts.onLayerError?.(layer.type, e) }`, and `finally { ctx.restore() }`.
  - Add `onLayerError?: (type: string, error: unknown) => void` to `SpecOpts`.
  - Core layers keep today's exact path.
- [ ] T009a [US1] In `src/primitives/registry.ts` `DrawContext`, add `layerSeed?: number` (spec 024: a per-layer seed, `mixSeed(seed, layerIndex)`). In `src/specInterpreter.ts`, set it for every layer from the existing `layerIndex`. Core primitives don't read it, and every core hash must be unchanged. Add a determinism check: two identical `ext:good/starfield` layers in one spec draw different star positions, using `layerSeed` in the `good` fixture.
- [ ] T010 [P] [US1] Export `registerPlugin`, `registeredPlugins` and the `Plugin` type from `src/index.ts`.
- [ ] T011 [P] [US1] Create the fixture plugins in `scripts/fixtures/plugins/`, as `.ts` files with a default export plugin. They are compiled for the CLI test by `tsx`, so the CLI test loads them through `tsx` or a prebuilt JS copy written to the temp folder.
  - `good.ts`: `starfield`, which draws `count` 2 × 2 squares at seeded positions with `fg`, the brightest in `accent`, with size scaled by amplitude.
  - `random.ts`: `noisy`, which uses `Math.random`.
  - `offpalette.ts`: `green`, which fills `#00ff00`.
  - `fileread.ts`: `peek`, which calls `fs.readFileSync` in draw.
  - `heavy.ts`: `swarm`, which makes 5,000 `fillRect` calls.
  - `thrower.ts`: `boom`, which throws.
- [ ] T012 [US1] Add the checks:
  - **`scripts/verify-registry.ts`**:
    - registering `good` works, and twice at the same version is a no-op;
    - a different version throws;
    - a bad id throws;
    - a type `grid` registers namespaced (no collision possible) and does not change `getPrimitive("grid")`;
    - malformed params throw.
  - **`scripts/verify-spec-validator.ts`**: the four drop messages, plus a clean declared spec.
  - **`scripts/verify-determinism.ts`**:
    - an `ext:good/starfield` layer with a `bind` and a `camera` renders identically twice, and chunked equals whole;
    - a transparent-background render works;
    - a `thrower` layer draws nothing, other layers still draw, and `onLayerError` was called.

**Checkpoint**: The plugin slot works end to end.

---

## Phase 4: User Story 2 - Verify a plugin (Priority: P2)

**Goal**: `verifyPlugin` reports the five checks, using the shared implementation.

**Independent Test**: `good` passes all five checks. Each faulty fixture fails exactly its target check.

- [ ] T013 [US2] In `verify/index.ts`:
  - Add `checkDeterminism(def)`: render each `probeLayers` layer at frames [0, 12, 47], twice, and in forward and reverse order on fresh canvases, and compare the hashes.
  - Add `verifyPlugin(plugin, opts?: { clock?: () => number })`. It registers the plugin if needed, runs `checkDeterminism`, `checkPalette`, `checkBudget`, `checkReactivity` and `checkPurity` on each namespaced primitive, and returns `{ ok, primitives: [{ type, checks: [{ name, pass, measured, allowed }] }] }`.
- [ ] T014 [US2] In `scripts/verify-gates.ts`, add the plugin verifier checks:
  - `verifyPlugin(good).ok`.
  - Exactly the targeted check fails for each faulty fixture: random → determinism, offpalette → palette, fileread → purity, heavy → budget.
  - Print one line per fixture.

---

## Phase 5: User Story 3 - Isolation and records (Priority: P3)

**Goal**: Models never see externals unless named. The CLI loads plugins and records them.

**Independent Test**: 1,000 selections with `good` registered offer 0 externals. The CLI renders with `--plugin` and lists it in the manifest. `verify-plugin` exits 0 for `good` and non-zero for `random`.

- [ ] T015 [US3] In `scripts/verify-registry.ts`:
  - With `good` registered, 1,000 `select()` calls across kits, breadths and seeds offer no type starting with `ext:`.
  - `buildVocabPrompt([...select(...), ...externalPrimitives()])` includes them, labelled `[external]`.

  Add that label to `buildVocabPrompt` in `registry.ts` for defs with tier `external` (core output is unchanged).
- [ ] T016 [US3] In `cli/render.ts`:
  - `--plugin <path>` (multiple, via `parseArgs` `multiple: true`): `await import(pathToFileURL(resolve(path)).href)`, then call `registerPlugin(mod.default)` before validation. A failure exits with code 2 and a message.
  - The manifest adds `plugins` (the id, version and licence of the plugins the spec declares and uses, and the **sha256 of each loaded module file**) and `"guarantee": "core-only"` when any are used.
  - Forward `onLayerError` as `{"layerError": {type, message}}` stderr lines.
- [ ] T017 [US3] In `cli/animspec.ts`, add the subcommand `verify-plugin <path> [--json]`.
  - It imports the module and runs `verifyPlugin` (from `../dist-verify/index.js`).
  - Output: a readable summary by default, or the report as one JSON object with `--json`.
  - Exit codes, which are stable and documented: 0 when `ok`, **6** when any check fails, 2 on a usage or load error.
  - Update the usage text.
- [ ] T018 [US3] In `scripts/verify-cli.ts`:
  - Write a compiled JS copy of the `good` and `random` fixtures to the temp folder. Use `esbuild` from tsx's dependency, or write a hand-written `.mjs` equivalent in the test.
  - Assert that `render --plugin good.mjs` renders and the manifest has the plugin and `core-only`.
  - Assert that `verify-plugin good.mjs` exits 0 and `verify-plugin random.mjs` exits 6.
  - Assert that `verify-plugin random.mjs --json` prints a parseable report whose failing check is `determinism`.
  - Assert that the render manifest's plugin entry carries the module file's sha256.

---

## Phase 6: Polish

- [ ] T019 Amend `.specify/memory/constitution.md` to 6.0.0 per research.md R7:
  - Principles I and II text, and the Principle IV note.
  - "The format" entry: `plugins`, `ext:`.
  - The scope list: the `animspec/verify` entry, CLI `--plugin` and `verify-plugin`, `registerPlugin`.
  - A Quality Gates row.
  - Section 4, External dependencies: add `spdx-license-ids` and `spdx-exceptions` (CC0) under build time, as dependencies of the SPDX data generator, and note that the SPDX id lists ship in the library as data. Add the attribution to `NOTICE`, as is done for `pixelarticons`-derived bitmaps.
  - An amendment note (MAJOR).
- [ ] T020 [P] Docs:
  - `docs/user-guide.md`: a "Plugins" section summarising contracts/plugin-slot.md.
  - `CHANGELOG.md` Unreleased: a bullet (the vocabulary is unchanged at 16).
  - `specs/ROADMAP.md`: a 024 row, and the "Plugin slot" row updated.
- [ ] T021 Run `npm run verify` (at most 3 failed attempts). Confirm the golden hashes are unchanged against `main`, with 0 changed and 0 added. Confirm `npm pack --dry-run` lists `dist-verify/`.
- [ ] T022 Commit, push, and open the PR ("feat: plugin slot contract (spec 024)"). Comment on #92 with the contract link.

---

## Dependencies & Execution Order

- T001 (with the checkpoint) → T002 → T003 → T004. This move is a strict prerequisite for everything else.
- **US1**: T005 → T006 → T007 → T008 → T009. T010 and T011 can run in parallel after T007. T012 comes last.
- **US2**: T013 needs T004 and T007. Then T014.
- **US3**: T015 needs T005 and T007. T016 → T017 → T018 need T013.
- **Polish**: last.

## Parallel Examples

- After T007: T010 (`src/index.ts`) and T011 (fixtures).
- T020 (docs) alongside T019 (constitution).

## Implementation Strategy

- **MVP**: Phases 1–3. Plugins register and render from specs.
- **Then**: the verifier (US2), isolation and the CLI (US3), then polish.
- One PR. The amendment ships with it, because Principles I and II are violated without it.
