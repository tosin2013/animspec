# Feature Specification: Reference Frames Match on Every Machine

**Feature Branch**: `002-cross-machine-frames`

**Created**: 2026-10-01

**Status**: Implemented on branch `002-cross-machine-frames`; pending merge to `main`

**Input**: User description: none typed. Taken from the preceding discussion: "Plan the next spec on the roadmap: reference frames recorded on one machine do not match on another, which breaks the promise that the same spec, signal and seed give byte-identical frames."

## User Scenarios & Testing *(mandatory)*

The project promises that the same spec, signal and seed always produce the same frame. Today
that holds only on the machine that recorded the reference frames. The automated build, on a
different kind of machine, fails the reference comparison, so it can never pass, and nobody
can check their own renders against the project's.

An investigation ([investigation.md](investigation.md)) found two separate causes. Text is
drawn with whatever font each machine has. And two processor types round soft edges
differently, by an amount too small to see. The operating system makes no difference.

This feature makes the promise true and checkable: frames are byte-identical on machines of
the same processor type, and within a small stated tolerance across processor types.

### User Story 1 - Text looks the same on every machine (Priority: P1)

A developer renders a spec containing a caption on their laptop, and a colleague renders the
same spec on a server with almost no fonts installed. Both get the same frame, because text
is drawn with a font that comes with the library, not one borrowed from the machine. The
library ships a small set of fonts, and a spec can say which one it wants.

**Why this priority**: Fonts are the larger of the two causes and the one a user can see: on
a machine without the expected font, text can look entirely different or be missing. It is
also what makes every other comparison in this feature meaningful for the text primitives.

**Independent Test**: Render the text-drawing primitives on two machines of the same
processor type, one with many fonts installed and one with none, and confirm the frames are
byte-identical.

**Acceptance Scenarios**:

1. **Given** two machines of the same processor type with different fonts installed, **When** each renders the same spec containing text, **Then** the frames are byte-identical.
2. **Given** a machine with no fonts installed at all, **When** it renders a spec containing text, **Then** the text appears, and matches the frame from a fully equipped machine of the same processor type.
3. **Given** a label containing a character the shipped font does not have, **When** it is rendered on two machines with different fonts installed, **Then** both frames are identical, and no font from either machine is used.
4. **Given** a spec with no text, **When** it is rendered before and after this feature on the same machine, **Then** the frame is unchanged.
5. **Given** a spec that names one of the shipped fonts, **When** it is rendered, **Then** its text is drawn in that font, identically on every machine of the same processor type.
6. **Given** a spec that names no font, **When** it is rendered, **Then** its text is drawn in the default font.
7. **Given** a spec that names a font the library does not ship, **When** it is validated, **Then** the default font is used and the caller is told the name was not recognised.

---

### User Story 2 - The check passes on every supported machine (Priority: P2)

A contributor runs the verify command on their own machine, whichever supported processor
type it has, and it compares their renders against the reference frames for that processor
type. The automated build, on a different processor type from the maintainer's laptop, does
the same and passes.

**Why this priority**: This is what turns the automated build green and lets contributors
trust a local pass. It depends on the first story for the text primitives.

**Independent Test**: Run the verify command on a machine of each supported processor type and
confirm it passes on all of them without any machine-specific setup.

**Acceptance Scenarios**:

1. **Given** a machine of either supported processor type, **When** the verify command runs on unchanged code, **Then** the reference comparison passes.
2. **Given** the automated build machine, **When** the build runs on unchanged code, **Then** it passes.
3. **Given** a change that alters what one primitive draws, **When** the verify command runs on a machine of either processor type, **Then** it fails and names the primitive and the reference set it was compared against.
4. **Given** a machine whose processor type has no reference set, **When** the verify command runs, **Then** it says plainly that the exact comparison could not be made for that machine, and does not report a pass for it.
5. **Given** a reference comparison with many mismatches, **When** it fails, **Then** every mismatching case is reported, not only the first few.

---

### User Story 3 - Frames from different processor types are provably close (Priority: P3)

An app developer renders on one processor type during development and on another in
production. They can rely on a stated limit to how far the two can differ, and the project
checks that limit on every run.

**Why this priority**: Without a checked limit, "close" is an unverified claim. It is lower
than the first two because the measured differences are already invisible; this story stops
them growing unnoticed.

**Independent Test**: Compare each reference case as rendered on one processor type against the
same case from the other, and confirm no pixel differs by more than the stated tolerance.
Then confirm a deliberately larger difference is rejected.

**Acceptance Scenarios**:

