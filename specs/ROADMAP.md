# Spec Roadmap

Which feature specs the project needs, in what order, and what each one waits on. Product
intent lives in the "AnimSpec Core — PRD"; this file only maps it onto specs. Update it when a
spec is written, shipped, or re-ordered.

Last updated: 2026-10-01

## Milestones and their gates

| Milestone | Goal | Gate to pass before the next one |
| --- | --- | --- |
| M0 Extract | Code copied in, determinism gate slimmed, missing gates added | All 29 primitives pass every gate; open-source decision recorded |
| M1 Go public | Name, licence, contribution rules, gallery, npm package | The private product renders from the package with identical hashes |
| M2 50 primitives | Data-viz and text categories, first outside contributions, tiers enforced | LLM spec quality holds at 50 primitives |
| M3 v1.0 | 100 primitives, kits re-tuned, spec format v1.0 | None; growth stays open after |

## Specs

| # | Spec | Milestone | Status | Write it when |
| --- | --- | --- | --- | --- |
| 001 | [Complete the primitive vetting gates](001-primitive-vetting-gates/spec.md) | M0 | Shipped 2026-10-01 and merged to `main`: all four gates enforced, 29 of 29 primitives pass | Done |
| 002 | [Reference frames match on every machine](002-cross-machine-frames/spec.md) | Before M1 | Spec, plan and 43 tasks written and analysed 2026-10-01; ready to implement now that 001 is merged | Done |
| 003 | [Vocabulary version and tiers](003-vocab-version-tiers/spec.md) (PRD F7) | Before M1 | Spec, plan and 35 tasks written 2026-10-01; starts after 002 merges | Done |
| 004 | Publishable npm package (PRD F6) | M1 | Not started | After 001 ships |
| 005 | Go-public readiness | M1 | Not started | Alongside 004 |
| 006 | Command-line renderer (PRD F5) | M1 or later | Not started | Once it is decided whether it ships in v1 |
| 007+ | Primitive batches, one spec per category | M2 | Not started | Once outside contributions can start |
| later | Kit re-tuning and spec format v1.0 freeze | M3 | Not started | After the 50-primitive LLM evaluation |

### Notes on each

- **002 Reference frames match on every machine.** Decided 2026-10-01: frames are byte-identical on
  machines with the same processor type, with one reference set per type, and within a small
  stated tolerance across types. Text is drawn with a font shipped in the library. Evidence is in
  [002 investigation](002-cross-machine-frames/investigation.md). Best started after 001 lands,
  since both re-record reference hashes.
- **003 Vocabulary version and tiers.** Decided 2026-10-01: the extended tier is public and
  lives in this repository. Each spec records the vocabulary version it was written
  against; primitives carry a tier (core, extended, contrib, legacy); a replaced primitive keeps
  rendering identically for specs that use it. The PRD lists tier enforcement under M2. It is
  scheduled earlier here because the version field is part of the spec format: adding it after
  the package is public leaves every already-saved spec without one.
- **004 Publishable npm package.** A built package the private product can depend on. Covers the
  package entry points, bundling the icon library so it works from any folder (delivered
  by 001: icon bitmaps are pre-generated data, and the library no longer reads files), and removing the leftover types that belong to the application the code came from.
- **005 Go-public readiness.** CONTRIBUTING with the new-primitive rule and style rubric, code of
  conduct, a primitive proposal issue template, the `good first primitive` label, the CLA text
  and sign-up bot, public build triggers with code and secret scanning, and the gallery with
  reference thumbnails.
- **006 Command-line renderer.** Renders a spec plus a signal file to image frames, and to video
  when a video encoder is installed.
- **007+ Primitive batches.** A batch spec sets the targets and acceptance bar for one category.
  Individual primitives go through the vetting pipeline, not a full spec each. Data-viz first
  (0 today, 20 targeted), then text and numerals (5 today, 20 targeted).

## Findings to schedule

Found while planning 001 and deliberately left out of it. Each needs a decision on where it
goes. Details are in [001 research](001-primitive-vetting-gates/research.md).

| Finding | Risk | Suggested home |
| --- | --- | --- |
| **Confirmed 2026-10-01, now spec 002.** Golden hashes recorded on the reference laptop (macOS, arm64) do not match on the Linux x64 build machine. Measured cause: text uses whatever font the machine has, and x64 processors round soft edges differently from arm64 by at most 5 out of 255 per channel. The operating system itself makes no difference. | Breaks the core promise as written ("byte-identical on every machine") and constitution Principle I. The automated build cannot pass until 002 ships. | [Spec 002](002-cross-machine-frames/spec.md) |
| Golden reference cases render an unvalidated `{ type }` layer, which skips defaults. `led` and `sprite` therefore have reference hashes for behaviour a validated spec never produces. | Reference output does not cover the real default path for two primitives | Fold into 003 or a small follow-up; moves two primitives' hashes with no rendering change |

## Not specs in this repository

- Recording the open-source decision, the LLM vocabulary-scaling evaluation, and switching the
  private product to the published package all happen in the private project.
- Public name, CLA wording, and the legal review are decisions, not features.

## Open decisions that block specs

| Decision | Blocks |
| --- | --- |
| Public project and npm package name | 004, 005 |
| Whether the command-line renderer ships in v1 | 006 |
| Legal review of licence and CLA | 005 |
