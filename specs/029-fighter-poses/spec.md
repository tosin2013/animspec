# Feature Specification: Fighter Character, Poses and Palette Variants

**Feature Branch**: `feature/029-fighter-poses`

**Created**: 2026-10-28

**Status**: Implemented (0.10.0)

**Input**: The maintainer's review of the `cps2-versus` showcase (spec 027, #106): the versus stage needs a real fighting-game character, not the RPG `hero`. Maintainer decisions (2026-10-28):

- A built-in `fighter` character, rather than showcase-only sprite-sheet art, so every `sprite` user gets it.
- Fighting poses are selectable through a new `pose` param on `sprite`: `auto`, `punch`, `hit` and `ko`.
- (Found while designing.) Two sprites of the same character in one spec share the spec-wide `roles`, so the second fighter needs a palette swap. A `variant` param on `sprite` selects alternate role colours.
- A MAME-era horizontal attract-mode loop is added to the showcase alongside the vertical `tate-shooter`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A fighter for versus scenes (Priority: P1)

An author writes `{ type: "sprite", character: "fighter", motion: "static" }`. A martial artist (gi, belt, headband, gloves) stands in a guard stance and bobs. With `faceLeft` the second fighter faces the first.

**Independent Test**: Render the fighter in creative mode with roles, and in monochrome. It draws within its 28 × 34 bitmap, in role colours (or the legacy greys), facing right by default.

**Acceptance Scenarios**:

1. **Given** `character: "fighter"` and `motion: "static"`, **When** frames are rendered, **Then** the fighter's idle cycle plays (a guard-stance bob).
2. **Given** walking motion, **When** frames are rendered, **Then** the walk cycle plays. On a loud beat with `jump: true`, the jump frame shows.
3. **Given** creative mode and `roles`, **When** a frame is rendered, **Then** its parts take the same ten role names as `hero` (gi = `cloak`/`cloak-shade`, belt = `tunic`, headband = `gold`, gloves = `boots`, plus `hair`, `hair-light`, `skin`, `eyes`, `outline`). The `gameboy-dmg` and `genesis` profiles (spec 028) colour it with no extra mapping.

---

### User Story 2 - Fighting poses (Priority: P1)

An author sets `pose: "punch"`, `"hit"` or `"ko"` on a sprite whose character has that pose. A host stages a fight by switching poses with `sequence` clips: punch, the opponent's hit, a KO.

**Independent Test**: Render the fighter at each pose and check that each differs from `auto` and from the others. Render `hero` with `pose: "punch"`, and check that it equals `auto`, because `hero` has no punch.

**Acceptance Scenarios**:

1. **Given** `pose: "punch"` on the fighter, **When** a frame is rendered, **Then** the punch frame draws, holding still: no hop and no bob.
2. **Given** `pose: "ko"`, **When** a frame is rendered, **Then** the fighter lies on the ground.
3. **Given** a pose the character lacks, **When** a frame is rendered, **Then** it renders exactly as `pose: "auto"`.
4. **Given** `pose: "auto"` (the default), **When** any existing spec is rendered, **Then** it is byte-identical to before.

---

### User Story 3 - Palette variants (Priority: P2)

An author gives the spec `roles` such as `cloak-alt: "#2050c8"` and sets `variant: "alt"` on the second sprite. That sprite draws each part in its `-alt` colour when one is given, and in the main colour otherwise.

**Independent Test**: Two fighters, one `variant: "alt"`, with `cloak-alt` set. The alt fighter's gi is the alt colour; every other part matches the main fighter.

**Acceptance Scenarios**:

1. **Given** `variant: "alt"` and `roles["cloak-alt"]`, **When** a frame is rendered in creative mode, **Then** the gi draws in `cloak-alt`.
2. **Given** `variant: "alt"` and no `-alt` roles, **When** a frame is rendered, **Then** it is identical to `variant: "main"`.
3. **Given** monochrome, **When** a frame is rendered, **Then** the variant changes nothing (roles are creative-only).

---

