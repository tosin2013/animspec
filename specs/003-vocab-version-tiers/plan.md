# Implementation Plan: Vocabulary Version and Tiers

**Branch**: `003-vocab-version-tiers` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-vocab-version-tiers/spec.md`

**Note**: No git branch has been created. Implementation starts after
`002-cross-machine-frames` is merged, because both features edit the same source files
([research.md](research.md) R11).

## Summary

Give every spec a recorded vocabulary version and every primitive a tier, so the vocabulary
can grow and primitives can be replaced without changing saved specs or what a model is shown.

- **Version**: one whole number, declared in the registry, starting at 1. Validation writes
  it into every spec it returns. The interpreter ignores it.
- **Tiers**: a required field on each registry entry. 24 primitives start as core and 5 as
  extended. Selection offers core by default, a kit's extended primitives with that kit,
  contrib only when named, legacy never.
- **Replacement**: a legacy entry names its replacement and keeps its reference frames.
  Proven with a fixture; no shipped primitive is replaced.
- **Checks**: tier and version rules run inside the existing registry gate, each proven
  against a fixture that breaks it. A committed record catches a vocabulary change made
  without raising the version.
- **Documentation**: a generated `VOCABULARY.md` lists the version, its history and every
  primitive's tier.

No reference frame moves. No dependency is added. Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 in `strict` mode, ES modules, run with `tsx`; Node.js 22
or later

**Primary Dependencies**: `@napi-rs/canvas` 1.0.9 (runtime, unchanged). No dependency is
added.

**Storage**: Files in the repository: `golden/vocabulary.json` (the vocabulary record) and
`VOCABULARY.md` (generated). The reference sets under `golden/<type>/` are not touched.

**Testing**: The existing gate scripts under `scripts/`, chained by `npm run verify`. No test
framework. New rules are proven with fixtures, as the vetting gates are.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux, as today

**Project Type**: Library with an offline verification harness

**Performance Goals**: The new checks add under one second to `npm run verify`: about 9,000
selections and a handful of small renders. The automated build stays under two minutes.

**Constraints**: Verify stays offline and one command. Zero reference frames change.
`select(kit, breadth, seed)` keeps its shape. Tier and version have one source, the registry.

**Scale/Scope**: 29 primitives today, 100 targeted at v1.0, no cap after. 8 kits. About 7
source files changed and 5 added; about 250 lines of library code and 400 of checks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 2.1.0 (amended 2026-10-01, not yet committed).

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | No reference frame moves: the interpreter does not read the version or the tier. Selection stays a pure function of its inputs, seeded only through `mulberry32`. No hashes are expected to move, so `golden:update` is not run. |
| II. Registry is the single source of truth | Pass | Tier, replacement and version are declared in the registry. Selection, descriptions, checks, the record and `VOCABULARY.md` are derived from it. Kit lists stay the one list of kit membership. |
| III. Pure, palette-only, CPU-only primitives | Pass | No draw function changes. |
| IV. Specs are untrusted input | Pass | `vocabulary` is validated like `font` and `accent`: repaired, reported, never silently discarded. A model is still shown a bounded selection, now narrower by tier. `select(kit, breadth, seed)` is unchanged in shape; named primitives are taken only by `selectDetailed`. |
| V. Saved specs keep rendering | Pass | This feature builds what the principle requires from first release: specs record a version, a replaced primitive moves to legacy and still renders, and is never offered. The pre-release allowance is not used: no primitive changes in place. |
| VI. One offline verify command | Pass | New checks live in the existing registry gate. `npm run verify` is unchanged as a chain. One script is added, `vocab:record`, which is a maintainer command like `golden:update`, not part of verify. CI is untouched. |
| VII. Explicit boundaries | Pass | The spec carries the six entries. **Boundary change: none.** Everything falls under the baseline's format, vocabulary, validation, selection, verification and governance entries. New exports (`VOCABULARY_VERSION`, the tier type, `selectDetailed`) are of kinds the public surface already has. No dependency, service, platform or kind of output is added. |
| Scope and Boundaries | Pass | Nothing from the "held by the caller" or permanent out-of-scope lists is taken on. |
| Complexity | Pass, justified | Two additions beyond the minimum, each tied to a requirement: the vocabulary record (FR-024 cannot be checked without something to compare against, R7) and `selectDetailed` (FR-014 requires the caller be told, R6). No removal or migration mechanism is built. |

**Gates touched**: the registry gate (new tier, version, sweep and fixture checks) and the
validator gate (new version cases). The determinism and vetting gates are not changed.

**Golden hashes**: not expected to move. A moved hash during this work is a defect.

**Amendment**: one MINOR amendment at the end of the work adds two rows to the quality-gate
table ("every primitive has a valid tier and kits offer only what tiers allow"; "the
vocabulary version rises when the vocabulary changes"), both Enforced. No principle changes.

**Post-design re-check**: unchanged. No violation.

## Project Structure

### Documentation (this feature)

```text
specs/003-vocab-version-tiers/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1 to R11
├── data-model.md        # Phase 1: version, tier, kit, selection, record
├── quickstart.md        # Phase 1: how to validate the feature end to end
├── contracts/
│   ├── vocabulary-version.md     # The spec field, validation, raising the version
│   └── tiers-and-selection.md    # Tiers, selection rules, replacement, checks
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
src/
├── primitives/
│   ├── registry.ts              # CHANGE: VOCABULARY_VERSION; Tier type; `tier` on every
│   │                            #         entry; `replacedBy` on PrimitiveDef
│   └── selector.ts              # CHANGE: tier rules; selectDetailed with named primitives;
│                                #         core algorithm takes primitives and kits as inputs
├── specValidator.ts             # CHANGE: validate and stamp `vocabulary`
├── specInterpreter.ts           # CHANGE: AnimSpec.vocabulary (type only; not read)
└── index.ts                     # CHANGE: export VOCABULARY_VERSION, Tier, selectDetailed,
                                 #         KIT_NAMES

