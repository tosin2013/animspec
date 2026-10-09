# Research: Go-Public Readiness

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-09

Decisions taken while planning. Each was checked against the constitution and the repository as
it stands on `main` on 2026-10-09.

## R1. Secret scanning

**Decision**: Use the platform's built-in secret scanning (free for public repositories) as the
gate, and run a local scan in CI as a belt-and-suspenders check before the public push.

**Rationale**: GitHub's native secret scanning covers committed credentials without a new
dependency, and it is the capability the constitution's "a secret scan MUST pass before the first
public push" points at.

**Alternatives considered**:

- A dedicated scanner (trufflehog/gitleaks) in CI: more setup, one more tool to maintain; the
  built-in scanning is sufficient for this repository's size.

## R2. CLA sign-up and gating

**Decision**: Add the CLA text (`CLA.md`) and enforce it with a lightweight gate that blocks a
merge unless the author's signature is on a committed list, using an established sign-up flow
rather than a hand-rolled one.

**Rationale**: The constitution requires a signed CLA before an outside contribution merges. A
signature list checked in CI is the simplest thing that satisfies "recorded and enforced", and it
keeps the gate visible in review.

**Alternatives considered**:

- A hosted CLA assistant service: more convenient sign-up, but an external dependency with its
  own trust surface; deferred until contribution volume warrants it.

## R3. CI triggers

**Decision**: Add `pull_request:` and `push: { branches: [main] }` to the existing single-job
`verify.yml`, replacing the `workflow_dispatch`-only trigger. No new workflow, no matrix, no cron.

**Rationale**: The verify.yml header already documents this exact change ("When it goes public,
add pull_request: and push: triggers"). It keeps Principle VI (one workflow, one job) intact.

**Alternatives considered**:

- A separate PR-check workflow: a second workflow, which Principle VI discourages.

## R4. Gallery generator

**Decision**: A `scripts/generate-gallery.ts` renders each primitive's validated default layer at
a fixed frame into a `gallery/<type>.png` thumbnail, reusing the existing render path and the PNG
encoder in `scripts/lib/referenceSets.ts`. The output is committed and checked for freshness.

**Rationale**: The gallery must show exactly what the library renders, so it is generated from
the registry and the reference frames, following the icon/font generator pattern (generate,
commit, check freshness).

**Alternatives considered**:

- Hand-authored screenshots: drift from the renderer and go stale.
- A hosted image service: an external dependency this repository does not need.

## R5. Contribution rules content

**Decision**: `CONTRIBUTING.md` states the new-primitive rule verbatim from the constitution (a
new primitive must draw something no existing primitive can draw by changing its params) and the
four style-review questions (negative space, one signal driving the frame, every element carrying
information, works in pure black and white). The proposal template mirrors these.

**Rationale**: The constitution already defines the rule and the style rubric; the contribution
guide is the human-facing rendering of them, not a new source of truth.

**Alternatives considered**:

- A looser guide: would drift from the constitution and let near-duplicates in.

## R6. The legal review

**Decision**: The legal review of the licence and CLA is recorded as a decision (a documented
sign-off), not automated. The launch tasks fail-closed until it is recorded.

**Rationale**: The constitution names it as a "before going public" MUST; it is a human decision
about legal text, which no feature can automate.

**Alternatives considered**:

- Proceeding without recording it: violates the constitution.
