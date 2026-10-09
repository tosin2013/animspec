# Feature Specification: Go-Public Readiness

**Feature Branch**: `005-go-public-readiness` (not created; no branch hook is installed)

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: none typed. Chosen when asked: the roadmap's next spec, "Go-public readiness". The package is already named `animspec` and publishable (004); this feature prepares the repository and community for the public launch.

## User Scenarios & Testing *(mandatory)*

The library is a publishable package but the repository is private. Making it public is more
than flipping a switch: contributions need rules and a signed-licence gate, the community needs
a security policy and a code of conduct, the CI must run automatically on public pull requests,
the repository must pass a secret scan, and the project needs a showcase. This feature delivers
all of that and records the legal review that gates the launch itself.

### User Story 1 - The repository is safe to make public (Priority: P1)

A maintainer flips the repository public and the first public push is clean: the secret scan
has passed, CI runs automatically on every pull request and push to `main` (no manual trigger),
the runner is GitHub-hosted, and the legal review of the licence and CLA is recorded as
complete.

**Why this priority**: This is the gate. The constitution requires a legal review and a passing
secret scan before the first public push; without them the repository must stay private.

**Independent Test**: The secret scan reports zero findings, CI runs on a pull request without
a manual trigger, and the legal review is recorded.

**Acceptance Scenarios**:

1. **Given** the repository before its first public push, **When** the secret scan runs, **Then** it passes with no committed secret reported.
2. **Given** a public pull request, **When** it is opened, **Then** CI runs automatically and passes, with no manual `workflow_dispatch`.
3. **Given** the CI, **When** it runs, **Then** it uses a GitHub-hosted runner, never a self-hosted one.
4. **Given** the licence and CLA, **When** the launch proceeds, **Then** the legal review is recorded as complete.

---

### User Story 2 - Outside contributions are governed (Priority: P1)

A first-time contributor can find the rules, propose a primitive through a template, and be told
they must sign the CLA. No outside contribution merges without a signed CLA on file.

**Why this priority**: The constitution requires a signed CLA before any outside contribution
merges, and open contribution is the whole point of going public (the M2 milestone depends on it).

**Independent Test**: A contributor follows `CONTRIBUTING.md`, opens a primitive proposal from
the template, and the CLA gate is demonstrably enforced (a merge without a signed CLA is blocked).

**Acceptance Scenarios**:

1. **Given** a new contributor, **When** they open `CONTRIBUTING.md`, **Then** they find the new-primitive rule and the style rubric.
2. **Given** a contributor with a primitive idea, **When** they open a new issue, **Then** the primitive-proposal template is offered and the `good first primitive` label is available.
3. **Given** an outside contribution, **When** it is submitted, **Then** it cannot merge until the author's CLA is signed and recorded.
4. **Given** a CLA submission, **When** it is signed, **Then** the signing is recorded and linked to the author.

---

### User Story 3 - The community is supported (Priority: P2)

A user can report a vulnerability privately, and everyone knows the expected conduct.

**Why this priority**: A public repository needs a security policy and a code of conduct; they
are standard and low-effort but expected.

**Independent Test**: `SECURITY.md` names a reporting channel, and a code of conduct is present
and linked from the contribution guide.

**Acceptance Scenarios**:

1. **Given** a user who finds a vulnerability, **When** they look for how to report it, **Then** `SECURITY.md` tells them the channel and supported versions.
2. **Given** a community member, **When** they read the code of conduct, **Then** the expected behaviour and enforcement are stated.

---

### User Story 4 - The project is showcased (Priority: P2)

A visitor sees what the library produces: a gallery of reference thumbnails, one per primitive.

**Why this priority**: The gallery is how a public project shows its value at a glance; it is
generated from the reference frames so it cannot drift.

**Independent Test**: The gallery renders a thumbnail for every primitive, generated from the
reference frames, and links from the README.

**Acceptance Scenarios**:

1. **Given** the gallery, **When** it is generated, **Then** it shows one thumbnail per primitive, drawn from the reference frames.
2. **Given** the README, **When** a visitor looks, **Then** it links to the gallery.

---

### Edge Cases

- **A secret committed before scanning**: the scan catches it before the public push; the secret
  is rotated and the history handled, not merely ignored.
- **A first-time contributor who never signs the CLA**: their contribution stays unmerged; the
  CLA check, not a human, is the gate.
- **A primitive proposal that duplicates an existing primitive**: the new-primitive rule (a new
  primitive must draw something no existing primitive can) sends it back as a param change instead.
- **CI minutes while private**: the automatic triggers are added only as part of this feature
  (the moment the repository can go public), not before.