1. **Given** the reference cases rendered on both supported processor types, **When** they are compared, **Then** no colour channel of any pixel differs by more than the stated tolerance.
2. **Given** a change that makes one primitive differ between processor types by more than the tolerance, **When** the verify command runs, **Then** it fails, names the primitive, and reports the measured difference and the limit.
3. **Given** a spec with the maximum number of layers, **When** it is rendered on both processor types, **Then** the difference is still within the stated tolerance.
4. **Given** any run of the verify command, **When** the cross-type comparison finishes, **Then** the largest difference found is shown.

---

### User Story 4 - The maintainer refreshes every reference set from one machine (Priority: P4)

The maintainer makes an intended change to how a primitive draws. On their own machine, with
one command, they refresh the reference frames for every supported processor type, without
access to a second physical machine.

**Why this priority**: With more than one reference set, updating them by hand on separate
machines would be slow and easy to get wrong. It is needed as soon as the second story lands,
but only by maintainers.

**Independent Test**: Change one primitive on purpose, run the refresh command on one machine,
and confirm that the verify command then passes on machines of both processor types.

**Acceptance Scenarios**:

1. **Given** an intended change to one primitive, **When** the maintainer runs the refresh command on one machine, **Then** the reference sets for all supported processor types are updated.
2. **Given** refreshed reference sets, **When** the verify command runs on a machine of each processor type, **Then** it passes on each.
3. **Given** a refresh that changed some reference frames, **When** it finishes, **Then** it lists which cases changed in which set, so the change can be recorded.
4. **Given** a machine that cannot produce frames for another processor type, **When** the refresh command runs, **Then** it stops with a clear explanation and leaves every reference set as it was.

---

### User Story 5 - The promise is stated accurately (Priority: P5)

A reader of the project's documentation learns exactly what is guaranteed: byte-identical
frames on the same processor type, and frames within a stated tolerance across types. The
project's governing principles say the same.

**Why this priority**: The current wording ("every machine") is not true and cannot be made
true without changing how primitives look. Stating the real promise matters, but only once the
earlier stories make it checkable.

**Independent Test**: Read the project's description of its determinism promise and its
governing principle on determinism, and confirm both state the per-type guarantee, the
cross-type tolerance and the supported processor types.

**Acceptance Scenarios**:

1. **Given** this feature is complete, **When** a reader opens the project's description of its promise, **Then** it states the per-type guarantee, the cross-type tolerance as a number, and the supported processor types.
2. **Given** this feature is complete, **When** a reader opens the governing principle on determinism, **Then** it no longer claims byte-identical output on every machine.
3. **Given** the shipped font, **When** a reader checks the project's third-party notices, **Then** the font and its licence are listed.

---

### Edge Cases

- **Characters the shipped font lacks**: emoji, accented letters or non-Latin scripts in a label. If a machine quietly substitutes one of its own fonts, the difference comes back. Such characters must draw the same everywhere.
- **A machine with no fonts**: text must still appear.
- **Machines of the same processor type that disagree**: different chips of one type may round differently. If they do, the per-type promise as stated here is false and must be narrowed; see the Assumptions entry under Scope and Boundaries.
- **Emulated processors**: a reference set produced under emulation must match what a real machine of that type produces, or the fourth story does not work.
- **Many layers**: small differences add up as layers stack. The tolerance must hold for the largest spec allowed, not only for the reference cases.
- **Unsupported processor types and Windows**: must be reported honestly, never shown as a pass.
- **Library upgrades**: a new version of the drawing library may change rounding. That is a rendering change and must fail the comparison until the reference sets are refreshed.
- **Signals without text**: primitives that draw nothing without a label must be unaffected by the font change.
- **Reference cases that skip defaults**: two primitives are currently recorded with settings a validated spec never produces, so their real default behaviour has no reference frame.

## Clarifications

### Session 2026-10-01

- Q: What should the project promise across processor types? → A: Byte-identical on the same processor type, with a reference set for each; within a small stated tolerance across types. No primitive changes how it draws shapes.
- Q: Which font should ship, and can there be more than one? → A: Several fonts ship in this feature and a spec chooses one. The default is DejaVu Sans Mono.
- Q: Do all x64 machines agree? → A: Checked during planning. The real build machine and an emulated x64 machine produced identical frames for all 75 reference cases that draw no text. Text cases could not be compared then, because the machines had different fonts; they are confirmed on the first build after the shipped fonts land.

## Requirements *(mandatory)*

### Functional Requirements

**Text**

