# Feature Specification: Palette Profiles

**Feature Branch**: `feature/028-palette-profiles`

**Created**: 2026-10-28

**Status**: Shipped in 0.10.0

**Input**: Issues #102 (Game Boy DMG: a named four-tone palette profile and a 160×144 render profile) and #104 (Sega Genesis / Mega Drive: a palette profile and checkerboard dither), planned for 0.10.0. Maintainer decisions (2026-10-28):

- **Spec-level presets**: a `profile` field selects a named palette. There is no frame-level quantise; the finish chain stays Motion Studio's (#90).
- **Checkerboard dither**: `dither` gains `matrix: "2"`, a 2×2 matrix whose 50% level is a checkerboard.
- **Render sizes**: these are the host's width and height. They are documented, with showcase loops.

## User Scenarios & Testing *(mandatory)*

The Game Boy look works today only through a host-side quantizer, or by hand-picking `roles`, as the `game-boy` showcase does. The mapping is ad hoc, untested and undiscoverable. The Genesis look needs colours on the hardware's 9-bit grid, and a checkerboard mix that the Bayer 4 and 8 matrices don't give.

### User Story 1 - A named Game Boy palette (Priority: P1)

An author sets `profile: "gameboy-dmg"` on a creative-mode spec. The background, ink, accent, second tone and the `hero` character's parts all come from the four DMG greens.

**Why this priority**: This is #102's request, and the simplest complete profile.

**Independent Test**: Render a solid scene (`tetris`, the `hero` sprite, a `b`-patterned checker, pixel-mode `bars`) at 160×144 with the profile in creative mode. Count the distinct colours.

**Acceptance Scenarios**:

1. **Given** `profile: "gameboy-dmg"`, creative mode and `background: "white"`, **When** a frame is rendered, **Then** the background is `#9bbc0c`, the ink `#0f380f`, the accent `#306230`, and `fg2` is `#8bac0f`.
2. **Given** `background: "black"` (the default), **When** a frame is rendered, **Then** the tones invert: the background is `#0f380f`, the ink `#9bbc0c`, the accent `#8bac0f`, and `fg2` is `#306230`.
3. **Given** a scene of solid primitives (`tetris`, `sprite` `hero`, `checker` and `grid` patterns with `solid`, `dither`, and pixel-mode `bars`/`rings`), **When** it is rendered, **Then** every pixel is one of the four DMG tones.
4. **Given** the same spec without creative mode, **When** it is rendered, **Then** it is black and white, exactly as without a profile.
5. **Given** a spec that also sets `accent` or a `roles` entry, **When** it is rendered, **Then** the spec's own colour wins over the profile's.

---

### User Story 2 - Genesis colours and checkerboard dither (Priority: P2)

An author sets `profile: "genesis"`. Every colour the spec names (accent, roles) and every colour of an image asset drawn in its own colours is snapped to the Genesis 9-bit grid: each channel is one of 0, 36, 73, 109, 146, 182, 219 or 255. A `dither` layer with `matrix: "2"` mixes two tones in a checkerboard.

**Why this priority**: This is #104's palette and dither asks.

**Independent Test**: Render an image asset in creative mode with `profile: "genesis"` and `pixelMode`. Check that every channel of every pixel is on the 9-bit grid. Render a two-stop `dither` with `matrix: "2"`, and check that its middle band is a strict checkerboard.

**Acceptance Scenarios**:

1. **Given** `profile: "genesis"` and `accent: "#e02020"`, **When** a frame is rendered in creative mode, **Then** the accent draws as `#db2424` (each channel at its nearest grid level).
2. **Given** an `image` layer in its own colours, `pixelMode` and the profile, **When** a frame is rendered, **Then** every pixel's channels are on the 9-bit grid.
3. **Given** `dither` with `matrix: "2"` and two stops, **When** a frame is rendered, **Then** the 50% band alternates the two stops in a checkerboard, and the bands on either side are solid or 25%/75% mixes.
4. **Given** `matrix` left at its default, **When** a frame is rendered, **Then** the frame is byte-identical to before.

---

### User Story 3 - Documented render profiles (Priority: P3)

An author finds the Game Boy (160×144) and Genesis (320×224) render profiles in the user guide, each with a spec. Two showcase loops render them.

**Independent Test**: The user guide's "Style profiles" section lists both, and the showcase shows `game-boy-dmg` and `genesis` loops.

**Acceptance Scenarios**:

1. **Given** the showcase, **When** it is generated, **Then** `game-boy-dmg` (160×144) uses only the four DMG tones in every frame.
2. **Given** the showcase, **When** it is generated, **Then** `genesis` (320×224) shows two scrolling image planes, the hero and a checkerboard-dithered band, and every pixel's channels are on the 9-bit grid.

### Edge Cases

