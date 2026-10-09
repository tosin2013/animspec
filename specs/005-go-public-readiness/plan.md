# Implementation Plan: Go-Public Readiness

**Branch**: `005-go-public-readiness` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-go-public-readiness/spec.md`

**Note**: No git branch has been created (no branch hook is installed). This feature starts
after `004-publishable-npm-package` is merged (it is).

## Summary

Prepare the repository and community for the public launch: contribution rules and a signed-CLA
gate, a security policy and code of conduct, automatic CI on public pull requests, a passing
secret scan, and a gallery of reference thumbnails — then record the legal review and make the
repository and package public.

No rendering change. No reference frame moves. The only code is the gallery generator and the
CI trigger change; everything else is documentation, configuration, and the recorded legal gate.
Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 / Node.js 22 or later (only for the gallery generator and
CI; the rest is Markdown and repository configuration).

**Primary Dependencies**: none added. The secret scan and CLA sign-up use the platform's built-in
capabilities (or a hosted CLA service); the gallery generator reuses the existing render path and
the PNG encoder in `scripts/lib/referenceSets.ts`.

**Storage**: the gallery images are committed under `gallery/` (generated from the reference
frames); nothing else is persisted.

**Testing**: `npm run verify` is unchanged. The gallery is checked for freshness the same way the
icon and font generators are (generate, commit, check). The CI trigger change is verified by
opening a pull request and observing it run without a manual trigger.

**Target Platform**: GitHub repository + npm registry.

**Project Type**: Library (open-source) with an offline verification harness.

**Performance Goals**: CI stays under two minutes and one workflow, one job. The gallery
generation is a one-off render of 29 thumbnails (a few seconds).

**Constraints**: Verify stays offline and one command. CI stays one workflow, one job,
GitHub-hosted. No outside contribution merges without a signed CLA. A secret scan passes before
the first public push. The name stays `animspec`.

**Scale/Scope**: about 6 new documentation files, 1 issue template, 1 label, 1 CLA
configuration, 1 CI trigger change, 1 gallery generator, and 29 committed thumbnails.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | No rendering change; no reference frame moves. |
| II. Registry is the single source of truth | Pass | The gallery is generated from the registry + reference frames. |
| III. Pure, palette-only, CPU-only primitives | Pass | Untouched. |
| IV. Specs are untrusted input | Pass | Untouched. |
| V. Saved specs keep rendering | Pass | Untouched. |
| VI. One offline verify command | Pass | CI stays one workflow, one job; only its *triggers* change (manual → PR/push). The gallery generator is a maintainer command, not part of `verify`. |
| VII. Explicit boundaries | Pass | The spec carries the six entries and names the boundary change (public reach + CI trigger change). |
| Complexity | Pass | The gallery generator is the one new script, reusing existing render + PNG code. |

**Gates touched**: none of the four vetting gates. CI (`verify.yml`) gains `pull_request` and
`push` triggers. A `gallery:generate` script is added, and a freshness check is added to the
registry gate (like the icon/font generators).

**Golden hashes**: not expected to move.

**Amendment**: none. The constitution already states the go-public rules; this feature satisfies
them and records the legal review. No principle or scope entry changes.

**Post-design re-check**: unchanged. No violation.

## Project Structure

### Documentation (this feature)

```text
specs/005-go-public-readiness/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1 to R6
├── data-model.md        # Phase 1: contributor, CLA record, proposal, scan, gallery, review
├── quickstart.md        # Phase 1: how to validate the feature end to end
├── contracts/
│   ├── contributing.md  # The new-primitive rule and style rubric (CONTRIBUTING content)
│   └── cla.md           # The CLA gate and record
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
CONTRIBUTING.md                # NEW: new-primitive rule + style rubric
SECURITY.md                    # NEW: vulnerability reporting + supported versions
CODE_OF_CONDUCT.md             # NEW: code of conduct
.github/ISSUE_TEMPLATE/primitive-proposal.md   # NEW: proposal template
.github/workflows/verify.yml   # CHANGE: add pull_request + push triggers
CLA.md                         # NEW: the CLA text
scripts/generate-gallery.ts    # NEW: renders gallery/ thumbnails from the reference frames
gallery/<primitive>.png        # NEW (generated, committed): 29 thumbnails
README.md                      # CHANGE: link gallery + CONTRIBUTING
```

**Structure Decision**: Keep the single-project layout. Documentation lives at the repository
root (where GitHub surfaces it); the gallery generator joins `scripts/`, its output is committed
under `gallery/`.

## Complexity Tracking

No violations.
