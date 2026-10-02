# Feature Specification: Vocabulary Version and Tiers

**Feature Branch**: `003-vocab-version-tiers` (not created; no branch hook is installed)

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: none typed. Chosen when asked: the roadmap's next spec, "Vocabulary version and tiers (PRD F7)". PRD F7 reads: "Specs carry a vocabulary version; replaced primitives keep rendering identically for specs that use them."

## User Scenarios & Testing *(mandatory)*

The vocabulary has no size limit, and better primitives are expected to replace older ones.
Two things are missing before that can happen safely.

A saved spec does not say which vocabulary it was written against, so once the vocabulary
moves on there is no way to tell what a spec expected. And every primitive is offered to a
model on equal terms, so there is no way to keep a stylistic, loosely reviewed, or replaced
primitive in the library without also putting it in front of a model.

This feature adds both: a vocabulary version recorded in every spec, and a tier on every
primitive that decides whether a model is offered it. It is scheduled before the package is
public because the version is part of the spec format. Adding it later would leave every
spec saved in the meantime without one.

### User Story 1 - Every saved spec says which vocabulary it was written against (Priority: P1)

An app developer validates a spec, from a person or from a model, and saves the result. The
saved spec records the vocabulary version it was written against. A year later, on a newer
library, the developer can read that version back and the spec renders the same frames.

**Why this priority**: The version is a change to the spec format, and the format is what
other people save. Every spec saved without a version is one that can never be given one
with certainty. This is the part that cannot wait until after the package is public.

**Independent Test**: Validate specs with and without a version, save the results, and
confirm each result carries a version, that the version survives a second validation
unchanged, and that the frames it renders are the same as before this feature.

**Acceptance Scenarios**:

1. **Given** a spec that records no version, **When** it is validated, **Then** the result records the library's current vocabulary version.
2. **Given** a spec that records a version the library knows, **When** it is validated, **Then** the result keeps that version.
3. **Given** a spec that records a version newer than the library has, **When** it is validated, **Then** the caller is told the spec was written against a newer vocabulary, layers the library does not know are dropped and reported as they are today, and the result records the library's current version.
4. **Given** a spec whose version is not a valid version at all, **When** it is validated, **Then** the caller is told, and the result records the library's current version.
5. **Given** any spec that validated before this feature, **When** it is rendered after this feature, **Then** every frame is byte-identical to before.
6. **Given** a model that is given the description of the spec format, **When** it authors a spec, **Then** it is not asked to supply a version; the version is recorded at validation.
7. **Given** the library, **When** a developer asks which vocabulary version it has, **Then** the answer is available from the library's public surface and from its documentation.

---

### User Story 2 - A model is offered only the primitives its tier allows (Priority: P2)

Someone building a model prompt asks for a selection of primitives. With no kit chosen, the
model is offered core primitives only. With a kit chosen, it is offered that kit, including
the kit's extended primitives. A contrib primitive is offered only when the caller names it.
A legacy primitive is never offered.

**Why this priority**: Tiers are what let the vocabulary grow past what a strict review can
cover without lowering the quality of what a model is shown. It follows the first story
because it changes no saved data: it can ship later without leaving anything behind.

**Independent Test**: Ask for selections with no kit, with each kit, and with primitives
named explicitly, across many seeds, and confirm the tier of every primitive offered is one
that request allows.

**Acceptance Scenarios**:

1. **Given** no kit is chosen, **When** a selection is made, **Then** every primitive offered is core.
2. **Given** a kit is chosen, **When** a selection is made, **Then** every primitive offered is core or is an extended primitive that belongs to that kit.
3. **Given** a kit is chosen and the selection is widened beyond the kit, **When** extra primitives are added, **Then** the extras are core.
4. **Given** a contrib primitive, **When** a selection is made without naming it, **Then** it is not offered, whatever the kit, breadth or seed.
5. **Given** a contrib primitive, **When** the caller names it, **Then** it is offered in addition to the rest of the selection.
6. **Given** a legacy primitive, **When** the caller names it, **Then** it is not offered and the caller is told why.
7. **Given** the same kit, breadth, seed and named primitives, **When** a selection is made twice, **Then** the two selections are identical.
8. **Given** any selection, **When** the vocabulary description and the format description for a model are generated from it, **Then** they contain exactly the primitives in the selection.
9. **Given** a spec that uses a contrib or legacy primitive, **When** it is validated and rendered, **Then** the layer is kept and drawn. Tiers limit what a model is offered, not what a spec may contain.

---

### User Story 3 - A primitive can be replaced without changing anyone's saved spec (Priority: P3)

A maintainer accepts a better version of a primitive. The replacement lands as a new
primitive beside the old one. The old one moves to the legacy tier and records what
replaced it. Specs that use the old primitive render exactly as they did, and no model is
offered it again.

