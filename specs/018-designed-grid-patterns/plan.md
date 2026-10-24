# Implementation Plan: Designed Grid Patterns

**Branch**: `feature/018-designed-grid-patterns` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-designed-grid-patterns/spec.md`

## Summary

Two string params on `grid` and `checker`:

- **`pattern`**: one letter per cell, rows split by `/`. `.` off, `#` fg, `a` accent, `~`
  spectrum.
- **`breaks`**: `col,row` entries that rotate or shift single cells.

Both default to `""`, so every existing frame stays on today's code path. One pure parser per
grammar is shared by `draw` and the validator, so a raw spec renders like its validated form.
Under `solid`, rotated cells are filled scanline by scanline, so every pixel stays bg, fg or
accent. Vocabulary 13. See [research.md](research.md) R1–R8.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**:
- Vocabulary record `golden/vocabulary.json` (version 13) and `VOCABULARY.md`.
- 12 new reference cases per set in `golden/arm64/` and `golden/x64/`, with `golden/CHANGES.md` rows.
- Showcase additions.

**Testing**: The existing gate scripts chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with an offline verification harness

**Performance Goals**:
- A 64 × 64 pattern draws at most 4,096 cell fills, below what `cols`/`rows` up to 200 already
  allow.
- Default-layer budgets are unchanged, because the default pattern is empty.
- The probe with the declared `example` stays within the per-primitive budget (3,000 ops).

**Constraints**:
- No existing reference hash moves.
- Pure function of spec, signal and seed.
- Verify stays offline.

**Scale/Scope**:
- `src/primitives/registry.ts`: two primitives, the parsers and the `example` field.
- `src/specValidator.ts`: reporting.
- Five check and generator files.
- Docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 3.2.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Parsing and drawing are pure; breaks are keyed by cell and drawn in row-major order, so entry order cannot matter. No randomness. |
| II. Single source | Pass | Both params are declared in the registry entries (type `string`, `maxLen`, default `""`, and an `example`); the prompt (via the descriptions), the record and the gates follow from them. No second list. |
| III. Palette-only | Pass | Patterned cells use bg/fg/accent only; `b` is reserved, not drawn, until spec 019 amends this principle. |
| IV. Untrusted input | Pass | Unknown letters, ragged rows, oversized patterns and bad breaks are read as off, cut or ignored, and reported; the layer always renders. |
| V. Saved specs keep rendering | Pass | Defaults are empty and take today's path. The validator does not rewrite the strings, so a raw spec and its validated form render the same. No exception needed. |
| VI. One offline verify | Pass | All checks are in the existing gates. |
| VII. Boundaries | Pass | A vocabulary change on existing primitives, no boundary change, no amendment (R8). |

**Gates touched**:
- Validator, determinism, registry (vocabulary record) and vetting gates. The vetting gates
  gain probes through `example`.
- The order checks (`nonDefaultOverrides`).
- Reference sets: 12 cases added per set.

**Golden hashes**: none of the existing 306 may move.

**Post-design re-check**: unchanged; no violation.

## Project Structure

### Documentation (this feature)

```text
specs/018-designed-grid-patterns/
├── plan.md
├── research.md            # R1–R8
├── data-model.md
├── quickstart.md
├── contracts/
│   └── pattern-and-breaks.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── primitives/registry.ts  # CHANGE: string ParamSpec `example`; parsePattern, parseBreaks;
│                           #   grid and checker params, descriptions and draw; VOCABULARY_VERSION 13
└── specValidator.ts        # CHANGE: report pattern and breaks problems

scripts/
├── lib/gateKit.ts            # CHANGE: probeLayers uses a string param's `example`
├── lib/goldenHashes.ts       # CHANGE: ParamSpecLike example; nonDefaultOverrides uses it; PATTERN_CASES
├── lib/showcase.ts           # CHANGE: quilt and break-it-once cases
├── verify-spec-validator.ts  # CHANGE: pattern and breaks cases
└── verify-determinism.ts     # CHANGE: quilt pixels, all-~ equivalence, breaks checks

golden/vocabulary.json, VOCABULARY.md   # vocab:record (13)
golden/arm64, golden/x64                # 12 new cases; golden/CHANGES.md rows
docs/user-guide.md, CHANGELOG.md        # a patterns section; Unreleased entry
```

**Structure Decision**: single project; no new files under `src/`.

## Design Notes

**Order of work**:
1. The `example` field and the probe change. It moves nothing, because no param has an
   example yet.
2. The parsers.
3. The grid pattern draw (non-solid, then solid).
4. Checker.
5. Breaks.
6. Validator reporting.
7. Vocabulary 13.
8. Checks.
9. Reference cases.
10. Docs.

Verify stays green after each step.

**Byte-identity guard**: `pattern === ""` and `breaks === ""` take the existing branches with
no change to their canvas calls.

**Budget**: probing the example pattern adds probes to the gates. The example is small (the
7 × 5 quilt), so the budget gate is unaffected in practice; confirm in the vetting gate's budget lines during implementation.

## Complexity Tracking

No violations.