- **FR-001**: All text MUST be drawn with one of the fonts that ship with the library, never with a font found on the machine.
- **FR-002**: Text output MUST be byte-identical on machines of the same processor type regardless of which fonts they have installed, including none.
- **FR-003**: A character the shipped font does not contain MUST draw the same on every machine and MUST NOT fall back to a font from the machine.
- **FR-004**: Every shipped font's licence MUST allow it to be distributed with the library, and every shipped font MUST be listed in the project's third-party notices with its licence.
- **FR-005**: Primitives that draw no text MUST render byte-identically on the reference machine before and after this feature. `sprite` is the one exception to the recorded hash: it draws no text and renders unchanged, but its reference case previously skipped defaults, so its hash is corrected without a rendering change.
- **FR-022**: A spec MUST be able to name which shipped font its text uses. A spec that names none MUST use the default font, DejaVu Sans Mono.
- **FR-023**: A font name the library does not ship MUST be replaced by the default during validation, and the caller MUST be told, in the same way as other rejected input.
- **FR-024**: The list of shipped fonts MUST be available to people and to models that author specs: in the generated description of the spec format that models are given, and from the library's public surface.
- **FR-025**: FR-002 and FR-003 MUST hold for every shipped font, and each shipped font MUST have reference cases for the text-drawing primitives.
- **FR-026**: Every text-drawing primitive MUST lay out correctly in every shipped font; in particular, text on the LED sign MUST fit within its rows.

**Reference sets**

- **FR-006**: The project MUST keep one set of reference frames for each supported processor type. The supported types are arm64 and x64.
- **FR-007**: The verify command MUST compare renders against the reference set for the processor type of the machine it runs on, with no setup by the person running it.
- **FR-008**: On a machine whose processor type has no reference set, the verify command MUST state that the exact comparison was not made, and MUST NOT report that comparison as passed.
- **FR-009**: A failed reference comparison MUST name the reference set used and report every mismatching case.
- **FR-010**: Each reference set MUST cover every primitive and every composite case, with each primitive's default behaviour recorded as a validated spec would produce it.

**Across processor types**