**Why this priority**: This is the promise the version and the tiers exist to support, but
no primitive is waiting to be replaced today. It needs the first two stories and is
exercised here with a test primitive, so the path is proven before it is first needed.

**Independent Test**: With a test primitive standing in for a shipped one, mark it replaced,
and confirm that a spec using it renders byte-identical frames before and after, that it is
never offered in any selection, and that the library can say what replaced it.

**Acceptance Scenarios**:

1. **Given** a primitive that has been replaced, **When** a spec that uses it is rendered, **Then** every frame is byte-identical to the frames from before the replacement.
2. **Given** a primitive that has been replaced, **When** any selection is made, **Then** it is not offered and its replacement is eligible according to the replacement's own tier.
3. **Given** a primitive that has been replaced, **When** a developer looks it up, **Then** the library says it is legacy and names its replacement.
4. **Given** a replaced primitive, **When** the verify command runs, **Then** its reference frames are still compared, exactly as for any other primitive.
5. **Given** a primitive is moved to legacy, **When** the change is made, **Then** the vocabulary version rises.

---

### User Story 4 - The checks keep tiers and the version honest (Priority: P4)

A contributor adds a primitive or a maintainer changes a tier. The verify command tells them
if a primitive has no tier, if a kit offers something it must not, if a legacy primitive
does not say what replaced it, or if the vocabulary changed and the version did not.

**Why this priority**: Without checks, tiers and the version are conventions that drift. It
is last because it guards the first three stories and has nothing to check until they exist.

**Independent Test**: Introduce each rule violation on purpose, one at a time, and confirm
the verify command fails and names the primitive or kit at fault.

**Acceptance Scenarios**:

1. **Given** a primitive with no tier or an unknown tier, **When** the verify command runs, **Then** it fails and names the primitive.
2. **Given** a kit that lists a contrib or legacy primitive, **When** the verify command runs, **Then** it fails and names the kit and the primitive.
3. **Given** an extended primitive that belongs to no kit, **When** the verify command runs, **Then** it fails and names the primitive, because no model could ever be offered it.
4. **Given** a legacy primitive that names no replacement, or names one that does not exist, **When** the verify command runs, **Then** it fails and names the primitive.
5. **Given** a change that adds a primitive, adds a setting to one, or changes a tier, without raising the vocabulary version, **When** the verify command runs, **Then** it fails and says the version must rise.
6. **Given** a primitive in any tier, including contrib and legacy, **When** the verify command runs, **Then** it must pass every gate every other primitive passes.
7. **Given** unchanged code, **When** the verify command runs, **Then** it passes, offline, within the existing build budget.

---

### Edge Cases

- **Specs saved before this feature**: they record no version. They are treated as written against the vocabulary of the library that next validates them. This is safe because a primitive that still exists still renders the same.
- **A spec validated twice**: the version recorded the first time is kept the second time, even on a newer library.
- **A new setting on an existing primitive**: an older saved spec does not carry it. The setting's default must reproduce the old behaviour, or old specs change. The existing reference frames, which record default behaviour, are what catch this.
- **A category with no core primitive**: with no kit chosen, that category is not represented. Today one category has a single primitive, and it is extended.
- **Too few core primitives**: if core ever holds fewer primitives than a selection asks for, the selection returns the core primitives there are and does not fill up from other tiers.
- **Captions**: the caption primitive is always offered today. It must be core so that rule and the tier rule agree.
- **Naming an unknown primitive**: a caller who names a primitive that does not exist is told so; the rest of the selection is unaffected.
- **A replacement that is itself replaced**: the chain of replacements must end at a primitive that is not legacy.
- **Version in a model's output**: if a model supplies a version anyway, it is handled like any other supplied version.
- **Before the first public release**: the constitution still allows an existing primitive to be changed in place. This feature does not tighten that; it only makes the replace-beside path available.

## Requirements *(mandatory)*

### Functional Requirements

**Vocabulary version**

- **FR-001**: The library MUST have exactly one current vocabulary version, and MUST make it available from its public surface.
- **FR-002**: A spec MUST be able to record the vocabulary version it was written against.
- **FR-003**: Validation MUST produce a spec that records a vocabulary version in every case where it produces a spec.
- **FR-004**: A spec that records a version the library knows MUST keep it through validation.
- **FR-005**: A spec that records no version MUST be given the library's current version at validation.
- **FR-006**: A spec that records a version newer than the library's, or a value that is not a version, MUST be given the library's current version, and the caller MUST be told, in the same way as other rejected input.
- **FR-007**: The description of the spec format given to a model MUST NOT require the model to supply a version.
- **FR-008**: The vocabulary version MUST rise whenever a primitive is added, a setting or allowed value is added to a primitive, or a primitive changes tier.
- **FR-009**: Recording or reading a version MUST NOT change what any spec renders.

