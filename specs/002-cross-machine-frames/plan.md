# Implementation Plan: Reference Frames Match on Every Machine

**Branch**: `002-cross-machine-frames` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-cross-machine-frames/spec.md`

**Note**: This feature starts after `001-primitive-vetting-gates` lands; the paths
below assume 001's files exist.

## Summary

Make the determinism promise true and checkable: byte-identical frames on machines of the same
processor type, and within 8 out of 255 per channel across types.

- **Fonts**: three fonts ship inside the library as data (DejaVu Sans Mono by default,
  JetBrains Mono, IBM Plex Mono). A spec may name one. No text is drawn with a machine font.
- **Reference sets**: one per processor type (`arm64`, `x64`), each holding hashes and the
  frames as images. The verify command picks the set for the machine it runs on.
- **Cross-type check**: every run compares local renders against the other type's stored
  frames and fails above the tolerance.
- **Refresh**: one command renders natively and, in a container, for the other processor
  type, then replaces both sets together or neither.
- **Promise**: README and constitution Principle I are rewritten to say what is guaranteed.

Decisions and evidence are in [research.md](research.md) and
[investigation.md](investigation.md).

## Technical Context

**Language/Version**: TypeScript 5.9 in `strict` mode, ES modules, run with `tsx`; Node.js 22
or later

**Primary Dependencies**: `@napi-rs/canvas` 1.0.9 (runtime, unchanged). No dependency is
added. Docker is needed by maintainers for the refresh command only.

**Storage**: Files in the repository: `golden/<type>/hashes.json` and
`golden/<type>/frames/*.png` per processor type; font files under `assets/fonts/`; generated
font data modules under `src/fonts/`

**Testing**: The existing gate scripts under `scripts/`, chained by `npm run verify`. No test
framework.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux (glibc). Windows and other
processor types are out of scope and reported as unsupported.

**Project Type**: Library with an offline verification harness

**Performance Goals**: `npm run verify` under 60 s locally; automated build under two
minutes (today 14 to 17 s); refresh of both sets under five minutes.

**Constraints**: Verify stays offline. Non-text primitives stay byte-identical on arm64.
Reference sets are replaced together or not at all. One CI workflow with one job.

**Scale/Scope**: About 150 reference cases per set after this feature; 2 sets; 3 fonts adding
about 0.8 MB of font data (about 1.05 MB as source). About 10 source files changed, 12 added,
plus about 290 reference images.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Constitution 2.0.0 (2026-10-01) states the promise this feature implements: byte-identical per processor type, within 8 of 255 across types, shipped fonts only, one reference set per type. This feature closes the gaps that amendment lists as tracked debt. |
| II. Registry is the single source of truth | Pass | Primitives still come only from the registry. Constitution 2.0.0 allows a spec-level option such as the font choice its own single list; the schema's font choices are generated from it. |
| III. Pure, palette-only, CPU-only primitives | Pass | Fonts are embedded data registered when the library loads, so drawing still performs no file access. |
| IV. Specs are untrusted input | Pass | The new `font` field is validated against the shipped list; an unknown name falls back to the default and is reported. |
| V. Saved specs keep rendering | Pass | Pre-release clause (1.1.0) applies: the five text primitives change appearance, intended and recorded. The format change is additive; specs without `font` use the default. |
| VI. One offline verify command | Pass | Verify stays one offline command. The refresh command needs Docker, but it is not part of verify. CI stays one workflow, one job. |
| Scope and boundaries | Pass, with a legal note | No runtime dependency added. Three fonts ship under their own licences (Bitstream Vera for DejaVu; SIL OFL 1.1 for the other two); they go into `NOTICE` and into the pending legal review. |

**Amendments**: the MAJOR amendment to 2.0.0 was made on 2026-10-01, as its own step, before
implementation. This feature makes one further PATCH amendment at the end (task T037): the
three gate-table rows added as Planned become Enforced, and the transitional paragraph in
Principle I is removed.

**Post-design re-check**: unchanged. No violation.

## Project Structure

### Documentation (this feature)

```text
specs/002-cross-machine-frames/
├── plan.md              # This file
├── investigation.md     # Evidence gathered before and during planning
├── research.md          # Phase 0: decisions
├── data-model.md        # Phase 1: reference sets, fonts, font choice
├── quickstart.md        # Phase 1: how to validate the feature end to end
├── contracts/
│   ├── reference-frames.md   # Verify and refresh behaviour, layout on disk
│   └── fonts.md              # Shipped fonts and the spec's font choice
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
assets/fonts/                    # NEW: the three .ttf files, their licence texts, and a
                                 #      README giving each file's source, version and SHA-256

src/
├── fonts/
│   ├── index.ts                 # NEW: font list, default, registration on load
│   ├── dejavuSansMono.ts        # NEW, generated: font bytes as base64
│   ├── jetbrainsMono.ts         # NEW, generated
│   └── ibmPlexMono.ts           # NEW, generated
├── primitives/registry.ts       # CHANGE: text primitives use the context's font;
│                                #         JSON schema lists the font choices
├── specInterpreter.ts           # CHANGE: AnimSpec.font; resolves it into the draw context
├── specValidator.ts             # CHANGE: validate `font`, fall back and report
└── index.ts                     # CHANGE: export the font list and its types

scripts/
├── generate-fonts.ts            # NEW: writes src/fonts/*.ts; freshness check
├── golden-update.ts             # NEW: refresh both sets (native + container), atomically
├── verify-determinism.ts        # CHANGE: per-type exact check, cross-type tolerance check,
│                                #         every mismatch listed, font-literal rule
└── lib/
    ├── goldenHashes.ts          # CHANGE: validated default layers, per-font text cases,
    │                            #         two maximum-layer composites
    └── referenceSets.ts         # NEW: processor type, reading and writing sets, PNG frames,
                                 #      pixel comparison

golden/
├── arm64/hashes.json            # MOVED from golden/hashes.json, then re-recorded
├── arm64/frames/*.png           # NEW
├── x64/hashes.json              # NEW
├── x64/frames/*.png             # NEW
└── CHANGES.md                   # CHANGE: entries for this feature

package.json                     # CHANGE: golden:update, fonts:generate
NOTICE                           # CHANGE: the three fonts and their licences
README.md                        # CHANGE: the promise, fonts, refresh instructions
.specify/memory/constitution.md  # CHANGE: PATCH at the end (gate-table rows to Enforced)
```

**Structure Decision**: Keep the single-project layout. Font files are assets, not source, so
they get a new top-level `assets/fonts/`; everything else lands in existing directories.

## Design Notes

**Order of work matters.** Because several things move reference frames, they are done one at
a time so each change is attributable:

1. Split the existing set by processor type and add stored frames, with no rendering change.
   The arm64 hashes must not move.
2. Record the x64 set for the first time. Non-text cases should now pass on the build
   machine; text cases cannot yet, because machine fonts are still in use.
3. Correct the two reference cases that skip defaults (`led`, `sprite`).
4. Switch text to the shipped default font. Only text cases may move.
5. Add the font choice, the per-font cases and the maximum-layer cases (additive).

**The build goes green after step 4.** After step 2 the non-text cases already pass on the
real build machine, which is early evidence that the per-type design is right; the text cases
follow once the shipped font replaces machine fonts.

**First build after step 4 confirms the one open assumption**: that text renders identically
on the real x64 machine and the emulated one. If it does not, stop and return to the spec.

**What is and is not exact** is specified in
[contracts/reference-frames.md](contracts/reference-frames.md). Font behaviour is in
[contracts/fonts.md](contracts/fonts.md).

## Complexity Tracking

No violations.
