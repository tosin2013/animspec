# Implementation Plan: Pixel Mode and Two-Tone Bars and Rings

**Branch**: `feature/026-pixel-mode` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/026-pixel-mode/spec.md`

## Summary

The spec-level `pixelMode` boolean reaches primitives as a new optional `pixel` flag on
`DrawContext`. The interpreter honours it in two places. In `renderShot`, camera offsets round
to whole pixels and image smoothing is off for the frame. The six listed primitives each take
a pixel-mode branch:

- `bars` and `hbars`: cumulative-rounded edges.
- `rings`: span-rasterised outlines written to an offscreen bitmap and drawn once.
- `emitter`: whole-pixel squares with alpha thresholded at 0.5.
- `particles`: rounded squares.
- `image`: takes the exact path it already uses in palette mode.

`tone2` adds a colour choice to `bars` and `rings` through the existing `secondTone(p)`
helper. Every branch is guarded by the flag or by a non-default param, so no existing frame
moves. Vocabulary 16 → 17. Constitution 6.1.0 → 6.2.0 ("The format" gains `pixelMode`). See
[research.md](research.md) R1–R10.

## Technical Context

**Language/Version**: TypeScript in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**:
- New reference cases in `golden/arm64/` and `golden/x64/` (x64 via Docker), with
  `golden/CHANGES.md` rows.
- One showcase still.
- Vocabulary record 17, `VOCABULARY.md` and site files refreshed.

**Testing**: The existing gate scripts chained by `npm run verify`: validator, registry,
determinism, gates, CLI and package.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with an offline verification harness

**Performance Goals**:
- Pixel-mode `rings` is one `drawImage` per layer, plus O(rows × rings) span writes.
- `bars` and `hbars` keep one fill per bar. `emitter` keeps one fill per particle.
- Every pixel-mode probe stays inside the existing per-primitive and composition budgets.

**Constraints**:
- No existing reference hash moves.
- Pure function of spec, signal and seed.
- Verify stays offline.
- No gate threshold changes.

**Scale/Scope**:
- `src/primitives/registry.ts`, `src/specInterpreter.ts` and `src/specValidator.ts`.
- 4 script files.
- Constitution, user guide and ROADMAP.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 6.1.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Rounding and span rasterisation are pure arithmetic. The `emitter` threshold reads the same closed-form alpha. Twice-render, chunk and cross-type checks are added. |
| II. Single source | Pass | `tone2` is declared in the registry. The schema entry for `pixelMode` lives beside `pixelAspect` in `buildJsonSchema`. |
| III. Palette roles | Pass | Pixel mode removes blending and adds no colour. `tone2` draws only `fg2` or its fixed grey. The ring bitmap is written in palette colours only. |
| IV. Untrusted input | Pass | A non-boolean `pixelMode` is dropped and reported. `tone2` is a clamped enum. |
| V. Saved specs keep rendering | Pass | Every change is behind `pixelMode: true` or a non-default `tone2`. SC-001 is checked by the hash gate. |
| VI. One offline verify | Pass | New checks are added to existing gate scripts. |
| VII. Boundaries | Pass, with a recorded format change | `pixelMode` is a new spec-level field, so "The format" is amended (MINOR, 6.2.0) in this change. No new export, output, dependency or service. |

**Post-design re-check**: unchanged, no violations.

## Project Structure

```text
specs/026-pixel-mode/  plan.md, research.md, data-model.md, quickstart.md,
                       contracts/pixel-mode.md, checklists/requirements.md, tasks.md

src/specInterpreter.ts      # AnimSpec.pixelMode; dctx.pixel; renderShot: rounded camera
                            #   offsets, smoothing off for the frame
src/specValidator.ts        # pixelMode kept or dropped and reported; spread into both spec objects
src/primitives/registry.ts  # DrawContext.pixel; bars/hbars/rings/emitter/particles/image pixel
                            #   branches; ring span raster helper; tone2 on bars and rings;
                            #   schema pixelMode; VOCABULARY_VERSION 17
scripts/lib/goldenHashes.ts # new reference cases (R9)
scripts/verify-determinism.ts  # palette-exactness, tone2 confinement, camera rounding,
                               #   chunk and twice-render checks
scripts/verify-spec-validator.ts  # pixelMode validation checks
scripts/verify-gates.ts     # pixel-mode probes inside the existing budget gate
scripts/lib/showcase.ts     # one print-exact showcase still
.specify/memory/constitution.md  # 6.2.0: "The format" names pixelMode
docs/user-guide.md, specs/ROADMAP.md, CHANGELOG (at release)
golden/{arm64,x64}/, golden/CHANGES.md, golden/vocabulary.json, VOCABULARY.md, docs/ outputs
```

**Structure Decision**: The existing single-library layout. No new module. The ring raster
helper sits next to `paletteMapped` in the registry, because both build an offscreen bitmap in
palette colours.

## Complexity Tracking

None. There are no constitution violations to justify.
