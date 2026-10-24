# Feature Specification: Image Assets

**Feature Branch**: `feature/022-image-assets`

**Created**: 2026-10-24

**Status**: Shipped in 0.8.0

**Input**: Issues #108 (an official, validated image layer) and #109 (placement, source rect, scale, tile/wrap scrolling). #113 is closed as a duplicate and its needs are carried here. This is the first item on the Motion Studio integration list ("AI or artist art in, animspec animates it").

Maintainer decisions (2026-10-24):

- **One spec** for #108 and #109.
- **Images are named by asset id plus sha256** in the spec. The host supplies the decoded bitmaps, and the CLI loads files next to the spec and checks the digest. `draw` never reads files.
- **Colour is chosen per layer** with `colour: asset|palette`. `asset` keeps the art's colours and is honoured only in creative mode. `palette` quantizes to palette colours. Outside creative mode every image quantizes, so output stays monochrome by default.
- **The finish chain (#90) belongs to Motion Studio**, so this spec adds no post-process.

## User Scenarios & Testing *(mandatory)*

Artists and image models produce art: backgrounds, portraits, props, title cards. Today
animspec can only take a bitmap through a private, unvalidated path (`_bitmap`) that
stretches it over the whole frame. `validateAnimSpec` silently drops `image` layers, so a
spec that uses art cannot be validated, placed, scrolled or rendered from the CLI. Callers
have composited and scrolled the art themselves, and hand-swapped frames, which defeats a
declarative spec.

### User Story 1 - Use art in a spec, deterministically (Priority: P1)

An author declares an asset (id, sha256, size) and adds an `image` layer naming it. The
host passes the decoded bitmap, or the CLI finds `<id>.png` next to the spec. The art
renders, and the same spec, assets, signal and seed always give the same frame.

**Why this priority**: This is #108. Nothing else in the integration list works without it.

**Independent Test**: A spec with one declared asset and an `image` layer validates with no errors. The CLI renders it identically twice and in chunks. Changing one byte of the PNG makes the CLI refuse with a clear message.

**Acceptance Scenarios**:

1. **Given** a spec whose `assets` map declares an id with a sha256, width and height, and an `image` layer naming that id, **When** it is validated, **Then** the layer is kept and nothing is reported.
2. **Given** an `image` layer naming an id that `assets` does not declare, **When** it is validated, **Then** the layer is dropped and reported. It is never silently dropped.
3. **Given** the host supplies decoded bitmaps keyed by asset id, **When** frames are rendered, **Then** the image draws. When a declared asset has no bitmap supplied, that layer draws nothing and the caller can learn which asset was missing.
4. **Given** the CLI renders a spec whose asset file sits next to it, **When** the file's sha256 matches, **Then** it renders. When the file is missing or its sha256 differs, it exits with a dedicated code and names the asset.
5. **Given** the same spec, assets, signal and seed, **When** it is rendered twice, in chunks, or on the other processor type, **Then** the frames are byte-identical (within the cross-type tolerance across types).
6. **Given** the CLI manifest, **When** a spec with assets is rendered, **Then** it records each asset's id and sha256.

---

### User Story 2 - Place, crop and flip art (Priority: P2)

An author positions a portrait in a corner, fits it inside or covering a box, crops a
region out of a sheet, mirrors it, and fades it, all with scalar params.

**Why this priority**: #109 and #113. Without placement, art can only fill the frame.

**Independent Test**: Reference cases for `contain`, `cover`, `stretch` and `none`, an anchor, a source rect, each flip, and an opacity each render a known frame.

**Acceptance Scenarios**:

1. **Given** `x`, `y` and `anchor`, **When** rendered, **Then** the image's anchor point sits at that frame position.
2. **Given** `fit: contain`, `cover`, `stretch` or `none` with a `scale`, **When** rendered, **Then** the image fits inside, covers, fills or keeps its own size in the layer's box, times `scale`.
3. **Given** a source rect (`srcX`, `srcY`, `srcW`, `srcH` as fractions of the asset), **When** rendered, **Then** only that region of the asset is drawn.
4. **Given** `flip: x`, `y` or `xy`, **When** rendered, **Then** the image is mirrored on that axis.
5. **Given** `opacity` below 1, **When** rendered, **Then** the image blends over the layers beneath it.
6. **Given** `smoothing: nearest` (the default), **When** scaled, **Then** pixel art stays crisp, with no blended pixels. `smoothing: smooth` gives filtered scaling.

---

### User Story 3 - Scroll art for backgrounds and parallax (Priority: P3)

An author tiles a wide strip and scrolls it, with several image layers at different speeds
for parallax.

**Why this priority**: #109's scrolling. It makes backgrounds and parallax usable.

**Independent Test**: A scrolling, wrapping image renders frame n identically whether rendered alone or in sequence. A four-plane parallax scene is declared entirely in the spec.

**Acceptance Scenarios**:

1. **Given** `wrap: x` (or `xy`) and `scrollX` (or `scrollY`), **When** rendered over time, **Then** the image tiles seamlessly and moves by that many frame widths per second, as a closed form of time.
2. **Given** any frame index, **When** it is rendered alone, **Then** it equals that frame from a sequential render.
3. **Given** several image layers with different scroll speeds, **When** rendered, **Then** they move independently (parallax), and work with the camera and `depth` as other layers do.

---

### User Story 4 - Colour: the art's own, or the palette (Priority: P4)

An author chooses per layer whether art keeps its colours or is mapped to the spec's
palette.

**Why this priority**: It keeps "monochrome by default" true while letting creative work use full-colour art.

**Independent Test**: The same image in `asset` mode renders in its own colours in creative mode, and as palette colours outside it. In `palette` mode, every pixel is a palette colour in both modes.

**Acceptance Scenarios**:

1. **Given** `colour: asset` (the default) in creative mode, **When** rendered, **Then** the art keeps its own colours.
2. **Given** `colour: asset` outside creative mode, **When** rendered, **Then** the image is quantized to the palette, exactly as in `palette` mode.
3. **Given** `colour: palette`, **When** rendered, **Then** every source pixel maps to the nearest available palette colour (background, foreground, accent, and any `roles`), with ties broken in a fixed order.
4. **Given** a palette-mapped image with `smoothing: nearest`, **When** rendered, **Then** every image pixel is exactly a palette colour.

### Edge Cases

- **Transparent pixels in the art**: they keep their alpha, and the layers beneath show through. In palette mode, alpha is kept and only the colour is mapped.
- **An asset declared but unused**: harmless and not reported.
- **Bad asset entries**: an asset whose sha256 is not 64 hex characters, or whose size is not a positive integer up to 8192, is dropped and reported. Layers naming it are then dropped and reported.
- **Too many assets**: more than 32 are cut by sorted id and reported.
- **A source rect out of range or with zero area**: clamped, and nothing is drawn at zero area.
- **The image off-frame**: clipped, as any layer is.
- **Camera zoom with `nearest`**: pixels stay crisp under zoom.
- **Transparent background (spec 017)**: works as for any layer.
- **The private `_bitmap` path**: unchanged for existing callers and documented as legacy. It is never reachable from a spec.
- **`drive`**: the default `level` adds a small signal-driven scale pulse, so the default layer is signal-driven for the reactivity gate. `none` is static, which is what art layers usually want.

## Requirements *(mandatory)*

### Functional Requirements

**Assets**

- **FR-001**: A spec MUST accept an optional `assets` map of up to 32 entries: an id (a role-name-style identifier) mapped to `{ sha256, width, height }`.
- **FR-002**: Invalid entries MUST be dropped and reported, and the rest of the spec MUST still validate.
- **FR-003**: Hosts MUST be able to pass decoded bitmaps keyed by asset id when rendering. Rendering MUST NOT read files or the network.
- **FR-004**: The library MUST provide a check that compares supplied asset bytes against their declared sha256 and reports any mismatch or missing asset.
- **FR-005**: The CLI MUST gain a `--creative` switch (added at implementation: without it the CLI always rendered with creative mode off, so `colour: asset` could never show the art's colours). It MUST load `<id>.png` from the spec's folder (or a given assets folder), check its sha256 before rendering, exit with a dedicated code naming the asset on a missing file or mismatch, and record the asset digests in its manifest.

**The `image` primitive**

- **FR-006**: The registry MUST gain an `image` primitive, with scalar params only:
  - `asset` (string id);
  - `x`, `y` (0..1) and `anchor` (an enum of nine positions);
  - `fit` (`contain|cover|stretch|none`) and `scale`;
  - `srcX`, `srcY`, `srcW`, `srcH` (0..1);
  - `flip` (`none|x|y|xy`), `opacity` (0..1) and `smoothing` (`nearest|smooth`);
  - `colour` (`asset|palette`);
  - `wrap` (`none|x|xy`) with `scrollX` and `scrollY`;
  - `drive` (`level|none`).
- **FR-007**: An `image` layer naming an undeclared asset MUST be dropped and reported by the validator.
- **FR-008**: Scrolling MUST be a closed form of the frame time, so any frame renders alone identically.
- **FR-009**: `colour: asset` MUST draw the art's own colours only in creative mode, and behave as `palette` otherwise. `colour: palette` MUST map each pixel to the nearest available palette colour, with a fixed tie order.
- **FR-010**: The cost MUST stay within the per-primitive budget: a bounded number of drawing operations per layer (one per visible tile).

**Constitution and gates**

- **FR-011**: Principle IV MUST be amended so that an `image` layer is accepted from a spec when it names a declared asset.
- **FR-012**: Principle III MUST be amended so that pixels copied from a declared asset by an `image` layer in `asset` colour mode, in creative mode, are exempt from the palette rule. Everything else stays palette roles only, and monochrome by default.
- **FR-013**: "The format" entry MUST gain `assets`. The CLI's asset loading MUST be named as a boundary move into scope. The version is MAJOR (4.2.0 → 5.0.0), because principles are redefined.
- **FR-014**: The palette gate MUST check every image except `asset`-mode images in creative mode.
- **FR-015**: Every existing reference frame MUST stay byte-identical. New reference cases MUST cover placement, fits, the source rect, flips, opacity, smoothing, scrolling, and both colour modes in and out of creative mode. They use small, licence-clean fixture images generated by a committed script.
- **FR-016**: The vocabulary version MUST rise (a new primitive). Every check MUST run inside the one offline verify command.

### Key Entities

- **Asset**: an id, a sha256 digest and a declared size. The bytes are supplied by the host or found by the CLI.
- **Image layer**: one placed, optionally cropped, flipped, faded and scrolling view of an asset, in the art's colours or the palette's.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical, in both reference sets.
- **SC-002**: A spec with art validates with 0 errors, and an undeclared asset is reported 100% of the time (never silently dropped).
- **SC-003**: The CLI renders a spec plus its asset folder byte-identically twice and in chunks, and refuses a tampered asset every time, with its dedicated exit code.
- **SC-004**: In palette mode with nearest smoothing, 0 image pixels fall outside the palette colours.
- **SC-005**: A four-plane parallax scene is declared entirely in the spec, and frame n rendered alone equals frame n from a sequential render.
- **SC-006**: Verify passes offline, and the build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For artists, image models and Motion Studio**: art goes into a spec and animspec places, scrolls and animates it deterministically.
- **For hosts**: a simple contract. Pass decoded bitmaps keyed by asset id; the digests in the spec say exactly which bytes were meant.

### In scope

- The `assets` format field.
- The `image` primitive.
- Asset checking in the library and the CLI.
- The constitution amendments (Principles III and IV, "The format", the CLI boundary move).
- Gates, fixtures, references, a parallax showcase and docs.

**Boundary change**: yes. Two principles are redefined. The format gains `assets`. The CLI begins loading asset files, moving that responsibility from the caller into scope for the CLI. New public export: the asset-check function.

### Out of scope

- **The finish chain and post-process effects** (#90, owned by Motion Studio).
- **Sprite sheets** (#110), a follow-on on the same asset model.
- **The plugin slot** (#92, spec 023), which will reuse the asset record.
- **Fetching assets** by URL, and asset storage.
- **Image formats other than PNG** in the CLI.
- **Video or animated images.**

### External dependencies

- None new. Decoding uses the existing `@napi-rs/canvas`.

### Non-negotiable constraints

- **Principle I**: pure function of spec, assets, signal and seed. Chunk-stable. Within the cross-type tolerance.
- **Principle III (as amended)**: no file or network access in `draw`, and monochrome by default.
- **Principle IV (as amended)**: assets are declared and digest-pinned, and everything malformed is reported.
- **Principle V**: no existing frame moves, and the legacy `_bitmap` path keeps working.
- **Principle VI**: one offline verify command.

## Assumptions

- **sha256 is the digest.** It is standard, and Node's crypto computes it offline.
- **32 assets per spec and 8192 px per side** bound memory and validation, and are well beyond a scene's needs.
- **The CLI reads PNG only** in this spec. Hosts may supply any bitmap they decode themselves.
- **The `colour: asset` default matches the integration's intent** ("art in"). Gating it on creative mode keeps the constitution's monochrome default.
- **Scope source**: issues #108, #109 and #113, the Motion Studio integration list, and the maintainer decisions of 2026-10-24.
