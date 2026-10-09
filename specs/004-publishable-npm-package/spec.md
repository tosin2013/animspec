# Feature Specification: Publishable npm Package

**Feature Branch**: `004-publishable-npm-package` (not created; no branch hook is installed)

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: none typed. Chosen when asked: the roadmap's next spec, "Publishable npm package (PRD F6)". The package name is settled as `animspec`. The work covers the package build, automated release, and keeping dependencies current.

## User Scenarios & Testing *(mandatory)*

Today the library is a source-only TypeScript module: a consumer would have to copy the source
and its assets into their own project, which breaks determinism (they would not get the shipped
fonts and icons) and makes the library impossible to depend on. This feature makes it a real
package that a project — authored by a person or a coding agent — can install and use, that
renders identically to the reference interpreter, and that keeps itself current.

### User Story 1 - A consumer installs the package and renders identical frames (Priority: P1)

A developer adds the package to their project and renders a spec. The frames are byte-identical
to the reference interpreter's, on the same processor type, with no extra setup.

**Why this priority**: This is the M1 gate — the private product must render from the package
with identical hashes. Everything else in this feature is packaging around that promise.

**Independent Test**: Install the built package into a fresh project, render the reference
cases, and confirm the hashes match the committed golden hashes for that machine's processor
type.

**Acceptance Scenarios**:

1. **Given** a fresh project with no fonts installed, **When** it installs the package and renders a spec containing text, **Then** the frames are byte-identical to the reference on the same processor type.
2. **Given** the package installed, **When** a consumer calls the documented public API, **Then** every documented entry point works without importing internals.
3. **Given** the package, **When** it renders the full reference set, **Then** every hash matches the committed golden hashes for that machine's processor type.

---

### User Story 2 - The package is self-contained (Priority: P1)

The package carries everything it needs — the shipped fonts and the icon bitmaps — inside
itself, so it works from any folder, on a machine with no fonts and with no copy of the source
assets.

**Why this priority**: Determinism depends on the shipped assets. A package that reaches for
files on disk would render differently (or fail) on the consumer's machine, undoing the core
promise.

**Independent Test**: Install the package into a folder that has no `assets/` directory, render
the text and icon cases, and confirm output identical to the reference.

**Acceptance Scenarios**:

1. **Given** the package installed in any folder, **When** a spec with text or icons renders, **Then** output is byte-identical to the reference, whatever the working directory.
2. **Given** a machine with no fonts, **When** the package renders text, **Then** the shipped fonts are used and no machine font is.

---

### User Story 3 - The public surface is clean and complete (Priority: P2)

The package exposes exactly the intended API. Leftover types carried over from the application
the code was extracted from are gone, and the model-facing description builders no longer
default to the full vocabulary.

**Why this priority**: A clean surface is what makes the package safe to depend on, and
removing the full-vocabulary default closes the tier leak that spec 003 deliberately deferred.

**Independent Test**: Inspect the package's exported surface; confirm no application-specific
types remain, and that the model-facing description builders require a selection.

**Acceptance Scenarios**:

1. **Given** the package, **When** a developer inspects its exports, **Then** only the documented vocabulary, interpreter, validator, selector, fonts and RNG types are present, with no leftover application types.
2. **Given** the package, **When** a caller tries to build a model description without a selection, **Then** the call is rejected, so a model cannot be shown the full vocabulary by accident.

---

### User Story 4 - Releases are automated and dependencies stay current (Priority: P2)

A maintainer releases a new version with minimal effort and it is published automatically.
Proposed dependency updates are verified by the offline gate before they can merge.

**Why this priority**: The package is only useful if new versions reach consumers, and a
package that others depend on must keep its dependencies updated and verified.

**Independent Test**: Observe a release end-to-end (a version is released → the package is
published), and observe a proposed dependency bump run the offline gate and pass before merging.

**Acceptance Scenarios**:

1. **Given** a maintainer wants to release, **When** they trigger the release, **Then** the package is built and published with the new version, without hand-built artifacts.
2. **Given** a dependency update is proposed, **When** it is proposed, **Then** the offline verify runs and the update merges only if it passes, without a human running it by hand.
3. **Given** a release, **When** a consumer installs the new version, **Then** existing specs render identically, because a breaking change is only introduced in a major version.

---

### Edge Cases