- **Unknown profile name**: dropped and reported. The spec renders without a profile.
- **Transparent background**: the background and ink stay black and white (the lift needs them), and the profile still sets the accent and roles.
- **Antialiased primitives** (text, curves): their edges blend between profile tones, as they blend between black and white today. Exactness is promised only for the solid primitives of US1 scenario 3.
- **The 64-colour ceiling** of the Genesis: not enforced. The validator can't see image assets. The user guide states the ceiling, and the showcase reports its count.
- **Primitives with fixed greys** (grid lines, LED off-dots, tetris grid, legacy sprite shades, dither grey stops): under a profile, each grey is the matching background–foreground mix snapped to the nearest palette colour. With black and white they stay exactly as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A spec MUST accept an optional `profile`: `"gameboy-dmg"` or `"genesis"`. Any other value MUST be dropped and reported as `profile dropped (must be gameboy-dmg or genesis)`. The JSON schema MUST describe it.
- **FR-002**: A profile MUST apply only in creative mode. Outside creative mode, frames MUST be byte-identical to the same spec without a profile.
- **FR-003**: `gameboy-dmg` MUST set the background, ink, accent, `fg2` and the hero's ten roles from the four DMG tones, with a light (white background) and a dark (black background) arrangement.
- **FR-004**: `genesis` MUST snap the accent, every role colour, and image-asset colours drawn in the asset's own colours, to the 9-bit grid (channel levels `round(k·255/7)`, k = 0..7).
- **FR-005**: The spec's own `accent` and `roles` MUST take precedence over the profile's. Under `genesis` they are snapped too.
- **FR-006**: Under a profile, every fixed grey in a primitive MUST become the matching background–foreground mix, snapped to the nearest palette colour. Without a profile, every frame MUST be byte-identical to before.
- **FR-007**: `dither.matrix` MUST gain `"2"`, a 2×2 Bayer matrix. Its default MUST stay `"8"`.
- **FR-008**: With `gameboy-dmg`, a scene of the US1 scenario 3 primitives MUST contain only the four DMG tones. No primitive (except `image`, whose own colours are by design) MAY draw a fixed grey, black or white under the profile: every fixed colour follows it, and `plasma` mixes from background to ink. Antialiased edges blend between profile colours, as they blend between black and white today; their rounding differs by processor type, so they are not held to the palette tolerance under a profile.
- **FR-009**: Frames MUST stay pure functions of spec, signal and seed, chunk-stable and within the cross-type tolerance.
- **FR-010**: The constitution's "The format" entry MUST name `profile` (MINOR amendment). The vocabulary version MUST rise by one for the `dither` enum value.
- **FR-011**: The user guide MUST document both profiles and render sizes. The showcase MUST gain the `game-boy-dmg` and `genesis` loops.

### Key Entities

- **Palette profile**: a named set of palette colours (background, ink, accent, roles) or a colour grid, selected by `profile`, honoured in creative mode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical in both sets.
- **SC-002**: A 160×144 Game Boy scene of the US1 scenario 3 primitives has exactly 4 distinct colours, all DMG tones.
- **SC-003**: A Genesis image scene has 0 pixels with a channel off the 9-bit grid.
- **SC-004**: The `dither` 2×2 50% band is a strict checkerboard.
- **SC-005**: The verify command passes offline within the CI budget.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For an author or a model**: named, tested retro palettes in place of ad-hoc host quantizers and hand-picked roles.

### In scope

- The `profile` field, its validation and schema.
- The two profiles' colours, and genesis grid snapping (including image assets drawn in their own colours).
- Palette-derived greys under a profile.
- The `dither` 2×2 matrix.
- Checks, reference cases, docs and two showcase loops.

**Boundary change**: `profile` is a new spec-level field. "The format" gains it (MINOR amendment, 6.2.0 → 6.3.0). No new export, output, dependency or service.

### Out of scope

- **A frame-level quantise to a profile**: a finish, owned by Motion Studio (#90).
- **Enforcing the Genesis 64-colour ceiling**: documented, not enforced.
- **More profiles** (NES, SNES, CGA and others): later, one at a time.
- **Profile-specific render sizes in code**: the host chooses the width and height.

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure, deterministic and chunk-stable.
- **Principle III**: colour only through the palette. A profile is a palette, honoured only in creative mode.
- **Principle IV**: a bad `profile` is dropped and reported.
- **Principle V**: no existing frame moves.
- **Principle VI**: one offline verify command.
- **Principle VII**: "The format" is amended in the same change.

## Assumptions

- **DMG tones** are `#0f380f`, `#306230`, `#8bac0f` and `#9bbc0c`, as in #102 and the existing `game-boy` showcase.
- **Hero role mapping** under `gameboy-dmg`: outline, eyes, boots and cloak-shade take the ink; hair, cloak and tunic take the accent; hair-light, skin and gold take `fg2`.
- **The 9-bit grid** levels are `round(k·255/7)`: 0, 36, 73, 109, 146, 182, 219, 255. Snapping is per channel, to the nearest level.
- **The 2×2 Bayer matrix** is `[[0, 2], [3, 1]]`.
- **Scope source**: issues #102 and #104 and their comments, the #90 decision, specs 019–021 and 026, and the maintainer decisions of 2026-10-28.
