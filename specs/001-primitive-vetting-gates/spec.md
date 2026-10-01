# Feature Specification: Complete the Primitive Vetting Gates

**Feature Branch**: `001-primitive-vetting-gates`

**Created**: 2026-09-30

**Status**: Implemented and merged to `main` on 2026-10-01

**Input**: User description: none typed. Taken from the preceding discussion: "Finish milestone M0: add the vetting gates that are still missing, and fix the existing primitives those gates would catch, so that all 29 primitives pass every gate."

## User Scenarios & Testing *(mandatory)*

The project promises that the same spec, signal and seed always produce the same frame, and
that every primitive in the vocabulary follows the same rules. Today four of those rules are
written down but not checked automatically: a primitive must not touch files or the network
while drawing, must colour only from the palette, must respond to the signal, and must stay
within a speed budget. This feature turns each rule into an automatic check and brings the
existing primitives into line, so the first project gate ("all 29 primitives pass every
gate") can be passed.

### User Story 1 - Drawing never touches files or the network (Priority: P1)

A contributor writes a primitive that reads a file, or calls out to the network, while
drawing a frame. When they run the project's verify command, it fails and tells them which
primitive broke the rule. Separately, an app developer who installs the package and runs it
from their own project folder gets the same icon and sprite output as the project's own
checks do, because drawing no longer depends on where the program was started.

**Why this priority**: This is the only rule whose violation breaks the core promise
outright, since a frame that depends on the disk or the network is not a pure function of its
inputs. It also blocks publishing the package, because icon-based primitives currently work
only when run from the repository root.

**Independent Test**: Run the verify command against a primitive that deliberately reads a
file while drawing and confirm it is rejected by name. Then render the icon-based primitives
from two different working folders and confirm the frames are identical.

**Acceptance Scenarios**:

1. **Given** a primitive that reads a file while drawing, **When** the verify command runs, **Then** it fails and names that primitive and the rule it broke.
2. **Given** a primitive that opens a network connection while drawing, **When** the verify command runs, **Then** it fails and names that primitive and the rule it broke.
3. **Given** the LED sign (`led`) and sprite (`sprite`) primitives showing a named icon, **When** they are rendered from the repository root and from an unrelated folder, **Then** both renders are identical to each other and to today's output.
4. **Given** an icon name that does not exist, **When** a primitive is asked to draw it, **Then** it falls back exactly as it does today, without error and without touching the disk during drawing.

---

### User Story 2 - Every pixel comes from the palette (Priority: P2)

A contributor writes a primitive that paints a colour of its own choosing, such as a fixed
red. When they run the verify command, it fails and tells them which primitive produced a
colour outside the palette. A developer who recolours a spec by changing only its background
and accent can rely on every primitive following that change.

**Why this priority**: Palette discipline is what lets any spec be recoloured or reduced to
black and white without knowing which primitives it uses. It is a published rule with no
check behind it.

**Independent Test**: Run the verify command against a primitive that paints a fixed
off-palette colour and confirm it is rejected by name. Confirm all 29 existing primitives pass
on both backgrounds, with and without an accent colour.

**Acceptance Scenarios**:

1. **Given** a primitive that paints a colour that is not a mix of the supplied background, foreground and accent, **When** the verify command runs, **Then** it fails and names that primitive.
2. **Given** a monochrome render, where the accent equals the foreground, **When** any primitive is drawn, **Then** every pixel is a shade between the background and the foreground.
3. **Given** a render with a distinct accent colour, **When** primitives are layered together, including one that inverts the frame on loud moments, **Then** every pixel is still a mix of the three palette colours.
4. **Given** the same spec on a black background and on a white background, **When** it is rendered, **Then** the check passes on both.

---

### User Story 3 - Every primitive responds to its signal (Priority: P3)

A contributor writes a primitive that draws the same picture no matter what the signal is.
When they run the verify command, it fails and tells them the primitive does not respond.
Today this is only reported as information, does not stop a contribution, and is fooled by
primitives that merely move with the clock, because its quiet and loud samples are also taken
at different moments.

**Why this priority**: A primitive that ignores the signal is decoration, which the style
rules exclude. The measurement already exists; it only needs to become a pass or fail check
with a fair rule for text primitives.

**Independent Test**: Run the verify command against a primitive that ignores its inputs and
confirm it is rejected. Confirm the caption and large-text primitives pass because their
output changes when the text they are given changes.

**Acceptance Scenarios**:

1. **Given** a primitive whose output at a fixed moment is identical for a near-silent signal and a loud one, and identical for different text, **When** the verify command runs, **Then** it fails and names that primitive.
2. **Given** a primitive whose picture changes between a near-silent and a loud signal, **When** the verify command runs, **Then** it passes this check.
3. **Given** the caption (`caption`) and large-text (`text`) primitives, whose picture depends on the text carried by the signal and not on loudness, **When** the verify command runs, **Then** they pass because different text produces a different picture.
4. **Given** the sweeping-bar (`sweep`) and perspective-grid (`gridhorizon`) primitives, which today move only with the clock, **When** this feature is complete, **Then** loudness visibly affects each of them and they pass the check.

---

### User Story 4 - Every primitive stays within the speed budget (Priority: P4)

A contributor writes a primitive that issues tens of thousands of drawing operations per
frame. When they run the verify command, it fails and shows the measured amount against the
allowed amount. An app developer layering several primitives can rely on each one being cheap
enough to combine.

**Why this priority**: Only one existing primitive is over budget, so the present risk is
small, but without a check the cost of the vocabulary grows unnoticed as it heads to 100
primitives.

**Independent Test**: Run the verify command against a primitive that issues far more drawing
operations than allowed and confirm it is rejected with the measured and allowed figures.
Confirm all 29 existing primitives pass at full-HD size.

**Acceptance Scenarios**:

1. **Given** a primitive that issues more than 3,000 drawing operations for one full-HD frame at its default settings, **When** the verify command runs, **Then** it fails and reports the measured count and the limit.
2. **Given** a primitive that takes longer than 50 milliseconds to draw one full-HD frame, **When** the verify command runs, **Then** it fails and reports the measured time and the limit.
3. **Given** the plasma primitive, which today issues 32,400 drawing operations per full-HD frame, **When** this feature is complete, **Then** it is within budget and draws exactly the same picture as before.
4. **Given** the same code on the same machine, **When** the verify command is run repeatedly, **Then** the speed check gives the same verdict every time.
5. **Given** any run of the verify command, **When** the speed check finishes, **Then** the measured time of every primitive is shown, whether or not it failed.

---

### User Story 5 - One command proves the vocabulary is clean (Priority: P5)

The maintainer needs evidence that the first project gate is met before starting the
go-public work. They run the verify command once and read a summary stating how many
primitives pass every gate. The project's documentation shows the same picture: which rules
are enforced.

**Why this priority**: It adds no new protection on its own, but it is the evidence the
roadmap asks for and it keeps the documentation honest once the other stories land.

**Independent Test**: Run the verify command and confirm the output ends with a count of
primitives passing every gate, and that the documented list of gates matches what the command
actually checks.

**Acceptance Scenarios**:

1. **Given** all checks pass, **When** the verify command finishes, **Then** it states that 29 of 29 primitives pass every gate.
2. **Given** one primitive fails one check, **When** the verify command finishes, **Then** the summary shows the reduced count and the command reports failure.
3. **Given** this feature is complete, **When** a reader opens the project's list of quality gates, **Then** each of the four rules is shown as enforced, not planned.

---

### Edge Cases

- **Reduced flicker**: a full-frame flash is the one effect here that can strobe. With the reduced-flicker setting on it must be gentle, but it must still respond to loud moments, or it would fail the signal check.
- **Smooth edges and translucency**: lines and text have softened edges, and some primitives draw translucent shapes. These produce in-between shades, which must count as palette colours and not as violations.
- **Effects that invert the frame**: an inversion over an accent-coloured area produces the accent's opposite colour, which is outside the palette. The check must catch this in layered renders, not only when a primitive is drawn alone.
- **Primitives that draw nothing on a quiet signal**: an empty frame on silence is valid as long as a louder signal produces a different picture.
- **Primitives that need text or position data**: a primitive given no text draws nothing. Checks must supply text and position data so such primitives are judged on real output.
- **Slow or busy machines**: a time measurement varies between machines and runs. The check must not fail a compliant primitive because the machine was busy.
- **Icons that are not in the library**: an unknown icon name must keep its current fallback and must not cause disk access during drawing.
- **Settings at their extremes**: a primitive within budget at default settings may exceed it at its maximum settings. The budget applies at default settings; extremes are out of scope here.
- **Intended versus accidental change**: fixing a primitive changes its reference output. Any primitive whose output changes without being named as an intended change must fail the existing reference comparison.

## Clarifications

### Session 2026-09-30

- Q: Two primitives (the sweeping bar and the perspective grid) move only with the clock and draw the same picture for a silent and a loud signal at the same moment. How should the signal check treat them? → A: Strict. Time is held fixed and only the signal varies; both primitives are changed so loudness affects them.
- Q: How should the speed check use time, given that shared build machines are slower and less steady than a laptop? → A: The drawing-operation limit is the blocking check. Time is reported for every primitive and fails only above 50 milliseconds.

### Session 2026-10-01

- Q: The frame-inverting flash ignores the reduced-flicker (photosensitivity) setting. Should this feature fix that? → A: Yes. With reduced flicker on, the flash softens to a gentle wash. Its reference output for the loud case changes.
- Q: Do the reference frames match on the automated build machine? → A: No. A run on the Linux build machine failed the existing reference comparison for several primitives, including ones that draw no text. That is a separate problem with its own roadmap entry; this feature's four new checks are judged on their own verdicts there.

## Requirements *(mandatory)*

### Functional Requirements

**Running the checks**

- **FR-001**: The project's single existing verify command MUST run every check described here in addition to the checks it runs today.
- **FR-002**: All checks added by this feature MUST run with no network, database or external service, and MUST give the same verdict locally and in automated builds.
- **FR-003**: Every check MUST apply automatically to each primitive in the vocabulary, including primitives added later, with no per-primitive setup by the contributor.
- **FR-004**: When a check fails, the output MUST name the primitive, name the rule, and state what was measured against what is allowed.

**No file or network access while drawing**

- **FR-005**: The verify command MUST fail if any primitive reads or writes a file, or uses the network, while drawing a frame.
- **FR-006**: Primitives that show named icons MUST draw them without any file access during drawing.
- **FR-007**: Icon-based output MUST be identical regardless of the folder the program is started from.
- **FR-008**: Icon-based output for every icon name MUST be pixel-identical to the output before this feature, including the fallback for unknown names.

**Palette only**

- **FR-009**: The verify command MUST fail if any pixel a primitive produces is not a mix of the supplied background, foreground and accent colours.
- **FR-010**: The palette check MUST cover both backgrounds, monochrome and accent-coloured renders, and layered renders as well as primitives drawn alone.
- **FR-011**: Existing primitives that fail the palette check MUST be corrected so they pass.
- **FR-023**: The frame-inverting flash MUST soften to a gentle wash when the reduced-flicker setting is on, and MUST keep its full-strength monochrome behaviour unchanged when that setting is off.

**Responds to the signal**

- **FR-012**: The verify command MUST fail if a primitive's output is unchanged across differing signal inputs taken at the same moment in time, so that movement with the clock alone does not count.
- **FR-013**: A primitive MUST be considered responsive if its output changes with signal level or with the text the signal carries.
- **FR-022**: Existing primitives that fail the signal check MUST be corrected so that loudness affects what they draw.

**Speed budget**

- **FR-014**: The verify command MUST fail if a primitive issues more than 3,000 drawing operations for one full-HD frame at default settings.
- **FR-015**: The verify command MUST report the time each primitive takes to draw one full-HD frame at default settings, and MUST fail only if a primitive exceeds 50 milliseconds.
- **FR-016**: The time check MUST give the same verdict on repeated runs of unchanged code on the same machine.
- **FR-017**: Existing primitives over budget MUST be brought within it without changing what they draw.

**Protecting existing output**

- **FR-018**: A primitive not named as an intended change MUST produce output byte-identical to its output before this feature.
- **FR-019**: Each intended change to a primitive's output MUST be recorded with the primitive's name and the reason, alongside its updated reference output.

**Evidence**

- **FR-020**: The verify command MUST end with a summary of how many primitives pass every gate out of the total.
- **FR-021**: The project's documented list of quality gates MUST show each of the four rules as enforced once its check is in place.

### Key Entities

- **Primitive**: one named drawing building block in the vocabulary, with declared settings and defaults. The unit every gate judges.
- **Gate**: an automatic pass or fail check applied to every primitive. This feature adds four: no file or network access, palette only, responds to the signal, within the speed budget.
- **Palette**: the three colours a frame may use, namely background, foreground and accent. In monochrome renders the accent equals the foreground.
- **Signal frame**: the numbers and optional text that drive one frame. Checks use fixed reference frames ranging from near-silent to loud.
- **Reference output**: the recorded fingerprint of each primitive's frames, used to detect any change in what is drawn.
- **Speed budget**: the per-frame allowance for one primitive at full-HD size and default settings, expressed as a count of drawing operations and a time.
- **Icon library**: the named pixel icons that the LED sign and sprite primitives can show.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: One run of the verify command reports that 29 of 29 primitives pass every gate.
- **SC-002**: A deliberately rule-breaking primitive is rejected for each of the four rules (4 of 4), and each rejection names the primitive and the rule.
- **SC-003**: At least 26 of the 29 primitives produce exactly the same monochrome frames as before this feature, and every primitive that changed is listed with its reason.
- **SC-004**: Icon-based primitives produce identical frames when run from two different folders, for 100% of the icon cases checked.
- **SC-005**: No primitive issues more than 3,000 drawing operations per full-HD frame at default settings; the heaviest drops from 32,400 to within the limit.
- **SC-006**: Ten consecutive runs of the verify command on unchanged code give the same verdict ten times.
- **SC-007**: The full verify command finishes in under one minute on a developer laptop, and the automated build stays within the project's two-minute budget.
- **SC-008**: A contributor can tell from a failure message alone which primitive to fix and which rule it broke, without reading the check's source.

## Assumptions

- **Scope source**: no description was typed with the command, so the scope is the remaining milestone M0 work agreed in the preceding discussion and in the product requirements document.
- **Meaning of "palette only"**: a pixel complies if it is a mix of the three palette colours. Shades between background and foreground therefore comply, which keeps softened edges, translucent shapes and the grey tones that several primitives use by design. A stricter reading (the three exact colours and nothing else) would rule out smooth edges and is not intended.
- **Meaning of "responds to the signal"**: the text a signal carries counts as part of the signal. Caption and large-text primitives therefore comply by changing with their text, and are not required to pulse with loudness. The passage of time does not count as signal.
- **Speed budget values**: 3,000 drawing operations comes from the product requirements and is the blocking limit, because a count is exact and repeatable. Time is reported for every primitive and blocks only above 50 milliseconds, which catches gross regressions without failing a compliant primitive on a slow machine. Measured today, 28 of 29 primitives draw a full-HD frame in under 5 milliseconds.
- **Budget conditions**: the budget is judged at full-HD size with each primitive's default settings and a loud reference signal. Behaviour at maximum settings is not covered.
- **Expected intended changes**: the sweeping bar and the perspective grid (so loudness affects them), and the frame-inverting flash, which softens under the reduced-flicker setting and washes instead of inverting when layered over accent colour (its full-strength monochrome output is unchanged). Plasma is brought within budget with no change to its output. If other primitives turn out to need changes, each is recorded as an intended change.
- **Pre-release status**: no specs have been published against this vocabulary yet, so changing existing primitives in place is acceptable for this feature. Once vocabulary versioning exists, such changes go through replacement instead.
- **Reference machine**: time limits are judged on an ordinary developer laptop and on the standard hosted build machine; no special hardware is assumed.
- **Out of scope**: vocabulary versioning and tiers, the command-line renderer, the gallery and thumbnails, public build triggers, the human style review, and recording the open-source decision in the private project.
- **Dependencies**: the existing registry, validator and determinism checks stay as they are and continue to pass on the developer machine that recorded the reference frames.
- **Reference frames on other machines**: the existing reference comparison does not yet pass on the Linux build machine. Fixing that is out of scope here and tracked on the roadmap; until then the automated build cannot be fully green.
