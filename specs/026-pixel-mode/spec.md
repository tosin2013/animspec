# Feature Specification: Pixel Mode and Two-Tone Bars and Rings

**Feature Branch**: `feature/026-pixel-mode`

**Created**: 2026-10-28

**Status**: Implemented (0.9.0)

**Input**: Issues #111 (pixel mode: integer snapping, no smoothing; the camera-range part shipped in spec 016), #159 (whole-pixel snapping for `bars` and `rings`) and #158 (palette role `fg2` for `bars` and `rings`), planned for 0.9.0. Maintainer decisions (2026-10-28):

- One spec-level `pixelMode` covers #111 and #159. There is no per-primitive `snap` param.
- The second tone on `bars` and `rings` reuses spec 019/020's `fg2` role. It is chosen by a new `tone2` param on each primitive.
- `pixelMode` is a new spec-level field, so this is a contract change under Principle VII. The baseline's "The format" entry is amended (MINOR) in the same change.

## User Scenarios & Testing *(mandatory)*

The Stack Culture print programme verified animspec 0.8.1 as its batch print engine (2026-10-26). `grid` snaps cells to whole pixels and renders palette-exact edges. `bars` and `rings` do not. At a fractional bar pitch (248.025 px), 0.60% of the bar pixels and 0.84% of the ring pixels were blends of two palette colours. The pipeline fixes this with a nearest-palette pass afterwards. The 16-bit parallax forest test (#111) hit the same problem from the pixel-art side: no way to turn smoothing off for the whole frame, sub-pixel camera offsets, and antialiased particles next to pixel art. The programme's two strongest pieces, UPTIME (bars) and SHIP (rings), also could not use two-tone. Both needed workarounds: a re-authored pattern grid, and a two-pass composite.

### User Story 1 - Palette-exact print renders (Priority: P1)

A print author sets `pixelMode: true` on a spec with `bars` or `rings`. Every edge lands on whole pixels, and every pixel of the frame is exactly a palette colour. No correction pass is needed afterwards.

**Why this priority**: This is #159's request, and the print programme's blocker for retiring its correction pass.

**Independent Test**: Render a solid `bars` spec at a width that gives a fractional bar pitch, and a `rings` spec, both with `pixelMode: true`. Count the pixels that are not exactly a palette colour.

**Acceptance Scenarios**:

1. **Given** `pixelMode: true` and a `bars` or `hbars` layer at a fractional bar pitch on a solid background, **When** a frame is rendered, **Then** every pixel is exactly the background, foreground, accent or second tone.
2. **Given** the same spec, **When** a frame is rendered, **Then** the bars still cover the full width (or height for `hbars`), with no gap or overlap wider than one pixel compared with the fractional layout.
3. **Given** `pixelMode: true` and a `rings` layer at any `count` and `thickness`, **When** a frame is rendered, **Then** every pixel is exactly a palette colour, and each ring is a closed outline of the requested thickness.
4. **Given** any spec without `pixelMode`, or with `pixelMode: false`, **When** it is rendered after this feature, **Then** every frame is byte-identical to before.

---

### User Story 2 - Pixel-art scenes without host workarounds (Priority: P2)

A pixel-art author sets `pixelMode: true` on a scene with scrolling `image` layers, a camera move and `emitter` or `particles` effects. Images sample nearest-neighbour, camera offsets move in whole pixels, and particles are hard-edged squares, so the scene matches the art.

**Why this priority**: This is the rest of #111. Each of these is a workaround the host does by hand today.

**Independent Test**: Render a spec with an `image` layer at `smoothing: "smooth"`, a panning camera, and an `emitter` layer, with `pixelMode: true`. Check that the image draws with nearest sampling, that the camera offset is a whole number of pixels on every frame, and that particle pixels are only palette colours.

**Acceptance Scenarios**:

1. **Given** `pixelMode: true` and an `image` layer with `smoothing: "smooth"`, **When** a frame is rendered, **Then** the image draws as if `smoothing` were `nearest`, at a whole-pixel position and size.
2. **Given** `pixelMode: true` and a camera pan, parallax or shake, **When** frames are rendered, **Then** each layer's offset is a whole number of pixels, and a layer of single-pixel columns shows no blended column.
3. **Given** `pixelMode: true` and an `emitter` or `particles` layer on a solid background, **When** a frame is rendered, **Then** every particle pixel is exactly a palette colour, and each particle is a whole-pixel square.
4. **Given** `pixelMode: true` and a primitive not listed in FR-004, **When** a frame is rendered, **Then** that layer draws exactly as it would without pixel mode (camera rounding aside).

---

### User Story 3 - Two-tone bars and rings (Priority: P3)

An author sets `tone2: "alternate"` on `bars` or `rings` and gives the spec `roles: { fg2: "#d8c8a0" }`. In creative mode, every other bar or ring draws in the `fg2` colour. `tone2: "peak"` on `bars` draws the loudest bar in the second tone instead of the accent.

**Why this priority**: This is #158's request. It is independent of pixel mode, but the print programme uses both together.

**Independent Test**: Render solid `bars` and `rings` with `tone2: "alternate"` and `roles.fg2` in creative mode. Check that `fg2` pixels appear only in the bars or rings the param names, and nowhere else.

**Acceptance Scenarios**:

1. **Given** creative mode, `roles.fg2` and `bars` with `tone2: "alternate"`, **When** a frame is rendered, **Then** odd-indexed bars draw in `fg2` and even-indexed bars in the foreground. The peak bar keeps the accent.
2. **Given** `bars` with `tone2: "peak"`, **When** a frame is rendered, **Then** the peak bar draws in `fg2`, and every other bar in the foreground.
3. **Given** `rings` with `tone2: "alternate"`, **When** a frame is rendered, **Then** even-numbered rings draw in `fg2` and odd-numbered rings in the accent.
4. **Given** the same specs with creative mode off, or with no `fg2` role, **When** a frame is rendered, **Then** the second tone is the mid grey (`#808080`).
5. **Given** `tone2: "none"` (the default), **When** a frame is rendered, **Then** it is byte-identical to before.
6. **Given** `pixelMode: true` with `tone2` set, **When** a frame is rendered, **Then** zero `fg2` pixels fall outside the bars or rings the param names.

### Edge Cases

- **Camera zoom in pixel mode**: a zoom other than 1 scales drawing by a fraction, so edges cannot all land on whole pixels. Offsets are still rounded, and image sampling stays nearest. Palette exactness is promised only at zoom 1, and the docs say so.
- **Transparent background**: pixel-mode primitives draw opaque palette pixels and leave the rest transparent. The transparency gate (solid render equals transparent render over the matching background) still holds.
- **Sequences**: `pixelMode` is spec-level and applies to every clip. Transitions combine whole pixels from two clips (wipe, iris) or mix them (fade). A fade frame is not palette-exact, and the docs say so.
- **Plugin layers**: they receive the pixel-mode flag and may honour it. animspec does not promise palette exactness for them.
- **`pixelAspect`**: unrelated. It stays metadata only.
- **Bars narrower than one pixel** (more bars than columns): each bar is at least one pixel wide, as today. In pixel mode, adjacent bars may share a column. The later bar wins, so the pixel is still exactly one colour.
- **`tone2` on `bars` with `baseline: "middle"`**: the tone applies the same way.
- **A non-boolean `pixelMode`** (`1`, `"true"`): dropped and reported. The spec renders without pixel mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A spec MUST accept an optional top-level `pixelMode` boolean. When it is absent or false, every frame MUST be byte-identical to before this feature.
- **FR-002**: The validator MUST keep a boolean `pixelMode`. It MUST drop any other value and report `pixelMode dropped (must be true or false)`. The JSON schema MUST describe the field.
- **FR-003**: In pixel mode, camera pan, parallax and shake offsets MUST be rounded to whole pixels, and image smoothing MUST be off for the whole frame.
- **FR-004**: In pixel mode, these primitives MUST draw on whole pixels: `bars`, `hbars` (whole-pixel bar edges that still fill the frame, and whole-pixel lengths), `rings` (whole-pixel outlines at the requested thickness), `emitter` and `particles` (whole-pixel squares at whole-pixel positions), and `image` (nearest sampling and a whole-pixel destination).
- **FR-005**: Every other primitive MUST draw in pixel mode exactly as it does without it, apart from FR-003. The user guide MUST list the primitives of FR-004.
- **FR-006**: With pixel mode on a solid background at camera zoom 1, every pixel drawn by an FR-004 primitive MUST be exactly the background, foreground, accent, a declared role colour, or its monochrome grey.
- **FR-007**: `bars` MUST gain `tone2` (`none`, `alternate`, `peak`; default `none`). `rings` MUST gain `tone2` (`none`, `alternate`; default `none`).
- **FR-008**: The second tone MUST be `roles.fg2` in creative mode when `fg2` is given, and the mid grey otherwise, exactly as in spec 019.
- **FR-009**: `fg2` pixels MUST appear only in the bars or rings that `tone2` names.
- **FR-010**: Frames MUST stay a pure function of spec, signal and seed. Pixel-mode and `tone2` frames MUST render identically twice and in chunks, and within the cross-type tolerance.
- **FR-011**: The vocabulary version MUST rise from 16 to 17 (new params). Descriptions MUST name `tone2`'s values and `fg2`.
- **FR-012**: The constitution's "The format" entry MUST name `pixelMode` in the same change (MINOR amendment).
- **FR-013**: Every check MUST run inside the one offline verify command.

### Key Entities

- **Pixel mode (`pixelMode`)**: a spec-level boolean that asks for whole-pixel drawing. It is honoured by the interpreter (camera offsets, smoothing) and by the FR-004 primitives.
- **Second tone selector (`tone2`)**: a per-layer enum on `bars` and `rings` that names which bars or rings draw the `fg2` role.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical, in both reference sets.
- **SC-002**: With pixel mode, solid `bars` at a 248.025 px pitch and solid `rings` have 0 blended pixels (today 0.60% and 0.84%).
- **SC-003**: With pixel mode, solid `emitter` and `particles` frames have 0 pixels outside the palette.
- **SC-004**: With `tone2`, 0 `fg2` pixels fall outside the named bars or rings. In creative mode with `fg2`, 100% of the named bars' or rings' pixels are exactly `fg2` (in pixel mode).
- **SC-005**: The print programme can drop its nearest-palette correction for `bars` and `rings`, and its two-tone workarounds for UPTIME and SHIP.
- **SC-006**: The verify command passes offline, and the automated build stays within the CI budget.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a print or pixel-art author, or a model**: palette-exact, whole-pixel frames from the primitives that most need it, and two-tone bars and rings, without a host-side correction pass.

### In scope

- The spec-level `pixelMode` field: validation, schema, camera offset rounding, frame-wide nearest sampling.
- Whole-pixel drawing in `bars`, `hbars`, `rings`, `emitter`, `particles` and `image` when pixel mode is on.
- The `tone2` param on `bars` and `rings`.
- Checks, new reference cases, a showcase example, the user guide and the vocabulary record.

**Boundary change**: `pixelMode` is a new spec-level field. "The format" gains it (MINOR amendment, 6.1.0 → 6.2.0). No new export, kind of output, dependency or service.

### Out of scope

- **CRT, scanline or any whole-frame finish**: Motion Studio's (decided on #90).
- **Named palette profiles** (#102): a later spec.
- **Per-primitive `snap` params**: rejected in favour of one spec-level mode.
- **Pixel mode for the other primitives**: added one by one later, if asked for. Each addition moves no existing frame, because it applies only with `pixelMode`.
- **Palette exactness under camera zoom or a fade transition**: not promised.
- **A nearest-palette quantise of the finished frame**: a finish, so out of scope (Principle III; #90).

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure, chunk-stable, within the cross-type tolerance.
- **Principle III**: palette roles only. `tone2` draws the `fg2` role or its fixed grey.
- **Principle IV**: a bad `pixelMode` is dropped and reported.
- **Principle V**: no existing frame moves. Both features apply only when asked for.
- **Principle VI**: one offline verify command.
- **Principle VII**: "The format" amended in the same change.

## Assumptions

- **Cumulative rounding** keeps bars filling the frame: bar `i` spans `round(i·w/n)` to `round((i+1)·w/n)`, minus the one-pixel gap as today.
- **Ring rasterisation**: a pixel belongs to a ring when its centre lies within half the thickness of the ring's whole-pixel radius. Rings stay round.
- **`alternate` indexing**: bars counted from 0 (odd bars take the tone), rings counted from 1 (even rings take the tone), so the first bar and the innermost ring keep today's colour.
- **The mid grey is `#808080`**, as in spec 019.
- **Scope source**: issues #111, #158 and #159, the print programme's 2026-10-26 verification test, and the maintainer decisions of 2026-10-28.
