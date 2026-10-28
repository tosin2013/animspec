# Implementation Plan: Arcade HUD

**Branch**: `feature/027-arcade-hud` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/027-arcade-hud/spec.md`

## Summary

Two `contrib` primitives join the registry: `versus-bars` and `hud-score`. Their data come only
from the frame: `versus-bars` reads `coords`, and `hud-score` reads `labels`.
- **`versus-bars`** draws every edge as a whole-pixel `fillRect`. Its angled outer ends are
  per-row steps, so it is palette-exact with or without pixel mode.
- **`hud-score`** places fixed captions and label values with the shipped font.

The showcase gains optional per-case `dims` and `frameData`, so the 384×224 CPS II and
224×288 tate loops can feed data that changes over the loop. Vocabulary 17 → 18. There is no
format or constitution change. See [research.md](research.md) R1–R8.

## Technical Context

**Language/Version**: TypeScript in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**:
- New reference cases in `golden/arm64/` and `golden/x64/` (x64 via Docker), with
  `golden/CHANGES.md` rows.
- Two gallery thumbnails and two gallery loops.
- Two showcase loops.
- Vocabulary record 18.

**Testing**: The existing gates (registry, determinism, vetting, validator) via `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with an offline verification harness

**Performance Goals**:
- `versus-bars`: about 4 × the bar height in pixels of `fillRect`s (≈ 200 at 1080p), under the
  3,000-op primitive budget.
- `hud-score`: at most 8 text draws.

**Constraints**:
- No existing reference hash moves.
- Pure function of spec, signal and seed.
- No gate threshold changes.

**Scale/Scope**:
- `src/primitives/registry.ts`.
- 3 script files: `goldenHashes.ts`, `showcase.ts` and `generate-showcase.ts`, plus the
  determinism checks.
- User guide and ROADMAP.

## Constitution Check

Checked against constitution 6.2.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Closed-form draws from (frame, params). The tail is data, and there is no state across frames. |
| II. Single source | Pass | Params and descriptions live in the registry. Docs are generated from it. |
| III. Palette roles | Pass | bg, fg, accent and the fixed mid grey (`FG2_MONO`, a bg–fg mix). `versus-bars` has no antialiased edges. Text antialiases to mixes of bg and fg, as every text primitive does. |
| IV. Untrusted input | Pass | `coords` are clamped to 0..1, and labels are cut (12 characters; the timer to 3). Labels are drawn as text only. |
| V. Saved specs keep rendering | Pass | New primitives only. |
| VI. One offline verify | Pass | Existing gates plus new checks. |
| VII. Boundaries | Pass | No boundary change. Frame `coords` and `labels` are already part of the contract. |

**Post-design re-check**: unchanged, no violations.

## Project Structure

```text
specs/027-arcade-hud/  plan.md, research.md, data-model.md, quickstart.md,
                       contracts/arcade-hud.md, checklists/requirements.md, tasks.md

src/primitives/registry.ts     # versus-bars, hud-score; VOCABULARY_VERSION 18
scripts/lib/goldenHashes.ts    # HUD_CASES with per-case frame data (coords/labels)
scripts/verify-determinism.ts  # fill/tail lengths, palette exactness, label/drive checks
scripts/lib/showcase.ts        # ShowcaseCase.dims / frameData; cps2-versus, tate-shooter
scripts/generate-showcase.ts   # per-case dims
docs/user-guide.md, specs/ROADMAP.md
golden/, gallery/, loops/, showcase/, docs/ outputs (generated)
```

**Structure Decision**: The existing layout. The showcase additions are optional fields, so the
existing cases are unchanged.

## Complexity Tracking

None.
