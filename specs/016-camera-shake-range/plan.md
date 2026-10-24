# Implementation Plan: Camera Shake and a Wider Camera Range

**Branch**: `feature/016-camera-shake` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-camera-shake-range/spec.md`

## Summary

Extend spec 014's camera with an optional, seeded, closed-form shake and a wider keyframe
range, without moving any existing frame.

- **Shake**: `camera.shake = { amp, freq }`; two sines per axis at incommensurate rates with
  seeded phases, in frame pixels, scaled by `depth` under parallax ([research.md](research.md)
  R2, R3).
- **Range**: keyframe `x`/`y` clamp widens from 0..1 to -1..2 (R5).
- **Checks**: validator cases, determinism checks, and the first camera reference cases (R6).
- **Governance**: constitution 2.16.0 (MINOR, a format change); 014's contract and the user
  guide updated (R7).

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**: New reference cases in `golden/arm64/` and `golden/x64/`, with `golden/CHANGES.md` rows.

**Testing**: The existing gate scripts chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with an offline verification harness

**Performance Goals**: The shake adds a few arithmetic operations and one translation per
layer; the composition budget gate (12,000 ops, 200 ms) is unaffected.

**Constraints**: No existing reference hash moves. Frames stay a pure function of spec,
signal and seed. Verify stays offline.

**Scale/Scope**: About 4 source files changed (`specInterpreter.ts`, `specValidator.ts`,
`registry.ts` schema, `index.ts` types if exported), 3 check/case files, docs. 9 reference
cases added per set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 2.15.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | The shake is closed-form in `frame.t` and the seed (via `mulberry32`/`mixSeed`); no ambient input. Without a shake the transform calls are unchanged, so existing hashes cannot move. |
| II. Single source | Pass | The camera grammar stays in the validator and interpreter with the schema in the registry, as 014 set it. |
| III. Pure, palette-only | Pass | No primitive changes. |
| IV. Untrusted input | Pass | Malformed shake dropped and reported; values clamped; the camera survives a bad shake. |
| V. Saved specs keep rendering | Exception, justified below | Validated specs are unchanged. An unvalidated spec with a keyframe outside 0..1 renders at its stated position once validated (clarified, FR-012). Recorded in Complexity Tracking and the changelog. |
| VI. One offline verify | Pass | New checks live in the existing validator and determinism gates. |
| VII. Boundaries | Pass | No new responsibility (the camera is already in the format). A format change: "The format" entry and the camera gate row are amended in the same change (MINOR, 2.16.0), as for 013–015. |

**Gates touched**: validator and determinism gates (new cases); reference sets (new cases).

**Golden hashes**: none of the existing 279 may move; 9 added per set.

**Post-design re-check**: unchanged. One recorded exception to Principle V (Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/016-camera-shake-range/
├── plan.md
├── research.md            # R1–R7
├── data-model.md
├── quickstart.md
├── contracts/
│   └── camera-shake.md    # amends 014's contracts/camera.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── specInterpreter.ts     # CHANGE: CameraSpec.shake; shake offset in the camera transform
├── specValidator.ts       # CHANGE: sanitizeCamera — shake validation; x/y clamp -1..2
└── primitives/registry.ts # CHANGE: camera schema — shake; x/y range

scripts/
├── verify-spec-validator.ts  # CHANGE: range and malformed-shake cases
├── verify-determinism.ts     # CHANGE: shake determinism, chunk, seed, amp 0, depth checks
└── lib/goldenHashes.ts       # CHANGE: camera case table (3 cases × 3 frames)

golden/arm64, golden/x64      # NEW cases; golden/CHANGES.md rows
specs/014-camera/contracts/camera.md  # CHANGE: shake and range
docs/user-guide.md            # CHANGE: camera section
.specify/memory/constitution.md       # CHANGE: 2.16.0
CHANGELOG.md                  # CHANGE (at release): the shake, the range, the FR-012 change
```

**Structure Decision**: single project; no new files under `src/`.

## Design Notes

**Order of work**: range (validator + schema) first, which moves nothing; then the shake in
the validator, then the interpreter; then checks; then reference cases; then documents and
the amendment. Verify stays green after each step.

**Byte-identity guard**: the shake branch is entered only when `shake` exists and `amp > 0`.
The no-shake path keeps today's exact `translate(w/2, h/2)` call.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Principle V: a spec stored unvalidated, with a camera keyframe `x`/`y` outside 0..1, draws differently once validated by 0.5.0 (FR-012) | The clamp lives only in validation; widening it is the feature. Validated specs already hold clamped values, so only raw, unvalidated specs are affected, and the docs tell hosts to store the validated form. The maintainer chose this in clarification (2026-10-23). | An opt-in field enabling -1..2 keeps Principle V strictly but adds a permanent flag to the format for a case the docs already discourage; keeping 0..1 fails #111. The change is listed in `CHANGELOG.md`. |