**Tiers**

- **FR-010**: Every primitive MUST carry exactly one tier: core, extended, contrib or legacy.
- **FR-011**: With no kit chosen, a selection MUST contain core primitives only.
- **FR-012**: With a kit chosen, a selection MUST contain only core primitives and extended primitives that belong to that kit. Primitives added to widen the selection beyond the kit MUST be core.
- **FR-013**: A contrib primitive MUST be offered only when the caller names it.
- **FR-014**: A legacy primitive MUST NOT be offered in any selection. A caller who names one MUST be told it is legacy.
- **FR-015**: A selection MUST remain a pure function of what the caller asks for: the same kit, breadth, seed and named primitives give the same selection.
- **FR-016**: The vocabulary description and the format description generated for a selection MUST contain exactly the primitives in that selection.
- **FR-017**: Validation and rendering MUST accept a primitive of any tier.
- **FR-018**: The tier of every primitive MUST be visible to people: from the library's public surface and in the project's documentation.
- **FR-019**: Each of today's 29 primitives MUST be assigned core or extended. No shipped primitive starts as contrib or legacy.

**Replacement**

- **FR-020**: A legacy primitive MUST record which primitive replaced it, and the library MUST be able to report that.
- **FR-021**: A spec that uses a legacy primitive MUST render byte-identical frames to those it rendered before the primitive became legacy.
- **FR-022**: A legacy primitive MUST keep its reference frames, and they MUST be compared on every run of the verify command.

**Checks**

- **FR-023**: The verify command MUST fail, naming what is at fault, when: a primitive has no valid tier; a kit lists a contrib or legacy primitive; an extended primitive belongs to no kit; a legacy primitive has no existing replacement; or a chain of replacements does not end at a primitive that is not legacy.
- **FR-024**: The verify command MUST fail when the vocabulary has changed in a way FR-008 covers and the version has not risen.
- **FR-025**: Primitives of every tier MUST pass every existing gate.
- **FR-026**: All checks MUST continue to run with no network, database or external service, within the existing build budget.

**What must not change**

- **FR-027**: No reference frame in any reference set may change as a result of this feature.
- **FR-028**: The tier and version rules MUST have one source, from which the selection, the generated descriptions and the checks are all derived.

### Key Entities

- **Vocabulary version**: a number that identifies the vocabulary at a point in time. The library has one current version; a spec records the one it was written against.
- **Tier**: the label on a primitive that decides whether a model is offered it. One of core, extended, contrib, legacy.
- **Kit**: a named group of primitives chosen for a style. An extended primitive is offered only through a kit it belongs to.
- **Selection**: the bounded set of primitives shown to a model for one request, decided by kit, breadth, seed and any primitives the caller names.
- **Replacement record**: on a legacy primitive, the name of the primitive that replaced it.
- **Vocabulary record**: what the vocabulary contained at the current version, kept so that a change without a version rise can be detected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of specs that pass validation record a vocabulary version.
- **SC-002**: A spec validated, saved, and validated again keeps the same version in 100% of cases.
- **SC-003**: 29 of 29 shipped primitives carry exactly one tier, and each is core or extended.
- **SC-004**: Across at least 1,000 selections with no kit chosen, over varied seeds and breadths, 0 offered primitives are extended, contrib or legacy.
- **SC-005**: For every kit, across at least 1,000 selections, 0 offered primitives are contrib or legacy, and 0 are extended primitives from outside that kit.
- **SC-006**: 0 reference frames change in either reference set.
- **SC-007**: With a test primitive marked as replaced, a spec that uses it renders byte-identical frames before and after (100% of frames), and it is offered in 0 selections.
- **SC-008**: Each of the six rule violations in FR-023 and FR-024 is caught when introduced on purpose (6 of 6), and each failure names what is at fault.
- **SC-009**: The verify command passes on unchanged code, offline, and the automated build stays under two minutes.
- **SC-010**: A reader can find the current vocabulary version and the tier of any primitive in the project's documentation in under one minute.

## Boundaries *(mandatory, constitution Principle VII)*

The fifth entry, assumptions, is the Assumptions section below.

### Outcome

- **For an app developer**: every validated spec records the vocabulary it was written against, and keeps rendering the same frames as the vocabulary grows.
- **For someone building a model prompt**: a model is offered only primitives whose tier allows it.
- **For a maintainer**: a primitive can be replaced by a better one without changing any saved spec.

### In scope

