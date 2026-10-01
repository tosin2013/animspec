# Implementation Plan: Complete the Primitive Vetting Gates

**Branch**: `001-primitive-vetting-gates` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-primitive-vetting-gates/spec.md`

**Note**: No git branch has been created; work is currently on `main`. The name above is the
feature identifier.

## Summary

Turn four written rules into automatic gates that run inside `npm run verify`, and bring the
existing primitives into line, so that all 29 pass every gate.

- **New gates**, in one script with a per-primitive summary: no file or network access while
  drawing; palette only; responds to the signal with time held fixed; within the speed budget.
- **Icons** are pre-generated into a committed data module, so `led` and `sprite` no longer
  read from disk and no longer depend on the working directory.
- **Primitive fixes**: `plasma` (byte-identical, 32,400 operations down to 1); `sweep` and
  `gridhorizon` (now respond to loudness; six golden hashes change); `flash` (honours
  `reducedFlicker` with a soft wash, so `flash@loud` changes; stays on palette when layered
  over accent colour; full-strength monochrome output unchanged).

Approach and evidence are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 in `strict` mode, ES modules, run with `tsx`; Node.js 22
or later

**Primary Dependencies**: `@napi-rs/canvas` 1.0.9 (runtime). `@resvg/resvg-js` 2.6.2 and
`pixelarticons` 2.4.1 move from runtime to development dependencies; they are used only by
the icon generator and its freshness check. No dependency is added.

**Storage**: Files in the repository: `golden/hashes.json` (reference hashes), a new
`golden/CHANGES.md` (intended-change log), a new generated `src/primitives/iconData.ts`

**Testing**: Plain gate scripts under `scripts/`, chained by `npm run verify`. No test
framework. Deliberately bad fixture primitives self-test each new gate.

**Target Platform**: Node.js on macOS and Linux; CI on `ubuntu-latest`

**Project Type**: Library with an offline verification harness

**Performance Goals**: Every primitive at most 3,000 drawing operations per 1920×1080 frame at
default settings, and under 50 ms. Full `npm run verify` under 60 s locally.

**Constraints**: Offline, no network or services. Deterministic verdicts on repeated runs.
One command locally and in CI. Monochrome output of primitives not named as intended changes
stays byte-identical.

**Scale/Scope**: 29 primitives today, 148 probe layers; designed for 100 or more without
per-primitive setup. About 6 source files changed, 5 added.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass on the reference machine; see note | Golden updates are intended and named: `sweep`, `gridhorizon` and `flash@loud` (seven hashes). New reference cases (icons, full-strength flash) are additive and logged. `plasma` and full-strength monochrome `flash` are verified byte-identical. Each change is logged in `golden/CHANGES.md`. |
| II. Registry is the single source of truth | Pass | Gates iterate the registry; probes are derived from each primitive's declared params. The icon data module is generated, with a freshness check, not hand-synchronised. |
| III. Pure, palette-only, CPU-only primitives | Pass | This feature gates purity and palette. `flash` is changed to honour `reducedFlicker`; the other primitives that strobe (`led`, `tetris`, `noise`) already do, by reading the code. There is no automatic gate for `reducedFlicker`. Off-screen canvases used inside `draw` are CPU canvases from the same library. |
| IV. Specs are untrusted input | Pass | Validator unchanged. The new gates render validated layers. |
| V. Saved specs keep rendering | Pass | `sweep`, `gridhorizon` and `flash` change in place. Constitution 1.1.0 allows this before the first published release, provided the change is intended, re-baselined and recorded, which tasks T031 and T037 do. |
| VI. One offline verify command | Pass | One more step in the same chain; offline; still one CI job. |
| Scope and boundaries | Pass | No product code. Runtime dependencies shrink from three to one. `NOTICE` updated for the shipped icon bitmaps. |

**Note on Principle I ("every machine")**: a run of the existing suite on the Linux build
machine on 2026-10-01 failed the golden comparison for `bars`, `hbars` and `radial` among
others, none of which draw text. Golden hashes are therefore specific to the machine that
recorded them. This predates the feature and is not changed by it; it is tracked in
`specs/ROADMAP.md`. The four new gates do not compare hashes across machines.

**Constitution amendment required by this feature** (PATCH from the current version, task
T048): the Dependencies line lists three runtime dependencies and becomes one; the
quality-gate table moves four rows from Planned or Reported to Enforced. The wording that lets
`golden:update` add reference cases was made in the 2.0.0 amendment and is no longer part of
this task.

**Post-design re-check**: unchanged. The design adds no violation.

## Project Structure

### Documentation (this feature)

```text
specs/001-primitive-vetting-gates/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and prototype evidence
├── data-model.md        # Phase 1: probes, gate results, icon data, change log
├── quickstart.md        # Phase 1: how to validate the feature end to end
├── contracts/
│   ├── gates.md         # What each gate checks, its output and exit codes
│   └── icon-data.md     # Generated icon data and the lookup's behaviour
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
src/
├── primitives/
│   ├── registry.ts        # CHANGE: plasma, sweep, gridhorizon, flash
│   ├── icons.ts           # CHANGE: pure lookup, no fs/path/resvg/cwd
│   ├── iconData.ts        # NEW, generated: packed bitmaps at heights 11 and 14
│   ├── customIcons.ts
│   ├── selector.ts
│   └── sprites.ts
├── specInterpreter.ts
├── specValidator.ts
├── rng.ts
├── types.ts
└── index.ts

