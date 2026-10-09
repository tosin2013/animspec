# Implementation Plan: Publishable npm Package

**Branch**: `004-publishable-npm-package` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-publishable-npm-package/spec.md`

**Note**: No git branch has been created (no branch hook is installed). This feature starts
after `003-vocab-version-tiers` is merged (it is).

## Summary

Turn the source-only TypeScript library into an installable, publishable npm package named
`animspec` that renders identically to the reference interpreter. The work is: build the
library to a `dist/` JavaScript + type-declaration output with a documented public entry point,
make the package self-contained (fonts and icons already ship as in-memory data, so no file
reads are needed), remove the leftover application types from `src/types.ts`, remove the
full-vocabulary default from the model-facing description builders, and add an automated
release plus automated dependency updates — all verified by the existing offline gate and a new
"the package reproduces the golden hashes" check.

No reference frame moves. No runtime dependency is added. Decisions are in
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` 1.0.9 (the only runtime dependency, unchanged and
kept external). No new runtime dependency is added. The build uses `tsc` (already a
devDependency) — no new build-time dependency either.

**Storage**: None beyond the source tree. The package ships generated in-memory data (fonts,
icon bitmaps) as compiled modules; no asset files are read at runtime.

**Testing**: The existing offline gate scripts under `scripts/`, plus a new
`scripts/verify-package.ts` that builds the package, installs it into a scratch folder, and
confirms it reproduces the committed golden hashes (the M1 gate).

**Target Platform**: Node.js on arm64 and x64, macOS and Linux, as today.

**Project Type**: Library (npm package) with an offline verification harness.

**Performance Goals**: `npm run verify` stays under 60 s locally and the CI build under two
minutes. The new package check adds one build plus one render pass (a few seconds).

**Constraints**: Verify stays offline and one command. The release workflow is separate
automation, never part of `verify`, and must not use a self-hosted runner once public. No
reference frame moves. The package name is `animspec`.

**Scale/Scope**: About 8 source files to build, one new build config, one release workflow, one
Dependabot config, one new verification script, and a `package.json` rework. Removing
`buildVocabPrompt()`/`buildJsonSchema()`'s no-argument default touches a handful of call sites.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Packaging never changes what draws. The new package check proves the built package reproduces the golden hashes. No hash moves. |
| II. Registry is the single source of truth | Pass | No registry change. |
| III. Pure, palette-only, CPU-only primitives | Pass | No `draw` change. Fonts/icons stay in-memory data. |
| IV. Specs are untrusted input | Pass | Removing the full-vocabulary default narrows what a model can be shown; validation is unchanged. |
| V. Saved specs keep rendering | Pass | No rendering change. The removed types and the required `selection` argument are source/API changes, not spec changes; pre-release clause applies. |
| VI. One offline verify command | Pass | `npm run verify` is unchanged as a chain. The build and release workflows are separate automation, not the quality gate. CI stays one workflow, one job. |
| VII. Explicit boundaries | Pass | The spec carries the six entries and declares the boundary change. Publishing to a registry is a new kind of output and external service; the constitution baseline is amended in the same change. |
| Complexity | Pass, justified | `verify-package.ts` is the one new mechanism, required by the M1 gate (SC-001/SC-002). No removal or migration machinery is built. |

**Gates touched**: none of the four vetting gates change. A new gate script
(`verify-package.ts`) is added to the `verify` chain. `verify-determinism.ts` and
`verify-gates.ts` are untouched.

**Golden hashes**: not expected to move. A moved hash during this work is a defect.

**Amendment**: one amendment to the constitution baseline "Scope and Boundaries" — publishing
to the package registry moves from not-listed to in scope, and the registry is added as an
external dependency. No principle changes.

**Post-design re-check**: unchanged. No violation.

## Project Structure

### Documentation (this feature)

```text
specs/004-publishable-npm-package/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1 to R7
├── data-model.md        # Phase 1: package, public surface, release, dependency update
├── quickstart.md        # Phase 1: how to validate the feature end to end
├── contracts/
│   ├── package-surface.md   # The public entry points and what a consumer may rely on
│   └── release.md           # The release and dependency-update flow
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
src/                            # CHANGE: add `.js` extensions to relative imports;
│                               #         remove leftover app types from types.ts
│   └── types.ts                # CHANGE: keep only SignalFrame (the contract)
tsconfig.build.json             # NEW: emits JS + declarations to dist/
dist/                           # NEW (built, gitignored): the compiled package
scripts/verify-package.ts       # NEW: build + pack + install in a scratch dir, compare
│                               #      against the committed golden hashes
.github/workflows/publish.yml   # NEW: release workflow (tag → build → publish)
.github/dependabot.yml          # NEW: npm updates, weekly
package.json                    # CHANGE: drop `private`, add build script, `files`,
│                               #         `exports`/`main`/`types` → dist/, `publishConfig`
```

**Structure Decision**: Keep the single-project layout. The compiled output goes to a
gitignored `dist/`; the source stays where it is. The release workflow and Dependabot config
join the existing `.github/workflows/` and `.github/` directories.

## Complexity Tracking

No violations.
