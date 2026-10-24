# Implementation Plan: Transparent Background

**Branch**: `feature/017-transparent-background` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-transparent-background/spec.md`

## Summary

Add `background: "transparent"` with an optional `ink: "light" | "dark"`. A transparent frame
is drawn exactly as today on the matching solid background (black for light ink, white for
dark), then the background is lifted out pixel by pixel, so the frame laid over that
background gives back the solid render ([research.md](research.md) R2). No primitive
changes; the command line already carries alpha.

- **Format**: validator, interpreter type and schema (R1, R5).
- **Frame**: palette from the ink (R3), one lift pass at the end of `drawSpec` (R2).
- **Checks**: a transparency gate over every primitive, determinism, validator and CLI
  checks, 9 reference cases per set, and an alpha-aware cross-type comparison (R7).
- **Governance**: constitution 3.1.0 (MINOR, a format change) (R8).

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged; `getImageData`/`putImageData` and RGBA
PNG encoding are already used). No dependency added.

**Storage**: New reference cases in `golden/arm64/` and `golden/x64/`, with `golden/CHANGES.md` rows.

**Testing**: The existing gate scripts chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with a command-line renderer and an offline verification harness

**Performance Goals**: The lift costs about 10 ms per 1080p frame (prototype), only on
transparent specs. The composition budget gate's cases are solid and unaffected.

**Constraints**: No existing reference hash moves. Frames stay a pure function of spec,
signal and seed. Verify stays offline.

**Scale/Scope**: 3 source files (`specInterpreter.ts`, `specValidator.ts`, `registry.ts`
schema), 1 CLI check, 4 check/case files, docs. 9 reference cases per set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 2.16.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass (after 3.0.0) | The lift is integer arithmetic on the frame's own pixels; the canvas round trip is deterministic. Solid specs never enter the lift, so existing hashes cannot move. Raw cross-type colour of nearly invisible accent pixels exceeded 8, so Principle I was amended in its own commit (3.0.0) to measure non-opaque pixels as seen (R7). |
| II. Single source | Pass | The format stays in the validator and interpreter, the schema in the registry. |
| III. Pure, palette-only | Pass | Primitives receive an ordinary solid palette and are unchanged; transparency is applied around them. |
| IV. Untrusted input | Pass | A bad or misplaced `ink` is reported and corrected or dropped; the spec still renders. |
| V. Saved specs keep rendering | Exception, justified below | Validated specs are unchanged. An unvalidated spec that already said `"transparent"` drew on black and now draws transparent (FR-013). |
| VI. One offline verify | Pass | New checks live in the existing gates. |
| VII. Boundaries | Pass | No new responsibility (the background is in the format). A format change: "The format" entry and a Quality Gates row are amended in the same change (MINOR, 3.1.0). |

**Gates touched**: vetting gates (transparency over every primitive), validator,
determinism and CLI gates; reference sets (new cases); cross-type comparison (alpha-aware).

**Golden hashes**: none of the existing 288 may move; 9 added per set.

**Post-design re-check**: unchanged. One recorded exception to Principle V (Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/017-transparent-background/
├── plan.md
├── research.md            # R1–R8
├── data-model.md
├── quickstart.md
├── contracts/
│   └── transparent-background.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── specInterpreter.ts     # CHANGE: AnimSpec background/ink types; palette from ink; the lift
├── specValidator.ts       # CHANGE: background "transparent"; ink validation
└── primitives/registry.ts # CHANGE: schema background enum and ink

scripts/
├── verify-gates.ts           # CHANGE: transparency gate over every primitive, both inks
├── verify-spec-validator.ts  # CHANGE: background and ink cases
├── verify-determinism.ts     # CHANGE: alpha, opacity, chunk and repeat checks
├── verify-cli.ts             # CHANGE: transparent --raw equals the library; --png has alpha
├── lib/referenceSets.ts      # CHANGE: comparePixels compares premultiplied colour and alpha
└── lib/goldenHashes.ts       # CHANGE: background case table (3 cases × 3 frames)

golden/arm64, golden/x64      # NEW cases; golden/CHANGES.md rows
docs/user-guide.md            # CHANGE: background table and a transparency section
.specify/memory/constitution.md       # CHANGE: 3.1.0
CHANGELOG.md                  # CHANGE: Unreleased entry, including FR-013
```

**Structure Decision**: single project; no new files under `src/` or `cli/`.

## Design Notes

**Order of work**: format (types, validator, schema), which moves nothing; then the palette
and the lift in `drawSpec`; then the comparison change; then checks; then reference cases;
then documents and the amendment. Verify stays green after each step.

**Byte-identity guard**: the lift runs only when `background === "transparent"`. The solid
path keeps today's exact calls.

**Why not clear to alpha 0**: see research.md R2; it would require changing the 11 places
primitives paint the background colour and would leave background-derived greys opaque.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Principle V: a spec stored unvalidated with `background: "transparent"` drew on black before 0.5.0 and now draws transparent (FR-013) | The interpreter has always drawn any non-`"white"` value on black; giving `"transparent"` its meaning is the feature. Validated specs hold `"black"` and are unchanged, and the docs tell hosts to store the validated form. | A differently named value would avoid it, but `"transparent"` is the name #100 and every model will reach for. The change is listed in `CHANGELOG.md`. |
