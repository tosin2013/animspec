# Implementation Plan: Sprite Sheets

**Branch**: `feature/023-sprite-sheets` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/023-sprite-sheets/spec.md`

## Summary

Five params on `image` (`sheetCols`, `sheetRows`, `frames`, `fps`, `frameStart`) select one
cell of a sprite sheet per frame, as a closed form of the frame time. The existing source rect
then applies inside that cell, so flip, fit, wrap, scroll and the colour modes all work per
frame with no further change.

The defaults reproduce today's expressions exactly. Vocabulary 16, no amendment. See
[research.md](research.md) R1–R4.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged)

**Storage**:
- 9 new reference cases per set, with `golden/CHANGES.md` rows.
- One showcase loop.
- The vocabulary record (16).

**Testing**: The existing gates chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library + CLI with an offline verification harness

**Performance Goals**: No new drawing operations. Palette mode maps each frame once (memoised).

**Constraints**: No existing hash moves. No gate edits. Verify stays offline.

**Scale/Scope**:
- One registry entry (`image`).
- `goldenHashes.ts` (fixture + cases), `showcase.ts`, `verify-determinism.ts`.
- Docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 5.0.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | The frame index is a closed form of `f.t`. Seeking is exact and chunks match. |
| II. Single source | Pass | The params are declared on the `image` entry. Prompt, schema and record follow. |
| III. Palette roles | Pass | Colour rules are unchanged. Palette mode maps per frame. |
| IV. Untrusted input | Pass | Bounded numbers, clamped by the existing sanitizer. |
| V. Saved specs keep rendering | Pass | Defaults equal today's expressions (R1). |
| VI. One offline verify | Pass | In-code fixture. |
| VII. Boundaries | Pass | A vocabulary change only. No boundary or format change. |

**Post-design re-check**: unchanged.

## Project Structure

```text
specs/023-sprite-sheets/  plan.md, research.md, data-model.md, quickstart.md,
                          contracts/sprite-sheets.md, checklists/requirements.md, tasks.md
src/primitives/registry.ts    # image: 5 params + cell selection before the source rect; VOCABULARY_VERSION 16
scripts/lib/goldenHashes.ts   # goldenAssets().sheet; three image:sheet-* cases
scripts/lib/showcase.ts       # sheet-walk loop (in-code sheet)
scripts/verify-determinism.ts # sheet checks
golden/*, gallery is unchanged (default layer), showcase/, docs/*, CHANGELOG.md, specs/ROADMAP.md
```

**Structure Decision**: no new files outside the feature folder.

## Design Notes

**Order of work**:
1. Params and cell selection, then confirm every existing hash is unchanged.
2. The fixture and checks.
3. Vocabulary 16.
4. Cases, then `golden:update`.
5. The showcase, checked with a frame strip of real pixels.
6. Docs.
7. Verify, at most 3 failed attempts.
8. The PR.

## Complexity Tracking

No violations.