### User Story 4 - Better arcade demos (Priority: P2)

**Acceptance Scenarios**:

1. **Given** the showcase, **When** it is generated, **Then** `cps2-versus` stages two palette-swapped fighters with a punch, a hit and a draining damage tail, using `sequence` clips.
2. **Given** the showcase, **When** it is generated, **Then** an `arcade-attract` loop (256 × 224, horizontal) shows a MAME-era attract screen: a starfield over a perspective floor, the player sprite, the shooter HUD and a blinking `INSERT COIN`.

### Edge Cases

- **Unknown `pose` or `variant` values**: the enum rule resets them to the default.
- **`pose` with `motion: "walk"`**: the sprite still travels, but holds the pose frame.
- **`variant` with characters without a palette** (v1 characters, icons): no effect.
- **Role names**: every `<role>-alt` fits the role-name rule. The longest, `cloak-shade-alt`, is 15 characters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The built-in characters MUST gain `fighter`: format v2, 28 × 34, facing right. It MUST have walk (2), idle (2), jump, punch, hit and ko frames, all the same size, and use the hero's ten role names.
- **FR-002**: The `Character` type MUST gain optional `punch`, `hit` and `ko` pose lists. The character gate MUST check them like the other poses.
- **FR-003**: `sprite` MUST gain `pose` (`auto`, `punch`, `hit`, `ko`; default `auto`). A non-auto pose the character has MUST draw that pose's cycle with no hop and no bob. A pose it lacks MUST render as `auto`.
- **FR-004**: `sprite` MUST gain `variant` (`main`, `alt`; default `main`). With `alt`, each role MUST draw `roles["<role>-alt"]` when given, else the role's colour.
- **FR-005**: Defaults MUST keep every existing frame byte-identical. The vocabulary version MUST rise by one.
- **FR-006**: The fighter MUST pass the palette, purity, reactivity and budget gates. It MUST stay exactly four greens in a solid `gameboy-dmg` scene, and on the 9-bit grid under `genesis`.
- **FR-007**: The showcase MUST use the fighter in `cps2-versus` (with poses, and `variant` on the second fighter), and MUST gain `arcade-attract`. The user guide MUST document `fighter`, `pose` and `variant`.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of existing reference frames are byte-identical in both sets.
- **SC-002**: The fighter's four pose families render four distinct frames. A character without a pose renders identically to `auto`.
- **SC-003**: An alt-variant fighter differs from the main one only in the parts whose `-alt` role is given.
- **SC-004**: The verify command passes offline within the CI budget.

## Boundaries *(mandatory, constitution Principle VII)*

- **Outcome**: a fighting-game character, poses and player-two colours for any sprite scene.
- **In scope**:
  - the `fighter` character;
  - the `pose` and `variant` params on `sprite`;
  - the optional pose lists on `Character`;
  - checks, reference cases, docs and two showcase loops.
- **Boundary change**: none. The new params are scalar enums on an existing primitive, and the character is data. No format field, export, output, dependency or service changes.
- **Out of scope**:
  - per-layer `roles` maps (structured params are not allowed);
  - more fighting poses (kick, block) and more characters: later, one at a time;
  - hit sparks and other effects tied to poses (the host composes `emitter`);
  - the CRT finish (Motion Studio, #90).
- **External dependencies**: None.
- **Non-negotiable constraints**:
  - Principles I and III–VI. Poses are closed-form, there's no state across frames, and colours come only from roles.
  - Saved specs keep rendering. `character: "fighter"` previously fell back to `mascot`; this is the one recorded behaviour change, the same as when `hero` was added in spec 020.

## Assumptions

- **The fighter's art** is generated from shapes by a script kept with this spec ([`fighter-gen.py`](fighter-gen.py)). The output is committed as plain frame data in `src/primitives/sprites.ts`.
- **Poses switch over time** through `sequence` clips. Binds can't drive enums, so a pose per clip is the closed-form way.
- **Scope source**: the maintainer's review of `cps2-versus` and the decisions of 2026-10-28.
