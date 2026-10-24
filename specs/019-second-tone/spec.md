# Feature Specification: Second Tone

**Feature Branch**: `feature/019-second-tone`

**Created**: 2026-10-23

**Status**: Draft

**Input**: Issue #97 (a second foreground tone), planned for 0.7.0, unblocked by spec 020's palette roles contract. Maintainer decisions (2026-10-23):

- The second tone is the reserved role `fg2`, declared in the spec's `roles` map (spec 020). There is no new top-level field.
- Outside creative mode, or when no `fg2` colour is given, it draws a fixed mid grey (an even mix of background and foreground), so two tones stay distinguishable in black and white.
- Scope is the pattern letter `b`, which spec 018 reserved, on `grid` and `checker`.
- No constitution amendment was planned. During implementation the maintainer widened the palette gate's role rule to match the accent's (constitution 4.1.0; see research.md R5).

## User Scenarios & Testing *(mandatory)*

A two-tone design, such as the caller's quilt from #96/#97 (bone blocks, sand blocks and one gold element), needs three colours besides the background. Today a pattern has foreground and accent only. A second tone has to use up the accent, so nothing is left for the gold. Remapping colours afterwards in the caller is fragile, because accent and foreground then have to be told apart by hue.

### User Story 1 - Draw a second tone in a pattern (Priority: P1)

An author writes `b` in a `grid` or `checker` pattern and gives the spec `roles: { fg2: "#d8c8a0" }`. In creative mode the `b` cells draw in that colour, next to `#` (foreground) and `a` (accent) cells.

**Why this priority**: This is #97's request and the whole feature.

**Independent Test**: Render a solid grid with pattern `#b.a/b#.b` and `roles.fg2` in creative mode. Check that every `b` cell is exactly the `fg2` colour, every `#` cell the foreground, and every `a` cell the accent.

**Acceptance Scenarios**:

1. **Given** creative mode, `roles.fg2` set and a pattern with `b` cells, **When** a frame is rendered, **Then** every `b` cell is the `fg2` colour, and `#`, `a`, `.` and `~` cells draw as before.
2. **Given** the same spec with creative mode off, **When** a frame is rendered, **Then** every `b` cell is the mid grey, so `b` and `#` cells are distinguishable in black and white.
3. **Given** creative mode with no `fg2` in `roles`, **When** a frame is rendered, **Then** `b` cells are the mid grey.
4. **Given** a solid patterned grid with `b` cells, **When** a frame is rendered, **Then** every pixel is exactly one of: the background, the foreground, the accent, or the second tone (the `fg2` colour or the mid grey).
5. **Given** `b` cells at a quiet and at a loud signal, **When** both are rendered, **Then** the `b` cells look the same in both. Designed cells do not react to the signal.
6. **Given** a checker with `b` in its pattern, **When** a frame is rendered, **Then** `b` squares tile like the other letters and draw in the second tone.
7. **Given** any spec without `b` in a pattern, **When** it is rendered after this feature, **Then** every frame is byte-identical to before.

---

### User Story 2 - Models can use the second tone (Priority: P2)

A model writing a spec can see that `b` means the second tone and that `roles.fg2` colours it.

**Why this priority**: Most specs are written by models.

**Independent Test**: The `pattern` param descriptions on `grid` and `checker` name `b` and `fg2`, and a spec using them validates with no errors.

**Acceptance Scenarios**:

1. **Given** the vocabulary for `grid` or `checker`, **When** a model reads the `pattern` description, **Then** it lists `b` as the second tone, coloured by `roles.fg2` in creative mode.
2. **Given** a pattern with `b`, **When** it is validated, **Then** no problem is reported. The "reserved letter" report from spec 018 is gone.

### Edge Cases

- **`fg2` without any `b` cell**: harmless and not reported. It is just a role nobody reads.
- **`b` under breaks**: a broken `b` cell turns or moves like any designed cell. Under `solid` it is filled pixel row by pixel row, so its pixels stay exactly the second tone.
- **Transparent background**: `b` cells are opaque in the second tone. The mid grey is lifted like any other grey.
- **`fg2` equal to the foreground or the accent**: allowed. The cells simply look the same.
- **A spec written for 0.6.0 with `b`**: it rendered `b` as off. It now draws the second tone. This is the change spec 018 announced when it reserved the letter, and it is the only behaviour change for existing input.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pattern letter `b` on `grid` and `checker` MUST draw the second tone.
- **FR-002**: The second tone MUST be `roles.fg2` when creative mode is on and `fg2` is given, and the mid grey otherwise.
- **FR-003**: The mid grey MUST be a fixed even mix of the background and foreground: on black and on white, the colour `#808080`.
- **FR-004**: `b` cells MUST be designed cells. They are opaque, do not react to the signal, and honour `solid`, breaks and the transparent background exactly as `#` and `a` cells do.
- **FR-005**: Specs whose patterns contain no `b` MUST render byte-identically to before.
- **FR-006**: The validator MUST stop reporting `b` as reserved. `fg2` MUST be validated as an ordinary role by spec 020's rules.
- **FR-007**: The `pattern` descriptions MUST name `b` and `fg2`. The vocabulary version stays 13, because no primitive, tier or param bound changes.
- **FR-008**: The palette gate MUST probe `fg2` in its roles mode, and the patterned examples it probes MUST contain `b`.
- **FR-009**: Frames MUST stay a pure function of spec, signal and seed. The second tone MUST render identically twice and in chunks, and within the cross-type tolerance.
- **FR-010**: Every check MUST run inside the one offline verify command.

### Key Entities

- **Second tone (`fg2`)**: a reserved palette role, read by `grid` and `checker`. Its monochrome value is the mid grey.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical, in both reference sets.
- **SC-002**: In creative mode with `fg2`, 100% of `b` cells are exactly the `fg2` colour. In monochrome, 100% are exactly `#808080`.
- **SC-003**: A solid two-tone pattern has 0 pixels outside {background, foreground, accent, second tone}.
- **SC-004**: The verify command passes offline, and the automated build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a spec author or model**: three-tone designed patterns (two tones plus an accent), readable in black and white.

### In scope

- The meaning of `b` on `grid` and `checker`.
- The reserved role `fg2` and its mid-grey monochrome value.
- Descriptions, checks, reference cases, a showcase example and docs.

**Boundary change**: none. Spec 020's palette roles contract already allows named roles with a fixed bg–fg grey as their monochrome value. "The format" already includes `roles`. No new field, no new param and no export change. The Quality Gates palette row is restated (4.1.0) so a role, like the accent, may mix with both background and foreground.

### Out of scope

- **A second tone on other primitives**, or a second `threshold` on `grid`: later, if asked for.
- **A top-level `accent2` field**: rejected in favour of the roles contract.
- **Named palette profiles** (#102).

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure, chunk-stable, and within the cross-type tolerance.
- **Principle III (4.0.0)**: `b` colours only with the role `fg2` or its fixed bg–fg grey.
- **Principle IV**: a bad `fg2` is dropped and reported by spec 020's rules.
- **Principle V**: no existing frame moves. The `b` behaviour change for unrecorded 0.6.0 specs was announced by spec 018.
- **Principle VI**: one offline verify command.

## Assumptions

- **The mid grey is `#808080`.** It sits halfway between black and white, and is the same on either background.
- **`fg2` is the name.** It is short, reads as "foreground 2", and passes spec 020's role-name rule.
- **Scope source**: issue #97, spec 018's reservation of `b`, spec 020's roles contract, and the maintainer decisions of 2026-10-23.
