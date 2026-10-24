# Feature Specification: Transparent Background

**Feature Branch**: `feature/017-transparent-background`

**Created**: 2026-10-23

**Status**: Implemented (unreleased; ships in 0.5.0)

**Input**: Issue #100, "transparent background option", planned for 0.5.0 in `specs/ROADMAP.md`: "`background: "transparent"` in the spec: skip the bg fill and clear to alpha 0. Primitives that draw in bg color (e.g. grid's inset seams) should draw as transparent in this mode. A transparent-mode render's non-art pixels have alpha 0; fg/accent pixels are unchanged in RGB."

## User Scenarios & Testing *(mandatory)*

Every frame today starts from a solid black or white background. Print and overlay
pipelines need the artwork alone, with transparency, so it can sit over video, a photo or a
page. Today a caller must key the background colour out afterwards, which eats the soft,
anti-aliased edge pixels and leaves a fringe (#100).

This feature lets a spec ask for a transparent background, without changing any frame a
spec draws today.

### User Story 1 - Artwork with a transparent background (Priority: P1)

A spec author sets the background to transparent. Every frame comes out with the artwork
only: where nothing is drawn the frame is fully transparent, solid artwork keeps its exact
colour, and soft edges are partly transparent rather than blended with a background colour.

**Why this priority**: It is the request in #100 and the whole value of the feature.

**Independent Test**: Render a transparent spec, composite it over the matching solid
background, and confirm the result matches the same spec rendered on that background; check
that empty areas are fully transparent and solid artwork is fully opaque in its own colour.

**Acceptance Scenarios**:

1. **Given** a transparent spec, **When** a frame is rendered, **Then** every pixel where nothing is drawn is fully transparent.
2. **Given** a transparent spec, **When** a frame is rendered, **Then** every pixel fully covered by the foreground colour is fully opaque and has exactly that colour.
3. **Given** a transparent spec, **When** a frame is composited over the matching solid background, **Then** it matches the same spec rendered on that background, within one step per colour channel.
4. **Given** a primitive that draws in the background colour (a seam, a cut-out, a mask), **When** the spec is transparent, **Then** those parts come out transparent, not as a solid colour.
5. **Given** the same transparent spec, signal and seed, **When** a frame is rendered twice, alone or inside a full render, **Then** the frames are byte-identical.
6. **Given** a transparent spec with dark ink, **When** a frame is composited over white, **Then** it matches the same spec rendered on white, and the artwork is black where fully covered.

---

### User Story 2 - Transparent output from the command line (Priority: P2)

A user renders a transparent spec with the command-line renderer. Image-file output keeps
the transparency, and raw pixel output carries it in the alpha byte, so an encoder that
supports transparency can use it directly.

**Why this priority**: The command line is how most pipelines consume frames (spec 010); the
library alone does not reach them.

**Independent Test**: Render a transparent spec to image files and to raw output; confirm the
image files are transparent where nothing is drawn, and the raw bytes match the library's
frames.

**Acceptance Scenarios**:

1. **Given** a transparent spec, **When** it is rendered to image files, **Then** each file keeps the transparency.
2. **Given** a transparent spec, **When** it is rendered to raw output, **Then** each frame's bytes equal the library's frame for the same inputs, alpha included.
3. **Given** a range of frames rendered in one run, **When** a frame is compared with the same frame rendered alone, **Then** they are byte-identical, so nothing from one frame shows through into the next.

---

### User Story 3 - Models can ask for it (Priority: P3)

A model writing a spec from the published description of the format can choose a
transparent background.

**Why this priority**: Specs are often written by models from the schema; without it the
option exists only for people who read the docs.

**Independent Test**: The format description given to models lists the transparent option;
a spec using it validates and renders transparently.

**Acceptance Scenarios**:

1. **Given** the format description, **When** a model reads the background options, **Then** transparent is listed with what it means.
2. **Given** an unknown background value, **When** the spec is validated, **Then** it falls back to black as today.
3. **Given** the format description, **When** a model reads the ink options, **Then** light and dark are listed, with light as the default.

---

### Edge Cases

- **Grey tones derived from the background** (dim gridlines, unlit cells, shadows): they
  come out as the foreground colour at partial transparency, so over the matching solid
  background they look exactly as before.
- **Deliberately dark artwork** (a near-black detail drawn on a black background): it becomes
  mostly transparent, because on a transparent frame it is indistinguishable from the
  background it was drawn to match. This is the intended reading of "draws in the
  background colour".
- **Accent colour** (creative mode): exact over the matching background. On its own a fully
  covered accent pixel is opaque only when the accent has a channel at full strength (light
  ink) or at zero (dark ink); otherwise it is the most transparent colour that looks the same
  on that background, for example `#ff2d2d` with dark ink becomes `#ff0000` at about 82%
  opacity. Recolouring by exact colour should be done on the solid render.
- **Camera** (specs 014, 016): areas the camera reveals beyond a layer are transparent, as
  they show the background today.
- **Reduced flicker**: unchanged; it controls motion and flashing, not the background.
- **Dark ink**: the mirror image of light ink. Light tones drawn to match a white
  background disappear, and grey tones become partly transparent black.
- **`ink` without a transparent background**: dropped and reported; the frame is unchanged.
- **Hosts that cannot show transparency**: they see whatever their compositor puts behind;
  choosing a solid background remains the default.

## Requirements *(mandatory)*

### Functional Requirements

**The option**

- **FR-001**: A spec MUST be able to ask for a transparent background (`background: "transparent"`).
- **FR-001a**: A transparent spec MUST accept an optional ink setting, `ink: "light"` or `ink: "dark"`, defaulting to light. Light ink draws as on a black background (white foreground) with the black removed; dark ink draws as on a white background (black foreground) with the white removed. The "matching solid background" in this specification is black for light ink and white for dark ink.
- **FR-001b**: An `ink` on a spec whose background is not transparent MUST be dropped and reported, and the spec renders as before. An unknown `ink` value MUST fall back to light and be reported.
- **FR-002**: Without the option, every spec MUST render byte-identically to before this feature.
- **FR-003**: An unknown background value MUST still fall back to black, as today.

**The frame**

- **FR-004**: In a transparent frame, every pixel where nothing is drawn MUST be fully transparent.
- **FR-005**: Every pixel fully covered by the foreground colour MUST be fully opaque and keep that colour exactly. Accent pixels MUST be exact when laid over the matching background (FR-007); on their own they may be a more saturated colour at partial transparency, because on that background the two are indistinguishable.
- **FR-006**: Parts a primitive draws in the background colour, or in a tone between the background and the foreground, MUST come out as transparency: fully transparent for the background colour, and the foreground colour at partial transparency for tones in between.
- **FR-007**: A transparent frame composited over the matching solid background MUST match the same spec rendered on that background, within one step per colour channel.
- **FR-008**: A transparent frame MUST be a pure function of spec, signal and seed: identical on every run, identical alone and inside a full render, and within the existing tolerance across processor types.
- **FR-009**: No primitive needs to change: the behaviour MUST hold for every primitive in the vocabulary.

**Delivery**

- **FR-010**: The command-line renderer's image-file output MUST keep the transparency; its raw output MUST carry it in each pixel's alpha byte.
- **FR-011**: Each frame in a multi-frame command-line render MUST start fully transparent, so no earlier frame shows through.
- **FR-012**: The description of the format given to models MUST list the transparent option.
- **FR-013**: A spec stored unvalidated with the background value `transparent` used to render on black; it MUST now render transparent. Specs stored after validation hold `black` and do not change. This change MUST be recorded in the changelog as intended.
- **FR-014**: All checks MUST run inside the one offline verify command.

### Key Entities

- **Background**: the spec's background choice, now black, white or transparent.
- **Ink**: for a transparent background only, whether the artwork is light (as on black) or dark (as on white).
- **Transparent frame**: a frame whose pixels carry their own transparency, with the artwork's colour where it is drawn and nothing elsewhere.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical after this feature, in both reference sets.
- **SC-002**: For every primitive in the vocabulary and both inks, a transparent frame composited over the matching solid background matches the solid-background frame within one step per channel (all primitives, both inks, three signal levels).
- **SC-003**: In a transparent frame of `grid` and of `dots`, 100% of pixels outside the artwork are fully transparent, and 100% of pixels fully covered by the foreground colour are fully opaque in that colour.
- **SC-004**: A transparent spec renders byte-identical frames twice and in chunks, for 100% of frames checked, and from the command line the same as from the library.
- **SC-005**: Image files from a transparent command-line render are transparent where nothing is drawn (checked on at least one rendered file).
- **SC-006**: The verify command passes offline, and the automated build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

The fifth entry, assumptions, is the Assumptions section below.

### Outcome

- **For a spec author or pipeline**: frames with real transparency, ready to composite over
  video, photos or a page, with clean soft edges and no keying step.
- **For a host**: nothing changes for specs that keep a solid background.

### In scope

- A transparent background value and its `ink` setting in the format, their validation and schema entries.
- Transparent frames from the library and the command-line renderer.
- How the palette rule reads a transparent frame, in the existing gates.
- Checks in the verify command and reference cases for the new behaviour.
- The constitution amendment the format change requires.

**Boundary change**: no new responsibility. The background is already in the format; this
adds a value. As with specs 013 to 016, the baseline's "The format" entry and the Quality
Gates table are amended in the same change that ships it.

### Out of scope

- **Background colours beyond black, white and transparent**, or background images: the
  palette-roles and image-asset work (#97, #103, #108 to #110).
- **Partial transparency of the whole frame** (an opacity setting) or per-layer blend modes:
  the finish chain (#90).
- **Video container formats with transparency**: the command line emits frames; choosing an
  encoder is the host's job.
- **Changing any primitive** to draw differently on a transparent frame.

### External dependencies

- None. Image-file output already supports transparency.

### Non-negotiable constraints

- **Principle I**: frames are a pure function of spec, signal and seed; chunked renders
  match; specs without the option render byte-identically.
- **Principle III**: primitives stay palette-only and unchanged; transparency is applied
  around them.
- **Principle V**: no spec saved in validated form changes what it draws. The one intended
  change, an unvalidated spec that already said `transparent`, is recorded (FR-013).
- **Principle VI**: every check runs inside the one offline verify command.

## Clarifications

### Session 2026-10-23

- Q: Light artwork only, or a dark-artwork choice too? → A: Both, through a separate setting: `background: "transparent"` plus `ink: "light" | "dark"`, default light.

## Assumptions

- **Transparency is defined against the matching solid render.** A transparent frame is the
  frame that, laid over the matching solid background, gives back the solid render. This
  settles every primitive at once, including background-coloured seams and grey tones,
  without changing any primitive.
- **Dark details drawn to match the background disappear.** This is what "draw as
  transparent" in #100 asks for.
- **Raw output already has an alpha byte** (always fully opaque today), so its layout does
  not change.
- **The default stays black.** Transparency is opt-in.
- **Scope source**: issue #100 and the 0.5.0 plan in `specs/ROADMAP.md`.