- **A gallery image that does not match its primitive**: the gallery is generated from the
  committed reference frames, so it cannot drift from what the library renders.

## Requirements *(mandatory)*

### Functional Requirements

**Contribution**

- **FR-001**: The repository MUST have a `CONTRIBUTING.md` stating the new-primitive rule and the style rubric.
- **FR-002**: The repository MUST have a primitive-proposal issue template and a `good first primitive` label.
- **FR-003**: The repository MUST have a CLA: its text, and a sign-up mechanism that records who signed it.
- **FR-004**: No outside contribution MUST merge unless the author has a signed CLA on record, enforced automatically.

**Safety**

- **FR-005**: A secret scan MUST pass with no committed secret before the first public push.
- **FR-006**: CI MUST run automatically on pull requests and pushes to `main`, still as one workflow with one job, on a GitHub-hosted runner.
- **FR-007**: The legal review of the licence and the CLA MUST be recorded as complete before the launch.

**Community**

- **FR-008**: The repository MUST have a `SECURITY.md` naming a vulnerability-reporting channel and the supported versions.
- **FR-009**: The repository MUST have a code of conduct.

**Showcase**

- **FR-010**: The repository MUST have a gallery of reference thumbnails, one per primitive, generated from the reference frames.
- **FR-011**: The `README.md` MUST link to the gallery and to `CONTRIBUTING.md`.

**Launch**

- **FR-012**: The repository MUST be made public, and the package MUST be published to the registry under `animspec`, only after FR-005, FR-006 and FR-007 are satisfied.

### Key Entities

- **Contributor**: a person or organisation whose pull request may be merged; identified by a signed CLA.
- **CLA record**: the signed licence agreement, linked to the author.
- **Primitive proposal**: an issue filed from the template, describing a candidate primitive.
- **Secret scan**: a pass/fail check over the repository history for committed secrets.
- **Gallery**: the generated set of reference thumbnails, one per primitive.
- **Legal review**: the recorded decision that the licence and CLA are sound.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The secret scan reports zero committed secrets.
- **SC-002**: 100% of public pull requests and pushes to `main` trigger CI automatically (0 manual triggers).
- **SC-003**: 0 outside contributions merge without a signed CLA on record.
- **SC-004**: `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct, and a primitive-proposal template all exist and are linked from the README.
- **SC-005**: The gallery renders a reference thumbnail for every one of the 29 primitives.
- **SC-006**: The legal review of the licence and CLA is recorded as complete.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a contributor**: they can propose a primitive under clear rules and, after signing the CLA, have it merged.
- **For a user**: they can report a vulnerability and find the gallery.
- **For the maintainer**: the repository and package go public with the required gates met.

### In scope

- `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct, a primitive-proposal issue template, and the `good first primitive` label.
- The CLA text and a sign-up mechanism that records signatures and gates merges.
- A secret scan that must pass before the first public push.
- Automatic CI triggers on public pull requests and pushes to `main` (still one workflow, one job).
- The gallery of reference thumbnails, generated from the reference frames.
- Recording the legal review of the licence and CLA.
- Making the repository public and publishing the package to the registry.

**Boundary change**: going public makes the repository and the package publicly reachable — a new
state of the project baseline, not a new responsibility. The CI trigger change (manual → automatic)
is a change to the existing verification entry, recorded here.

### Out of scope

- Changing how anything draws, adding primitives, or moving reference frames — none of that is touched.
- The publishable-package mechanics (004) and the vocabulary/tier work (003) — already shipped.
- A command-line renderer — spec 006 (undecided).
- The private product's own go-public concerns — held by the private project.

### External dependencies

- A CLA-signing service (or self-hosted equivalent) to record signatures.
- The secret-scanning capability of the platform (or a scanning tool).
- The legal review, which is a human decision recorded here, not something this feature can automate.

### Non-negotiable constraints

- **Constitution**: the legal review MUST be complete before going public; a secret scan MUST pass before the first public push; outside contributions require a signed CLA; CI stays one workflow, one job, GitHub-hosted; the name stays `animspec`.

## Assumptions

- **Scope source**: the roadmap entry for spec 005, the constitution's "before going public" rules, and the earlier decision to name the package `animspec`.
- **The legal review is a gate, not a feature**: it is a human decision; this feature records its completion and stops the launch until it exists.
- **The secret scan uses the platform's built-in capability** (free for public repositories); a separate tool is added only if that is insufficient.
- **The CLA uses an established sign-up flow** (a hosted or self-hosted assistant) rather than a hand-rolled one.
- **The gallery is generated, not hand-made**, from the committed reference frames, so it cannot drift from what the library renders.
- **CI minutes**: the automatic triggers are enabled as part of this feature, which is the moment they are needed.