- **FR-011**: For every reference case, no colour channel of any pixel may differ between the two supported processor types by more than 8 out of 255.
- **FR-012**: The verify command MUST check FR-011 on every run, on either processor type, and MUST fail if it is exceeded, naming the primitive, the measured difference and the limit.
- **FR-013**: The cross-type check MUST include a case with the maximum number of layers a spec may have (12, the validator's layer cap).
- **FR-014**: The verify command MUST report the largest cross-type difference found on every run.

**Keeping the sets current**

- **FR-015**: A maintainer MUST be able to refresh the reference sets for all supported processor types with one command on one machine.
- **FR-016**: The refresh MUST report which cases changed in which set.
- **FR-017**: If the refresh cannot produce frames for a processor type, it MUST stop with an explanation and leave every reference set unchanged.
- **FR-018**: Every intended change to a reference set MUST be recorded in the project's change log for reference frames, including the changes this feature makes.

**The build and the promise**

- **FR-019**: The automated build MUST pass on unchanged code and stay within the project's two-minute budget.
- **FR-020**: All checks MUST continue to run with no network, database or external service.
- **FR-021**: The project's description of its promise and its governing principle on determinism MUST state the per-type guarantee, the cross-type tolerance, and the supported processor types.

### Key Entities

- **Processor type**: the family of processor a machine has. Two are supported: arm64 and x64. The operating system is not part of it.
- **Reference set**: the recorded frames for every reference case as rendered on one processor type. There is one per supported type.
- **Reference case**: one primitive or composite at one signal level, the unit that is compared.
- **Cross-type tolerance**: the largest allowed difference, per colour channel of a pixel, between the same case on two processor types.
- **Shipped font**: a font file that comes with the library. There are several; one is the default.
- **Font choice**: the optional part of a spec that names which shipped font its text uses.
- **Change log for reference frames**: the record of every intended change to a reference set, with the reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The verify command passes on unchanged code on three machines: a Mac with arm64, a Linux machine with arm64, and the Linux x64 build machine (3 of 3).
- **SC-002**: Text frames are byte-identical between a machine with hundreds of fonts and a machine with none, of the same processor type, for 100% of text cases in every shipped font.
- **SC-003**: Across the two processor types, 100% of reference cases are within the tolerance of 8 per channel, including the maximum-layer case.
- **SC-004**: The automated build passes and finishes in under two minutes.
- **SC-005**: On the reference machine, every primitive that draws no text and is not one of the two with corrected reference cases renders byte-identically before and after this feature (23 of 29).
- **SC-006**: A maintainer refreshes all reference sets from one machine with one command in under five minutes.
- **SC-007**: A deliberate rendering change is caught on machines of both processor types (2 of 2), and a deliberate cross-type difference above the tolerance is caught (1 of 1).
- **SC-008**: A reader can state the project's determinism promise correctly after reading one paragraph of its documentation.
- **SC-009**: A spec can select each shipped font (3 of 3), an unrecognised font name falls back to the default with a message, and specs that name no font are unaffected by the presence of the others.

## Scope and Boundaries

### 1. Outcome

A caller renders a spec on any supported machine and gets frames that are byte-identical to the
project's reference frames for that processor type, and provably within the stated tolerance on
the other supported processor type. The automated build turns green, and a contributor can trust
a local pass of `npm run verify`.

### 2. In scope

- Shipping three fonts inside the library and letting a spec name one, with the default and the
  fallback-and-report behaviour for unknown names.
- One reference set per supported processor type (`arm64`, `x64`): committed hashes and stored
  frames, with the change log for intended changes.
- The verify command comparing renders against the machine's own reference set, listing every
  mismatch, and checking the cross-type tolerance on every run.
- One command that refreshes both reference sets from one machine, together or not at all.
- Restating the determinism promise accurately in the README and the constitution, and listing
  the shipped fonts in `NOTICE`.

### 3. Out of scope

- Windows and any processor type other than arm64 and x64 — reported as unsupported, not promised.
- Changing how any primitive draws shapes in order to remove rounding differences.
- The gallery and reference thumbnails, and public build triggers — these belong to the go-public
  spec (005) and the private project.
- Full coverage of every script or character — a character a shipped font lacks draws that font's
  own placeholder.

### 4. External dependencies

- The existing verify command and the reference-frame change log introduced by feature
  `001-primitive-vetting-gates`.
- A way to run another processor type on the maintainer's machine: Docker, used only by the
  refresh command (`npm run golden:update`), not by verify.

### 5. Assumptions

- **Scope source**: no description was typed with the command. The scope is the roadmap entry
  "reference frames match on every machine" and the decision recorded under Clarifications.
- **All machines of one processor type agree**: the promise depends on it. Confirmed during
  planning for arm64 (a Mac and a Linux machine) and for x64 (the real build machine against an
  emulated one) on every case that draws no text. Text cases are confirmed on the first build
  after the shipped fonts land. Intel Macs and Linux systems built on a different system library
  are assumed to agree and are not verified. If any of this proves false, this spec returns for
  clarification, because the promise would have to be narrowed to named reference machines.
- **Tolerance value**: 8 out of 255 per channel. The largest difference measured is 5, in a
  three-layer composite, and 3 for a single primitive. Eight leaves room for deeper layering
  while staying far below what the eye can see. If the maximum-layer case exceeds 8, the value is
  revisited with evidence, not raised silently.
- **Text will look different**: switching to shipped fonts changes the appearance of the five
  text-drawing primitives and the composites that include them, on every machine. This is an
  intended change and the main visible effect of the feature.
- **Which fonts**: three ship, each verified byte-identical across machines of the same processor
  type: DejaVu Sans Mono (the default), JetBrains Mono and IBM Plex Mono. Roboto Mono was
  considered and left out because its glyphs are cut off on the LED sign. Together they add about
  0.8 MB to the library.
- **Font choice is a format change**: adding a font choice to the spec format before vocabulary
  versioning exists is acceptable because it is optional and specs without it render with the
  default.
- **One font per spec**: the choice applies to the whole spec, not to individual layers.
- **Missing characters**: measured during planning, a character a shipped font lacks draws as
  that font's own empty-box placeholder on every machine, and no font from the machine is used,
  even when the machine has fonts that contain the character. That behaviour is accepted.
- **Corrected reference cases**: the two primitives whose reference cases skip defaults are fixed
  here, since their reference frames are being re-recorded anyway. Their rendering does not
  change; only what is recorded.
- **Ordering**: this feature starts after the vetting-gates feature lands, because both
  re-record reference frames and doing them together would make it impossible to tell which
  change moved which frame.
- **Private product**: it will need to re-record its own reference frames for the text
  primitives, and to compare against the reference set for the processor type it runs on.

### 6. Non-negotiable constraints

- The Core Principles of the constitution, in particular Principle I (determinism), Principle III
  (pure, palette-only, CPU-only primitives) and Principle VI (one offline verify command).
- `npm run verify` stays offline: no network, database or external service.
- No runtime dependency is added; the three fonts ship under their own licences, recorded in
  `NOTICE`.
- Reference sets are replaced together or not at all, and every intended change is recorded in
  `golden/CHANGES.md`.
