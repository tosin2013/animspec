# Feature Specification: Sprite Palette Roles

**Feature Branch**: `feature/020-sprite-palette-roles`

**Created**: 2026-10-23

**Status**: Draft

**Input**: Issue #103 (SNES-era sprites: per-letter colours and larger bitmaps), blocked at the
0.4.0 triage on Principle III. Maintainer decisions (2026-10-23): #103 goes ahead of #107;
Principle III is amended once, generically, to a *palette roles* contract that spec 019 (#97,
second tone) can reuse without a further amendment; a spec-level `roles` map honoured only in
creative mode; sprite character format v2 with a per-letter palette; a 32 × 48 ceiling; one
new demo character; every existing frame byte-identical. The `snes` quantizer profile and the
second tone are out of scope.

## User Scenarios & Testing *(mandatory)*

The `sprite` primitive draws built-in characters (`mascot`, `bot`, `ghost`) from small text
bitmaps in three fixed greys: dark outline, body, highlight. That reads well in black and white
and quantizes cleanly, but a 16-bit-era character needs more: hair, skin, eyes, a gold trim, a
cloak, boots, each in its own colour, on a bitmap larger than 11 pixels. A caller prototyped
this in their own host layer (#103) and it read as an SNES-era RPG sprite over an animspec
background. The gap is that core cannot draw it: Principle III allows only background,
foreground and accent.

### User Story 1 - Colour a character by role (Priority: P1)

A spec author turns creative mode on and gives the spec a small map of named colours (for
example `hair`, `skin`, `cloak`). A sprite whose character declares those roles draws each part
of its bitmap in the named colour. With creative mode off, or with no colour given for a role,
the same character draws in the familiar three greys and reads in pure black and white.

**Why this priority**: It is #103's core request, and the reason for the amendment. Without it
nothing in this spec is visible.

**Independent Test**: Render the new `hero` character with creative mode on and a full role
map. Every bitmap cell shows the colour of its letter's role. Then render it with creative mode
off. Every cell shows its letter's monochrome shade.

**Acceptance Scenarios**:

1. **Given** creative mode on and a spec `roles` map giving a colour for every role the `hero` declares, **When** a frame is rendered, **Then** every bitmap cell is drawn in the colour of its letter's role, and no other colour appears in the sprite.
2. **Given** the same spec with creative mode off, **When** a frame is rendered, **Then** every bitmap cell is drawn in its letter's monochrome shade (dark, body or highlight), exactly as a legacy character's shades are drawn.
3. **Given** creative mode on and a `roles` map that names only some of the hero's roles, **When** a frame is rendered, **Then** the named roles take their colours and the rest fall back to their monochrome shades.
4. **Given** a letter mapped to one of the built-in roles (`bg`, `fg`, `accent`), **When** a frame is rendered, **Then** that cell takes the spec's background, foreground or accent, as any other primitive does.
5. **Given** any existing character (`mascot`, `bot`, `ghost`) or pixel-icon sprite, with or without a `roles` map and in either mode, **When** it is rendered after this feature, **Then** every frame is byte-identical to before.

---

### User Story 2 - Author larger, safer characters (Priority: P2)

A contributor adds a new character to the library. It can be up to 32 cells wide and 48 tall,
declares a palette for every letter it uses, and verify catches a typo before it ships: a
letter with no declared role, a frame of the wrong size, or a bitmap past the ceiling.

**Why this priority**: The format has to be safe to extend. Today an unknown letter silently
draws in the foreground colour. #103 asks for that to become an error.

**Independent Test**: Run verify against a fixture character containing an undeclared letter.
Verify fails and names the character, pose, frame and letter. Remove the letter and verify
passes.

**Acceptance Scenarios**:

1. **Given** a v2 character with a letter its palette does not declare, **When** verify runs, **Then** it fails and names the character, pose, frame and letter.
2. **Given** a character whose frames differ in width or height, **When** verify runs, **Then** it fails and names the frame that differs.
3. **Given** a v2 character wider than 32 or taller than 48 cells, **When** verify runs, **Then** it fails.
4. **Given** a v2 palette entry whose monochrome shade is not one of dark, body or highlight, **When** verify runs, **Then** it fails.
5. **Given** the legacy characters, **When** verify runs, **Then** they pass unchanged: the frame-size rule already holds for them, and the palette rules apply only to v2 characters.

---

### User Story 3 - A demo character and a model-readable contract (Priority: P3)

A model writing a spec from the vocabulary prompt and schema can find the `hero` character, the
roles it declares, and the spec-level `roles` map, and can write a creative spec that colours
it.

**Why this priority**: Most specs are written by models. A role a model cannot read about is
barely there.

**Independent Test**: The vocabulary prompt lists `hero` among the characters, with its role
names. The schema describes `roles`. A spec a model would plausibly write validates and
renders in colour.

**Acceptance Scenarios**:

1. **Given** the vocabulary prompt for a selection that includes `sprite`, **When** a model reads it, **Then** `hero` is listed with its role names.
2. **Given** the JSON schema, **When** a model reads it, **Then** `roles` is described as a map of up to 16 role names to hex colours, honoured only in creative mode.
3. **Given** the vocabulary record, **When** this feature ships, **Then** the vocabulary version stays 13, because the vocabulary record covers primitives, tiers and params and none of them changes (a new character is a value of the existing `character` string param), and the generated vocabulary document reflects the changed `sprite` description.

---

### Edge Cases

- **`roles` without creative mode**: accepted and kept, but ignored at render time. The frame is
  monochrome, as with `accent` today.
- **A role named in `roles` that no layer uses**: harmless and not reported. A spec may serve
  several characters.
- **An invalid colour or role name in `roles`**: the entry is dropped and reported, and the rest
  of the map is kept (the same pattern as an invalid `accent`).
- **More than 16 roles**: the first 16 by sorted name are kept and the rest dropped and
  reported. The result does not depend on the order the keys were written in.
- **Role names that shadow built-ins** (`bg`, `fg`, `accent`) in `roles`: dropped and reported.
  The built-ins come from `background`, `ink` and `accent`.
- **Transparent background** (spec 017): role-coloured cells are opaque, and empty cells
  (`.`) stay transparent.
- **Black versus white background in monochrome**: v2 dark cells follow the legacy rule
  (a dark grey on black, the foreground on white), so a v2 character in monochrome reads like a
  legacy one.
- **Facing, poses, jump, idle, camera, bind**: unchanged for v2 characters.
- **Scale**: a 32 × 48 character at the maximum `scale` may be larger than the frame. It is
  clipped, as an oversize legacy sprite is today.
- **Pixel-icon fallback**: unchanged. An icon sprite has no palette.

## Requirements *(mandatory)*

### Functional Requirements

**Palette roles (the amendment)**

- **FR-001**: A primitive's drawing MUST colour only with palette roles: the built-in `bg`, `fg` and `accent`, and the named roles a spec declares.
- **FR-002**: Outside creative mode, every named role MUST resolve to a monochrome value (the foreground, or a fixed mix of background and foreground), so output stays monochrome by default and reads in pure black and white.
- **FR-003**: In creative mode, a named role MUST resolve to the spec's colour for it when one is given, and otherwise to its monochrome value.
- **FR-004**: The roles contract MUST be general (not sprite-specific), so a later spec (019, second tone) can add a role without amending Principle III again.

**Spec format**

- **FR-005**: A spec MUST accept an optional `roles` map from role names to hex colours. Names are lowercase letters, digits and `-`, start with a letter, and are at most 16 characters long. The map holds at most 16 entries.
- **FR-006**: Invalid entries, names that shadow `bg`, `fg` or `accent`, and entries beyond 16 (the first 16 kept by sorted name) MUST be dropped and reported, and the rest of the spec MUST still validate.
- **FR-007**: A spec without `roles` MUST render byte-identically to before this feature.

**Sprite character format v2**

- **FR-008**: A built-in character MAY declare a palette: one entry for each bitmap letter, giving the role the letter takes and the monochrome shade (dark, body or highlight) it falls back to.
- **FR-009**: A character without a palette MUST render byte-identically to before this feature, whatever the spec's roles and mode.
- **FR-010**: Every letter in every frame of a v2 character MUST be declared in its palette, or be `.` (transparent). Verify MUST fail on an undeclared letter and name its character, pose, frame and letter.
- **FR-011**: A v2 character MUST be at most 32 cells wide and 48 tall. Every frame of every pose in any character MUST share one width and height. Verify MUST fail otherwise.
- **FR-012**: The library MUST gain one v2 character, `hero`: about 16 × 20 cells, a two-frame walk, and about ten roles (for example hair, a hair highlight, skin, eyes, gold trim, cloak, boots and outline). It is authored from the behaviour #103 describes, and no code is copied from the issue.

**Gates and records**

- **FR-013**: The palette gate MUST accept, in addition to today's background, foreground and accent mixes, mixes of the background with each declared role colour. It MUST NOT widen the tolerance or the existing rule. The `hero` MUST be probed in monochrome and with probe role colours.
- **FR-014**: Frames MUST stay a pure function of spec, signal and seed. The `hero` MUST render identically twice and in chunks, and within the cross-type tolerance.
- **FR-015**: New reference cases MUST record the `hero` in monochrome and in creative mode, in both reference sets. Every existing reference frame MUST stay unchanged.
- **FR-016**: The vocabulary prompt and the JSON schema MUST describe `hero`, its role names and the `roles` map. The vocabulary version MUST stay 13: the vocabulary record's rule (primitives, tiers and params) refuses a bump when none of them changes. (Amended during implementation; the draft said the version would rise by one.)
- **FR-017**: The constitution MUST be amended in the same change: Principle III's colour rule and its rationale, the baseline's "The format" entry (for `roles`), and an amendment note with a version bump.
- **FR-018**: Every check MUST run inside the one offline verify command.

### Key Entities

- **Palette role**: a named colour slot. `bg`, `fg` and `accent` are built in, and further names are declared by a spec. Every role has a monochrome value and, in creative mode, may have a colour.
- **Roles map**: the spec-level list of named roles and their colours.
- **Character palette (v2)**: per character, for each bitmap letter, the role it draws in and the grey it falls back to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical after this feature, in both reference sets.
- **SC-002**: In creative mode with a full role map, 100% of the `hero`'s non-transparent cells are exactly their role's colour.
- **SC-003**: With creative mode off, 0 pixels of a `hero` frame fall outside the background–foreground mix. The monochrome frame reads in pure black and white.
- **SC-004**: Each authoring error (undeclared letter, mismatched frame size, oversize v2 bitmap, invalid monochrome shade) fails verify with a message naming the offender (4 of 4).
- **SC-005**: Each malformed `roles` case (invalid colour, invalid name, shadowed built-in, more than 16 entries) is reported, and the spec still renders (4 of 4).
- **SC-006**: The verify command passes offline, and the automated build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

The fifth entry, assumptions, is the Assumptions section below.

### Outcome

- **For a spec author or model**: SNES-era characters (recurring documentary hosts and
  thought-experiment actors), coloured by name in creative mode, reproducible frame for frame,
  and still readable in black and white.
- **For a host or quantiser**: every colour a frame uses is named by a role, so recolouring
  stays possible without knowing the primitive.
- **For spec 019**: a palette roles contract to add the second tone to, with no further
  amendment.

### In scope

- The Principle III amendment to palette roles.
- The spec-level `roles` map: grammar, validation and rendering.
- Sprite character format v2: per-letter palette, the 32 × 48 ceiling, and verify checks.
- The `hero` character, its reference cases, gallery image and loop.
- The refreshed vocabulary document (version unchanged at 13). The palette gate extension.

**Boundary change**: a contract change under Principle VII. The spec format gains `roles`, so
the baseline's "The format" entry is amended in the same change. No scope change, no new export
beyond the widened `AnimSpec` and `Palette` types, and no new runtime dependency. Principle III
is redefined, so the constitution takes a MAJOR version bump.

### Out of scope

- **The `snes` quantizer profile** (and any named palette profile): needs #102's
  palette-profile mechanism. Quantising stays downstream, per Principle III's rationale.
- **The second tone** (#97): spec 019, which reuses this contract.
- **Roles on other primitives**: only `sprite` reads named roles in this spec.
- **Characters defined in a spec**: characters stay code. Params stay scalar-only.
- **Per-role shading, gradients, or blending modes**: a role is one flat colour.
- **The finish chain, dithering and pixel aspect** (#90, #107).

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure function of spec, signal and seed. Chunked renders match, within the
  cross-type tolerance.
- **Principle II**: characters and their palettes live in the registry's source. The prompt,
  schema and validator follow from them.
- **Principle III** (as amended): drawing colours only with palette roles, monochrome by
  default, readable in pure black and white, CPU-only.
- **Principle IV**: malformed `roles` entries are dropped and reported, and the spec still
  renders.
- **Principle V**: every existing frame is unchanged.
- **Principle VI**: every check runs inside the one offline verify command.

## Assumptions

- **Monochrome shades reuse the legacy greys.** A v2 character in monochrome looks like a
  legacy one, which keeps the quantiser path from ADR 0020 working.
- **Role names are free-form but bounded.** A character declares the names it uses, and a spec
  colours them. 16 roles and 16-character names are enough for a 10-colour character with
  room to spare.
- **Roles are spec-wide, not per layer.** Two characters that share a role name share its
  colour. That is the intent for a consistent cast.
- **32 × 48 is enough** for a 16-bit-era character at documentary scale, and bounds the work
  per frame.
- **MAJOR constitution bump.** The governance rule is "MAJOR for redefining a principle", and
  the colour rule of Principle III is redefined, even though every existing spec still
  conforms.
- **Spec number 020.** 019 is reserved for #97 on the roadmap. 020 ships first and carries the
  amendment that 019 then reuses.
- **Scope source**: issue #103, the 0.4.0 triage comment, the roadmap's "Palette roles" row,
  and the plan of 2026-10-23.