- A vocabulary version in the spec format and on the library's public surface.
- Recording the version at validation, and reporting a version the library does not know.
- A tier on every primitive, and the initial tier of each of the 29 shipped primitives.
- Tier rules in selection, including naming contrib primitives explicitly.
- A replacement record on legacy primitives.
- Checks in the verify command for the tier and version rules.
- Documentation of the version and of each primitive's tier.
- Updating the roadmap and, where the wording of Principle V or the tier table needs it, the constitution.

**Boundary change**: none. Everything above falls under the format, the vocabulary,
validation, selection, verification and governance entries of the project baseline. No new
dependency, service, platform or kind of output is added.

### Out of scope

- **Removing a primitive, and migrating old specs to its replacement.** The constitution allows this only at a major version. It belongs to the feature that first removes a primitive. This feature records enough for that migration to be written later.
- **Replacing any shipped primitive.** No shipped primitive becomes legacy here. The replacement path is exercised with a test primitive only.
- **Refusing in-place changes to released primitives.** After the first public release the constitution forbids them. Enforcing that stays with review and the reference-frame change log; it is not automated here.
- **A private or premium pack of extended primitives, and registering primitives from outside the library.** Decided 2026-10-01: the extended tier is public and lives in this repository.
- **Choosing primitives by similarity to the prompt.** The PRD expects this alongside kits once the vocabulary is large. It is held by a later feature.
- **Measuring model spec quality as the vocabulary grows.** Held by the private project.
- **Adding, removing or re-tuning kits.** Kit contents change only where a tier rule forces it. Re-tuning is the roadmap's later kit feature.
- **Storing specs, and re-stamping specs already saved elsewhere.** Held by the caller.
- **The style review that decides a primitive's tier.** A human decision; this feature records its result.
- **The publishable package and the contribution rules.** Roadmap specs 004 and 005.

### External dependencies

- None added. The feature uses the existing registry, validator, selection and verify command.
- **Private product**: not a dependency of this feature, but affected by it. Its model prompts change, because the same kit, breadth and seed now give a different selection. Its saved specs gain a version the next time they are validated. Its reference frames do not move.
- **Product intent**: PRD requirement F7 and the PRD's sections on tiers and on replacing and retiring primitives.

### Non-negotiable constraints

- **Principle I**: no reference frame moves; selection stays deterministic.
- **Principle II**: tier and version rules have one source. No second list is kept in step by hand.
- **Principle IV**: the version is untrusted input like the rest of a spec. Anything rejected is reported, never silently discarded. A model is still shown a bounded selection.
- **Principle V**: a replacement lands beside the primitive it replaces; a replaced primitive is still rendered and never offered; each spec records its vocabulary version.
- **Principle VI**: every new check runs inside the one verify command, offline, within the build budget.
- **Complexity**: no new runtime dependency, and no mechanism for removal or migration is built ahead of need.

## Assumptions

- **Scope source**: no description was typed with the command. The scope is the roadmap entry for spec 003 and PRD requirement F7.
- **Extended tier is public**: decided 2026-10-01 when asked. This closes the roadmap's open decision that blocked this spec.
- **Version scheme**: a whole number, starting at 1 for the vocabulary as it stands when this feature ships, rising by one with each change FR-008 covers. It is separate from the package's own version number. Removal of a primitive is tied to a major release of the package, not to this number.
- **Counting starts now**: the version rises with vocabulary changes from this feature onward, including before the first public release, so the mechanism is exercised before anything depends on it.
- **Specs with no version**: stamped with the validating library's current version. A model-authored spec is new, so this is right for it. For a spec saved before this feature it may be later than the truth, which is harmless: a primitive that still exists still renders the same, and one that does not is dropped and reported whatever the version says.
- **Older versions need no special handling yet**: within the vocabulary's life so far nothing has been removed, so a spec with any earlier version renders as is. What to do with a spec older than a removal is decided by the feature that first removes a primitive.
- **Initial tiers**: sprite, tetris and plasma are extended, as the PRD names them. Gridhorizon and tunnel are assumed extended as well, because like plasma they appear only in the retro kit. The other 24 are core. Confirmed by the maintainer on 2026-10-01.
- **Selection output changes**: for the same kit, breadth and seed, the selection after this feature differs from before, because extended primitives leave the no-kit selection and the extras. This is intended. Selection results are not recorded in reference frames.
- **Naming contrib primitives**: the caller names them as part of the selection request. A model cannot ask for one.
- **Tiers do not restrict hand-written specs**: a person may use any primitive that exists, in any tier.
- **Kits may mix tiers**: a kit holds core and extended primitives. An extended primitive may belong to more than one kit.
- **Pre-release allowance stands**: until the first public release, Principle V still permits changing a primitive in place. This feature adds the replace-beside path without withdrawing that allowance.
