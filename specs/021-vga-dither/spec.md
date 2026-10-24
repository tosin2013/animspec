# Feature Specification: VGA Dither Scenes

**Feature Branch**: `feature/021-vga-dither`

**Created**: 2026-10-23

**Status**: Shipped in 0.7.0

**Input**: Issue #107 (MS-DOS / VGA Mode 13h style), native path. Maintainer decisions (2026-10-23):

- Take #107's look without the finish chain. Ordered dithering is drawn by a primitive into the scene, the way DOS artwork baked its dithering in, not applied to the whole frame afterwards.
- "Post-process effects" stays permanently out of scope (#90 is untouched).
- The maintainer approved the look from a throwaway prototype: a dithered night sky and desert, a monolith, a terminal, the v2 hero, and a blue UI bar with a verb row and a parser line.

## User Scenarios & Testing *(mandatory)*

A DOS-era point-and-click scene is mostly dithered bands: a sky fading through a few palette colours, a desert, shaded props, a solid UI bar. VGA games faked colours outside their palette with ordered (Bayer) dithering, a fixed dot pattern between two neighbouring colours. animspec has no way to draw a gradient band, dithered or not. The caption cannot be placed inside a bar at the bottom of the frame. And a spec cannot say its pixels were meant to be shown 1.2× tall, as Mode 13h pixels were.

### User Story 1 - Draw dithered bands (Priority: P1)

An author adds a `dither` layer: a rectangle (a region of the frame) filled with a gradient through two to six palette roles, rendered as an ordered Bayer dot pattern. A single role gives a solid band, such as a UI bar or a monolith face.

**Why this priority**: The dithered gradient is the signature of the look, and every other part of the scene builds on it.

**Independent Test**: Render a `dither` band through three roles in creative mode. Every pixel is exactly one of the three role colours. In the blend zone between two stops the pattern matches the 8 × 8 Bayer matrix, and the band covers exactly its declared region.

**Acceptance Scenarios**:

1. **Given** a `dither` layer with a region and two to six roles, in creative mode, **When** a frame is rendered, **Then** every pixel inside the region is exactly one of the listed role colours, and pixels outside it are untouched.
2. **Given** a blend between two neighbouring stops, **When** it is rendered, **Then** the share of the second colour rises steadily across the zone, following the fixed 4 × 4 or 8 × 8 Bayer threshold matrix (the author's choice).
3. **Given** a single role, **When** it is rendered, **Then** the region is a solid fill in that role.
4. **Given** creative mode off, **When** it is rendered, **Then** the stops become evenly spaced greys from the background to the foreground. The band is still a dithered gradient and reads in pure black and white.
5. **Given** a chunk size above 1, **When** it is rendered, **Then** each dither cell is a block of that many pixels, for a chunkier, low-resolution look.
6. **Given** the same layer, **When** it is rendered twice or in chunks, **Then** the output is byte-identical.
7. **Given** `drive: "none"`, **When** it is rendered at any signal level, **Then** the output is identical: static, designed scenery. **Given** the default `drive: "level"`, **When** the level changes, **Then** the stop boundaries slide by up to half a stop, a shimmer that keeps the default layer signal-driven (the vetting gate's reactivity rule, following `rig`'s `drive` precedent).

---

### User Story 2 - A UI bar with readable text (Priority: P2)

An author places a caption inside a bar at the bottom (or top) of the frame by setting how far the text sits from the edge.

**Why this priority**: The adventure UI (verbs and a parser line) is the interface half of #107. In the prototype it only fit after a manual nudge.

**Independent Test**: A caption with `margin: 0` and two lines sits flush in a 54 px bar at the bottom of a 320 × 180 frame. With the default margin it renders byte-identically to before.

**Acceptance Scenarios**:

1. **Given** a caption with a `margin` set, **When** it is rendered, **Then** the text block sits that many font-heights from the bottom or top edge (it has no effect at the centre).
2. **Given** a caption without `margin`, **When** it is rendered, **Then** every frame is byte-identical to before.

---

### User Story 3 - Declare the intended pixel shape (Priority: P3)

A spec declares `pixelAspect: 1.2`. The command-line renderer records it in its manifest, so an encoder or host stretches the output correctly. Rendering itself stays square-pixel.

**Why this priority**: Mode 13h art looks squashed without it, but it is metadata. It never changes a pixel.

**Independent Test**: A spec with `pixelAspect: 1.2` renders byte-identically to the same spec without it, and the CLI manifest carries `pixelAspect: 1.2`.

**Acceptance Scenarios**:

1. **Given** `pixelAspect` between 0.5 and 2, **When** the spec is validated, **Then** it is kept. Outside that range or not a number, it is dropped and reported.
2. **Given** a spec with `pixelAspect`, **When** frames are rendered, **Then** the pixels are identical to the spec without it.
3. **Given** the command-line renderer and a spec with `pixelAspect`, **When** it writes its manifest, **Then** the manifest records the value (and records nothing when the spec has none).

---

### User Story 4 - A DOS adventure showcase (Priority: P4)

The showcase gains a looping DOS point-and-click scene in the approved style, built only from library layers: dithered sky and desert, monolith, terminal, the hero walking, and the verb and parser bar.

**Why this priority**: It is the demo the maintainer asked for, but it depends on stories 1 and 2.

**Independent Test**: `showcase/dos-adventure.gif` is generated from a spec that validates cleanly, loops seamlessly, and is kept fresh by verify.

### Edge Cases

- **Region outside the frame or inverted**: the coordinates are clamped to 0..1. A region with no area draws nothing.
- **Unknown role names in `colors`**: a name the spec has not declared falls back to its monochrome grey, so the band still renders.
- **More than six names, or an empty list**: only the first six are used, and an empty list draws nothing. The validator reports both.
- **Built-in roles in `colors`**: `bg`, `fg` and `accent` may appear, so a band can blend into the background.
- **Horizontal direction**: the gradient runs left to right instead of top to bottom.
- **Camera and transparency**: a dither band moves with the camera like any layer. Under a transparent background, bands in the background colour lift out.
- **`pixelAspect` with transparent output or the camera**: no interaction. It is metadata only.

## Requirements *(mandatory)*

### Functional Requirements

**`dither` primitive**

- **FR-001**: The vocabulary MUST gain a `dither` primitive. It draws a rectangular region (`x0`, `y0`, `x1`, `y1`, each from 0 to 1) filled with a gradient through an ordered list of two to six palette roles (`colors`, a comma-separated string of role names), rendered as an ordered Bayer dither.
- **FR-002**: `matrix` MUST choose the 4 × 4 or 8 × 8 Bayer matrix, `direction` vertical or horizontal, and `chunk` the dither cell size in pixels (1 to 8).
- **FR-003**: Every drawn pixel MUST be exactly one stop colour. There is no blending: cells are whole-pixel blocks aligned to the frame.
- **FR-004**: A built-in stop (`bg`, `fg`, `accent`) MUST draw that palette colour, so `accent` is the foreground outside creative mode. A named stop MUST draw its `roles` colour in creative mode. Otherwise, or when the role is undeclared, stop *i* of *n* MUST draw the fixed grey at *i*/(*n*−1) of the way from background to foreground, or the background itself when there is one stop.
- **FR-005**: A `drive` param (`level` default, or `none`) MUST control signal reaction. With `none` the band is static. With `level` the stop boundaries slide by up to half a stop with the frame's amplitude. Either way it is a pure function of its params, the frame, the frame size and the palette. (Revised at planning: the reactivity gate requires a signal-driven default layer.)
- **FR-006**: Its draw cost at 1080p with default params MUST stay within the per-primitive budget, at no more than 3,000 drawing operations. The implementation picks a strategy that meets this (for example, one fill per run of equal colour per row, or chunked cells).

**Caption margin**

- **FR-007**: `caption` MUST gain an optional `margin` param, the distance of the text block from the top or bottom edge in font-heights (0 to 4). The default reproduces today's layout exactly.

**Pixel aspect**

- **FR-008**: The spec format MUST accept an optional `pixelAspect` number (0.5 to 2). Invalid values are dropped and reported.
- **FR-009**: `pixelAspect` MUST NOT change any rendered pixel.
- **FR-010**: The command-line renderer's manifest MUST record `pixelAspect` when the spec has one.

**Everywhere**

- **FR-011**: Every existing reference frame MUST stay byte-identical.
- **FR-012**: New reference cases MUST cover `dither` (vertical in creative mode, horizontal in monochrome, a single stop, chunked) and caption `margin`.
- **FR-013**: The vocabulary version MUST rise, because a primitive and a param are added. The vocabulary record, prompt and schema follow from the registry.
- **FR-014**: The showcase MUST gain `dos-adventure`, a creative loop.
- **FR-015**: Every check MUST run inside the one offline verify command.

### Key Entities

- **Dither band**: a region, an ordered list of roles, a matrix, a direction and a chunk size.
- **Pixel aspect**: the intended display shape of a pixel (width 1, height `pixelAspect`), carried as metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical, in both reference sets.
- **SC-002**: A creative dither band has 0 pixels outside its stop colours, and 0 changed pixels outside its region.
- **SC-003**: In monochrome, a dither band's pixels are all greys on the background–foreground line.
- **SC-004**: A spec with and without `pixelAspect` gives identical pixels, and the manifest records the value.
- **SC-005**: The DOS showcase loop validates cleanly and stays fresh under verify.
- **SC-006**: Verify passes offline, and the build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a spec author or model**: DOS/VGA-style scenes with dithered skies, ground and props, an adventure-game UI bar, and a declared pixel shape, all deterministic.

### In scope

- The `dither` primitive.
- `caption.margin`.
- `pixelAspect` in the format, the validator and the CLI manifest.
- References, the showcase, docs, and the vocabulary version bump.

**Boundary change**: a contract change under Principle VII. The spec format gains `pixelAspect`, so the baseline's "The format" entry is amended in the same change (MINOR). A new primitive and a new param are vocabulary changes. Post-process effects stay out of scope: the dither is drawn by a layer into its own region, not applied to the composed frame.

### Out of scope

- **The finish chain** (#90), whole-frame dithering, CRT, scanlines and the other post-process effects.
- **Palette profiles** (#102), including `vga-13h` and DAC 6-bit snapping. Authors pick VGA colours for their roles themselves.
- **A DOS bitmap font.**
- **Stretching output by `pixelAspect`** inside the library. That stays with the host or encoder.
- **Data-bound HUD fields beyond the caption.**

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure, static, chunk-stable, and within the cross-type tolerance.
- **Principle II**: the primitive and the params are declared in the registry.
- **Principle III (4.1.0)**: the dither colours only with palette roles or fixed bg–fg greys, and is monochrome by default.
- **Principle IV**: malformed params are clamped or dropped and reported.
- **Principle V**: no existing frame moves.
- **Principle VI**: one offline verify command.

## Assumptions

- **Role names as a string list** (`"sky0,sky1,sky2"`) keep params scalar-only, like spec 018's patterns.
- **Six stops is enough** for a sky. Real VGA skies used three to five bands.
- **Monochrome greys spread evenly** so a black-and-white render still shows the gradient.
- **`pixelAspect` range 0.5–2** covers Mode 13h (1.2) and common legacy modes.
- **Scope source**: issue #107, the prototype the maintainer approved on 2026-10-23, and the decision to keep #90 out.
