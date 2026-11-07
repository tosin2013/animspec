# Implementation Plan: Stickman, the Default Avatar

**Branch**: `feature/030-stickman-avatar` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

## Summary

`stickman` is one new core registry entry, in the `sprite` category. Its draw function:

1. Resolves each figure's placement:
   - from the params, the crowd arrangement, or `coords[index + i]`;
   - a seeded phase offset and size for each figure in a crowd;
   - `travel`, and the drive (bob or beat hop).
2. Poses a 10-joint skeleton from the action's closed-form angle function at the figure's local time. For a target action, it solves the arm and head angles towards `targetX`/`targetY`.
3. Draws the figures in one of two ways:
   - **Line styles** (classic, bold, outline, chibi, joints) use canvas strokes: about 12 operations per figure.
   - **The pixel style, or any style under `pixelMode`**, rasterises every figure of the layer into one off-screen bitmap with whole-pixel square brushes and a pixel disc for the head. It then draws the bitmap once. This is the spec 026 ring-raster pattern, and it keeps any crowd at one draw operation.
4. Draws at most one speech bubble with the frame's label.

The skeleton, poses and tempos come from the Stickman Lab preview. The vocabulary goes from 22 to 23, and the data-viz, minimal and arcade kits gain `stickman`. There is no format change and no constitution change. See [research.md](research.md) R1–R11.

## Technical Context

- **Language/Version**: TypeScript, strict mode, ES modules; Node.js 22 or later.
- **Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.
- **Storage**:
  - new reference cases in both sets (x64 via Docker);
  - a gallery thumbnail, a loop and a demo;
  - three showcase loops;
  - vocabulary record 23.
- **Testing**: the existing gates through `npm run verify`, plus new determinism checks and a composition-budget case.
- **Target Platform**: Node.js on arm64 and x64, macOS and Linux.
- **Project Type**: a library with an offline verification harness.
- **Performance Goals**:
  - the default layer stays within the 3,000-operation and 50 ms primitive budget;
  - 12 layers of 12 figures stay within the 12,000-operation and 200 ms composition budget.
- **Constraints**:
  - no existing hash moves;
  - every frame is a pure function of spec, signal and seed;
  - no threshold changes.
- **Scale/Scope**:
  - one registry entry and three kit lists in `src/primitives/selector.ts`;
  - five script files;
  - the user guide and ROADMAP.

## Constitution Check (6.3.0)

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Poses are closed-form functions of time. Crowd variation comes from `mulberry32(mixSeed(layerSeed, i))`. Nothing carries over between frames. Line strokes antialias within the cross-type tolerance like every line primitive; the pixel path is exact. |
| II. Single source | Pass | The params, descriptions and kits live in the registry and the selector. |
| III. Palette roles | Pass | Figures draw only in fg, accent or the second tone. The bubble uses bg and fg. The pixel raster writes palette RGB only. |
| IV. Untrusted input | Pass | Labels are cut to 40 characters, coordinates are clamped, enums reset to their defaults, and numbers are clamped. |
| V. Saved specs keep rendering | Pass | This is a new primitive. Adding it to kits changes what a model is offered, not any frame. |
| VI. One offline verify | Pass | Existing gates, plus new checks. |
| VII. Boundaries | Pass | No boundary change. |

**Post-design re-check**: unchanged.

## Project Structure

```text
specs/030-stickman-avatar/  plan.md, research.md, data-model.md, quickstart.md,
                            contracts/stickman.md, checklists/requirements.md, tasks.md

src/primitives/registry.ts     # stickman entry: params, POSES table, solveTarget, crowd
                               #   placement, line and pixel renderers, speech bubble;
                               #   VOCABULARY_VERSION 23
src/primitives/selector.ts     # KITS: data-viz, minimal, arcade gain stickman
scripts/lib/goldenHashes.ts    # STICKMAN_CASES (actions, styles, target, speech, coords, crowds)
scripts/verify-determinism.ts  # actions animate and differ, targets, speech, coords, drive,
                               #   crowds, pixel exactness, profiles
scripts/verify-gates.ts        # composition case: 12 crowd layers of 12
scripts/lib/demos.ts           # stickman gallery demo
scripts/lib/showcase.ts        # stickman-presenter, stickman-fight, stickman-dance
docs/user-guide.md, specs/ROADMAP.md
```

## Complexity Tracking

None.
