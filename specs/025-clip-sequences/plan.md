# Implementation Plan: Clip Sequences

**Branch**: `feature/025-clip-sequences` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/025-clip-sequences/spec.md`

## Summary

A spec-level `sequence` of clips. Each has an absolute frame range, its own layers and camera,
and an optional transition in. Rendering works like this:
- **Shared core**: `drawSpec`'s body becomes a private `renderShot`. Single-shot specs call it
  exactly as today, so no hash moves.
- **Selection**: a sequence frame picks its clip and passes clip-relative index and time, with
  the absolute signal and a per-clip seed.
- **Transitions**:
  - **wipe, iris and fade**: two shots are rendered off-screen and combined per pixel in
    integer RGBA, so they are exact on both processor types and wipe and iris pixels are pure.
  - **cut**: a plain switch.
- **Transparency**: one transparent lift runs at the end.

Validation reuses today's layer pipeline per clip. Constitution 6.1.0 (MINOR) records that
transitions are composition, not post-process. See [research.md](research.md) R1–R7.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged)

**Storage**: 18 new reference cases per set, with `golden/CHANGES.md` rows; one showcase loop.

**Testing**: The existing gates chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library + CLI with an offline verification harness

**Performance Goals**:
- A transition frame is two shots plus one RGBA pass, within the composition budget (200 ms
  at 1080p), checked by a new composition case.
- Non-transition frames cost one shot, as today.

**Constraints**: No existing hash moves. No gate edits. Verify stays offline.

**Scale/Scope**:
- `src/specInterpreter.ts` (the `renderShot` extraction, sequence render, transitions).
- `src/specValidator.ts` (the `sanitizeLayerList` extraction, `sanitizeSequence`).
- The registry schema, CLI manifest, `goldenHashes.ts`, `showcase.ts`, the gates, the
  constitution and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 6.0.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | A pure function of the absolute frame index. Clip time is derived from `index` and `t`. Transitions are integer RGBA arithmetic. Order and chunk checks are added. |
| II. Single source | Pass | Clip layers use the same registry, sanitizer and plugin and asset rules. |
| III. Palette roles | Pass | Shots are palette-legal. Wipe and iris pixels are one shot's. A fade's pixels are mixes of palette colours, which the palette gate already treats as legal. |
| IV. Untrusted input | Pass | Malformed sequences are dropped and reported. The rest renders. |
| V. Saved specs keep rendering | Pass | Without `sequence`, the path is `renderShot` with identical calls. |
| VI. One offline verify | Pass | Existing gates. |
| VII. Boundaries | Pass, with a contract change | "The format" gains `sequence` (MINOR 6.1.0). The note keeps post-process effects out of scope. |

**Post-design re-check**: unchanged. No violations.

## Project Structure

```text
specs/025-clip-sequences/  plan.md, research.md, data-model.md, quickstart.md,
                           contracts/clip-sequences.md, checklists/requirements.md, tasks.md
src/specInterpreter.ts        # AnimSpec.sequence; renderShot extraction; clip selection; transitions
src/specValidator.ts          # sanitizeLayerList extraction; sanitizeSequence; layers/camera ignored beside sequence
src/primitives/registry.ts    # buildJsonSchema sequence
cli/render.ts                 # manifest clips
scripts/lib/goldenHashes.ts   # SEQUENCE_CASES
scripts/lib/showcase.ts       # shot-list
scripts/verify-*.ts           # determinism, validator, gates (composition case), cli
.specify/memory/constitution.md (6.1.0), golden/*, showcase/, docs/*, CHANGELOG.md, specs/ROADMAP.md
```

**Structure Decision**: no new files outside the feature folder.

## Design Notes

**Order of work**:
1. The `renderShot` extraction. Verify must be byte-identical.
2. The `sanitizeLayerList` extraction. Validator messages must be identical.
3. `sanitizeSequence` and the schema.
4. Sequence render (clip selection, time, seed).
5. Transitions.
6. Checks.
7. The composition-budget case.
8. References.
9. The showcase, checked from pixels.
10. The constitution and docs.
11. Verify, at most 3 failed attempts.
12. The PR.

The vocabulary is unchanged: this is a format change, not a vocabulary change.

## Complexity Tracking

No violations.
