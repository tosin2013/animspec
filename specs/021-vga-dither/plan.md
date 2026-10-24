# Implementation Plan: VGA Dither Scenes

**Branch**: `feature/021-vga-dither` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-vga-dither/spec.md`

## Summary

#107's look the native way:

- **A `dither` primitive.** It is an ordered Bayer 4 × 4 or 8 × 8 gradient through up to six
  palette roles, in a rectangular region. Its pixels are built off-screen and drawn with one
  unsmoothed `drawImage`, which keeps it inside the 3,000-operation budget with exact stop
  colours.
- **`caption.margin`**, so text fits in a UI bar.
- **`pixelAspect`**: format metadata, recorded in the CLI manifest.
- **A `dos-adventure` showcase loop.**

A `drive` param (default `level`) keeps the default layer signal-driven, as the reactivity
gate requires. Scenery uses `none`. Vocabulary 14, constitution 4.2.0. See
[research.md](research.md) R1–R8.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**:
- Vocabulary record version 14 and `VOCABULARY.md`.
- Reference cases: 3 default plus 5 named, 18 per set as recorded (x64 via Docker), with
  `golden/CHANGES.md` rows.
- Gallery and loop for `dither`, the showcase loop, and site files.

**Testing**: The existing gates chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with an offline verification harness

**Performance Goals**:
- 1 counted operation per band.
- At most 50 ms per 1080p frame for the default layer, confirmed in the budget gate output.

**Constraints**:
- No existing hash moves.
- No gate or threshold change.
- Verify stays offline.

**Scale/Scope**:
- `src/primitives/registry.ts`, `src/specValidator.ts`, `src/specInterpreter.ts` (type only),
  `cli/render.ts`.
- 5 script files.
- Constitution, docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 4.1.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | A pure function of params, frame and palette. Exact byte copy. Matrix indexed from the frame origin. |
| II. Single source | Pass | The primitive and the params are in the registry. Prompt, schema and record follow from it. |
| III. Palette roles | Pass | Stops are built-ins, roles, or fixed bg–fg greys. Monochrome by default. Exact colours, no blending. |
| IV. Untrusted input | Pass | `colors` is parsed leniently and problems are reported. `pixelAspect` is clamped by being dropped and reported. |
| V. Saved specs keep rendering | Pass | Additions only. The `caption.margin` default is byte-identical. |
| VI. One offline verify | Pass | Existing gates. |
| VII. Boundaries | Pass, with a contract change | `pixelAspect` joins "The format" (MINOR 4.2.0). Post-process effects stay out of scope: a layer draws only its own region. |

**Gate finding**: the reactivity gate requires a signal-driven default layer. This is resolved
with `drive` (R3), with no gate change.

**Post-design re-check**: unchanged. No violations.

## Project Structure

```text
specs/021-vga-dither/   plan.md, research.md, data-model.md, quickstart.md,
                        contracts/dither-and-aspect.md, checklists/requirements.md, tasks.md

src/primitives/registry.ts  # dither entry (+ Bayer, colour parse), caption.margin, schema pixelAspect, VOCABULARY_VERSION 14
src/specValidator.ts        # pixelAspect; dither colors reporting
src/specInterpreter.ts      # AnimSpec.pixelAspect (type only)
cli/render.ts               # manifest pixelAspect
scripts/lib/goldenHashes.ts # DITHER_CASES, caption:margin-0
scripts/lib/showcase.ts     # label field; dos-adventure
scripts/verify-determinism.ts, scripts/verify-spec-validator.ts, scripts/verify-cli.ts
.specify/memory/constitution.md (4.2.0), golden/*, gallery/, loops/, showcase/, docs/*, CHANGELOG.md, specs/ROADMAP.md
```

**Structure Decision**: single project; no new files under `src/`.

## Design Notes

**Order of work** (verify green after each step):
1. `caption.margin`, with a byte-identity check.
2. `pixelAspect`: validator, schema, type, manifest.
3. The `dither` primitive.
4. Vocabulary 14 and `vocab:record`.
5. Checks.
6. References (`golden:update`).
7. Gallery and loops.
8. Showcase.
9. Constitution, docs.
10. Verify, at most 3 failed attempts.
11. PR.

## Complexity Tracking

No violations.