scripts/
├── vocabulary-record.ts         # NEW: `npm run vocab:record`; writes the record and
│                                #      VOCABULARY.md; refuses to overwrite a version
├── verify-registry.ts           # CHANGE: run the rules, the fixtures, the sweeps, the
│                                #         record and freshness checks
├── verify-spec-validator.ts     # CHANGE: version cases
├── lib/
│   └── vocabularyRules.ts       # NEW: tier rules, snapshot and hash, record comparison,
│                                #      VOCABULARY.md rendering; pure functions
└── fixtures/
    └── tierFixtures.ts          # NEW: one fixture per rule violation, and the
                                 #      replacement fixture

golden/
└── vocabulary.json              # NEW: version entries and the current snapshot

VOCABULARY.md                    # NEW, generated: version, history, tier of each primitive
package.json                     # CHANGE: add the vocab:record script
README.md                        # CHANGE: version and tiers, link to VOCABULARY.md
specs/ROADMAP.md                 # CHANGE: status of 003
.specify/memory/constitution.md  # CHANGE: MINOR at the end (two gate-table rows)
```

**Structure Decision**: Keep the single-project layout. No new directory. The record sits
in `golden/` beside the other committed reference data; the generated document sits at the
root where a reader looks first.

## Design Notes

**Order of work.** Each step leaves `npm run verify` passing:

1. Add the version constant, the `vocabulary` field and its validation (US1). Nothing else
   depends on tiers yet.
2. Add `tier` to every entry with the initial assignment, and the tier rules with their
   fixtures (parts of US2 and US4). Selection is not changed yet, so its output is the same.
3. Apply tiers in selection, add named primitives and `selectDetailed`, and add the sweeps
   (US2). This is the one step that changes what callers get back.
4. Add the replacement record, its rules and the replacement fixture (US3).
5. Add the vocabulary record, `vocab:record`, the staleness check and `VOCABULARY.md` (US4).
   Record version 1.
6. Documentation, roadmap, and the constitution amendment.

**Version 1 is recorded last**, in step 5, so that everything this feature adds to the
registry (tiers, `replacedBy`) is part of version 1 and not a rise to 2.

**Selection is the only behaviour change a caller sees.** Steps 1, 2, 4 and 5 add fields and
checks. Step 3 changes which primitives the same kit, breadth and seed return. It is called
out in the README and in the note for the private product.

**What the checks cannot reach** is recorded in [research.md](research.md) R8: the validator
and interpreter look primitives up in the real registry, which ships no contrib or legacy
primitive. That path is covered by the fixture at the per-primitive level and by a static
check that neither file reads tiers.

## Complexity Tracking

No violations.