- **A consumer on an unsupported processor type or Windows**: the package still installs, but the determinism promise does not apply; it is documented as unsupported.
- **A consumer with no network at runtime**: the package renders without any network, as today.
- **A dependency update that moves a golden hash**: the offline gate fails the update (a rendering change), which is caught rather than silently shipped.
- **A release with no version bump**: the release is refused rather than silently re-publishing the same version.
- **The first public publish**: requires the legal review and a secret scan to have passed (held by spec 005); until then the package is built and consumed privately, not listed publicly.
- **A consumer who imports deep paths** (for example `animspec/src/...`): not supported; only the public entry points are a contract.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The package MUST be installable as a dependency and expose a documented public entry point.
- **FR-002**: Rendering from the package MUST produce frames byte-identical to the reference interpreter on the same processor type, and within the stated tolerance across types.
- **FR-003**: The package MUST be self-contained: fonts and icon data ship inside it and are used from memory, so output does not depend on the working directory or on any file on the consumer's machine.
- **FR-004**: The package MUST add no runtime dependency beyond `@napi-rs/canvas`, and no dependency that reads files or the network.
- **FR-005**: The public surface MUST expose only the documented API (interpreter, validator, registry and selection, fonts, RNG, version and tiers), and MUST NOT expose leftover application types.
- **FR-006**: The model-facing description builders MUST require a selection argument; the no-argument full-vocabulary default MUST be removed.
- **FR-007**: The package MUST declare its name (`animspec`), licence, and the shipped third-party assets in its metadata and notices.
- **FR-008**: A maintainer MUST be able to publish a new version through an automated release, without hand-building artifacts.
- **FR-009**: The release MUST refuse to publish an unchanged version, and MUST tag each published version so it is reproducible from source.
- **FR-010**: Proposed dependency updates MUST be created automatically and MUST pass the offline verify before they can merge.
- **FR-011**: Existing saved specs MUST render identically after this feature; the only behaviour change allowed is the removal of the model-facing default (FR-006), which does not affect rendering.
- **FR-012**: The package MUST work from any folder and on a machine with no fonts installed.

### Key Entities

- **Package**: the built, installable form of the library, named `animspec`.
- **Public surface**: the set of exports a consumer may rely on; the contract of the package.
- **Release**: one published version, tied to a tag and a version number, reproducible from source.
- **Dependency update**: a proposed change to a declared dependency, verified by the offline gate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Installing the package into a fresh project and rendering the full reference set reproduces 100% of the committed golden hashes for the machine's processor type.
- **SC-002**: Rendering from the package is byte-identical to rendering from the source tree for 100% of reference cases (packaging does not change output).
- **SC-003**: The package renders correctly from a folder with no `assets/` present and on a machine with no fonts, for 100% of text and icon cases.
- **SC-004**: The public surface contains zero application-specific types.
- **SC-005**: A release is published from a single maintainer action, and re-releasing an unchanged version is refused.
- **SC-006**: Every proposed dependency update runs the offline verify, and zero updates merge that fail it.
- **SC-007**: The offline verify still passes with no network, within the existing build budget.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a developer** (human or coding agent): they can add the library to their project as a dependency and use it, and get frames identical to the reference.
- **For the private product**: it can depend on the published package and render with identical hashes (the M1 gate).
- **For a maintainer**: releasing a new version and keeping dependencies current is automated and safe.

### In scope

- Building the library into an installable package with a documented public entry point.
- Making the package self-contained (fonts and icons ship inside, no file reads).
- Removing the leftover application types from the public surface.
- Removing the full-vocabulary default from the model-facing description builders.
- Automated release and automated dependency-update proposals, verified by the offline gate.
- Package metadata: the name (`animspec`), the licence, and the third-party notices.

**Boundary change**: publishing the package and automated releases are a new kind of output and
a new external service. They are named here and added to the constitution baseline in the same
change that ships this feature.

### Out of scope

- **Going public**: the legal review of the licence and CLA, a security policy (`SECURITY.md`), a secret scan, and actually making the package publicly installable. Held by spec 005; this feature builds the package and its machinery and stops short of the public launch.
- **The gallery and reference thumbnails** — spec 005.
- **The contribution rules and the CLA text and sign-up** — spec 005.
- **A command-line renderer** — spec 006 (undecided).
- **Adding primitives or changing how anything draws** — no rendering change here.
- **Consumers on unsupported platforms** (Windows, other processor types) — documented, not promised.

### External dependencies

- The package registry (for publishing) — reached only at release time, never during verify.
- A registry access token held as a secret by the maintainer.
- The existing offline verify command and the golden reference sets, as the yardstick for identical rendering.
- The legal review and a secret scan are prerequisites of the public launch (005), not of this feature's build work.

### Non-negotiable constraints

- **Principle I**: the package renders byte-identical to the reference; no reference frame moves.
- **Principle VI**: verify stays one offline command, one workflow, one job; the release automation is separate and must not run on a self-hosted runner once public.
- **Naming**: the package name is `animspec`, neutral, not the private product's name.
- **Licence**: Apache-2.0, with the shipped fonts' and icons' licences carried in the package's notices.

## Assumptions

- **Scope source**: the roadmap entry for spec 004 and the decision, recorded here, to name the package `animspec`.
- **Name**: `animspec`, chosen 2026-10-09 and verified unclaimed on the package registry.
- **Publishable before public**: the package is built and consumed by the private product before it is publicly listed; the public launch waits for 005's legal review and secret scan.
- **Release trigger**: a release is triggered by a maintainer action (a tag or equivalent); the exact trigger is a planning decision.
- **Dependency updates**: proposed automatically on a regular cadence, each verified by the offline gate; that gate is the whole safety bar and no additional checks are added.
- **Deep imports unsupported**: consumers use the public entry point only; internal paths are not a contract.
- **No new assets**: the package ships the same generated font and icon data as the source tree.