scripts/
├── verify-registry.ts
├── verify-spec-validator.ts
├── verify-determinism.ts  # CHANGE: static scan also bans IO imports and process.cwd;
│                          #         informational reactivity line removed
├── verify-gates.ts        # NEW: the four gates, fixture self-test, summary
├── generate-icons.ts      # NEW: writes src/primitives/iconData.ts; --check for freshness
├── lib/
│   ├── goldenHashes.ts    # CHANGE: additive icon reference cases
│   └── gateKit.ts         # NEW: probes, fixed-time frames, IO guard, op counter, palette test
└── fixtures/
    └── badPrimitives.ts   # NEW: one rule-breaking primitive per gate

golden/
├── hashes.json            # CHANGE: sweep, gridhorizon, flash@loud; new icon and flash:full cases
└── CHANGES.md             # NEW: intended-change log

package.json               # CHANGE: scripts, dependency sections
NOTICE                     # CHANGE: shipped icon bitmaps; rasteriser no longer shipped
README.md                  # CHANGE: gates list, known limitations
.specify/memory/constitution.md  # CHANGE: PATCH amendment
```

**Structure Decision**: Keep the existing single-project layout: library code in `src/`,
gates as plain scripts in `scripts/`, shared helpers in `scripts/lib/`. No new top-level
directories. Fixtures sit under `scripts/` so the bad primitives can never be imported by the
library.

## Design Notes

**Order of work matters for byte-identity.** The icon reference cases are added and their
hashes recorded while the old icon loader is still in place. The loader is then replaced, and
those hashes must not move. The same applies to `plasma`: its existing hashes are the proof.

**Gate order in the chain**: `check` → `verify:registry` → `verify:validator` →
`verify:determinism` → `verify:gates`. The icon freshness check runs at the start of
`verify:gates`.

**What each gate renders** is specified in [contracts/gates.md](contracts/gates.md); the
shapes of probes and results are in [data-model.md](data-model.md).

**Cost**: about 3,000 palette renders at 320×180 (148 probes on two backgrounds, three
palette modes and three frames, plus the layered cases) and 29 full-HD budget renders. The
existing suite takes 17 seconds end to end on the build machine; task T052 checks the new
total stays under a minute.

## Complexity Tracking

No violations. The in-place changes to `sweep`, `gridhorizon` and `flash` were a Principle V
violation under constitution 1.0.0; amendment 1.1.0 (2026-10-01) allows them before the first
published release.
