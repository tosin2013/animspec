# Feature Specification: Camera moves and layer parallax

**Feature Branch**: `feature/014-camera`

**Created**: 2026-10-18

**Status**: Shipped in 0.3.0

**Input**: Issue #73 — a spec-level `camera` (pan/zoom/push/parallax) plus a per-layer
`depth`, applied as a canvas transform before each layer's draw. Ken Burns pan/zoom for
documentary, push-ins for music video, parallax between background and character layers.
A spec-level composition change, deliberately not a primitive proposal; the maintainer
directed it through spec kit.

## User Scenarios & Testing

### User Story 1 - A camera move drives the whole frame (Priority: P1)

A spec author adds a `camera` to a spec: a two-keyframe move (`from` → `to`) with a `move`
type and an `ease`. The interpreter applies the transform before every layer's draw, so
existing primitives pan, zoom or push without knowing a camera exists.

**Why this priority**: the camera is the feature; primitives must stay unaware.

**Independent Test**: render a spec with a zoom camera at two frame indices — the later
frame is visibly scaled about the camera point; render the same spec with no camera and
its bytes match today's.

**Acceptance Scenarios**:

1. **Given** `camera: { move: "push", from: { frame: 0, zoom: 1, x: .5, y: .5 }, to: { frame: 240, zoom: 1.25, x: .55, y: .45 }, ease: "smooth" }`, **When** rendered at frame 0 and 240, **Then** frame 240 is zoomed 1.25× about a point shifted toward (.55, .45), and frame 0 is the identity.
2. **Given** the same camera at a mid frame, **When** rendered, **Then** the transform is the smoothstep of the two keyframes.
3. **Given** a spec with no `camera`, **When** rendered, **Then** the bytes are identical to today's.

### User Story 2 - Depth separates layers under parallax (Priority: P1)

With `move: "parallax"`, each layer's `depth` (0..1, default 1) scales how much the camera
moves it: a `depth: 0` background stays fixed, a `depth: 1` foreground follows the camera,
and in-between layers drift at their own rate — the cartoon/anime multi-plane look.

**Why this priority**: parallax is the reason `depth` exists; without it the camera is
single-plane.

**Independent Test**: under a parallax camera, render a `depth: 0` layer and a `depth: 1`
layer at two frames — the background is unchanged between them, the foreground moves.

**Acceptance Scenarios**:

1. **Given** a parallax camera and layers `{ depth: 0 }` and `{ depth: 1 }`, **When**
   rendered at the start and end keyframes, **Then** the depth-0 layer's pixels are
   identical across both frames while the depth-1 layer follows the full offset.
2. **Given** a layer with `depth: 0.2`, **When** rendered, **Then** it moves a fifth of
   the full camera offset.
3. **Given** a pan/zoom/push camera (not parallax), **When** rendered, **Then** every
   layer moves together — `depth` is ignored.

### User Story 3 - Bad cameras drop loudly; cameras stay deterministic (Priority: P2)

A camera is untrusted input: a malformed `camera` (unknown `move`, non-positive `zoom`, a
non-two-keyframe shape, a `to` missing on a non-static move) is dropped and reported, and
the spec renders un-camera'd. A camera is a closed-form function of the frame index, so
any frame or chunk renders alone.

**Why this priority**: the format's trust model applies to its new field; determinism is
non-negotiable.

**Independent Test**: feed each malformed camera and assert the report and the static
render; render a camera spec forward and chunked and assert byte equality.

**Acceptance Scenarios**:

1. **Given** a camera with an unknown `move`, **When** validated, **Then** the camera is
   dropped with an error and the spec renders without a transform.
2. **Given** a camera with `zoom: 0`, **When** validated, **Then** it is dropped and
   reported.
3. **Given** a camera spec, **When** rendered as one pass and as chunks, **Then** the
   frames are byte-identical.

### Edge Cases

- **`move: "static"`**: the `from` state holds forever; `to` is ignored.
- **`zoom` at `from`** other than 1.0: the `from` frame is already transformed (a pre-zoom
  is legal).
- **`x`/`y` outside -1..2**: clamped; the camera looks at the clamped point (widened from 0..1 by spec 016).
- **`to.frame` ≤ `from.frame`**: malformed — dropped and reported.
- **A layer without `depth`**: treated as `depth: 1`.
- **The image layer**: camera applies to it like any layer.

## Requirements

### Functional Requirements

- **FR-001**: A spec MAY carry a `camera` object: `{ move, from, to?, ease? }`, where
  `move` is `static | pan | zoom | push | parallax`; `from` and `to` are
  `{ frame, zoom, x, y }`; `ease` is `linear` (default) or `smooth` (smoothstep). Two
  keyframes only in v1: the state holds `from` before `from.frame`, eases to `to` after
  `to.frame`.
- **FR-002**: The camera state at frame *n* is a closed-form function of *n*: the eased
  interpolation of `{ zoom, x, y }` between the two keyframes. `pan` varies `x`/`y` only;
  `zoom` varies `zoom` only; `push` varies both; `parallax` varies both and scales the
  per-layer effect by `depth`.
- **FR-003**: The interpreter applies the camera as a canvas transform before each layer's
  draw and restores after: translate to the frame centre, scale by the zoom, translate to
  the looked-at point — an identity when `zoom` is 1 and `(x, y)` is `(0.5, 0.5)`.
  Primitives are unchanged and unaware.
- **FR-004**: Under `move: "parallax"`, a layer's `depth` (a number, clamped 0..1, default
  1) scales the offset and the zoom: depth 0 stays fixed, depth 1 follows the camera
  fully. Under pan/zoom/push, `depth` is ignored — every layer moves together.
- **FR-005**: Validation: a malformed camera (unknown `move`, non-object `from`/`to`,
  non-positive or non-finite `zoom`, non-finite `frame`, missing `to` on a non-static
  move, `to.frame` ≤ `from.frame`, unknown `ease`) is dropped and reported; the spec
  renders un-camera'd. `depth` non-number defaults to 1; out-of-range clamps.
- **FR-006**: The generated JSON schema describes `camera` and `depth`; the vocabulary
  text notes the camera is spec-level.
- **FR-007**: Determinism: a camera is a pure function of the frame index — chunk renders
  are byte-identical, and specs without `camera` render byte-identically to today.
- **FR-008**: The verify suite gains camera coverage: a zoom/push render differs from the
  un-camera'd spec at the `to` frame, a parallax depth-0 layer is fixed while depth-1
  moves, chunk equality with a camera, and every malformed-camera rejection case.
- **FR-009**: The constitution baseline is amended in the same change: the format entry
  gains the camera and per-layer depth, the gates table gains the camera checks, version
  bumped (vocabulary version untouched — a format change, not a vocabulary change).

### Key Entities

- **Camera**: the spec-level `{ move, from, to?, ease? }` — one two-keyframe move.
- **Keyframe**: `{ frame, zoom, x, y }` — a point on the camera's closed-form path.
- **Depth**: a per-layer number (0..1) that scales the parallax offset.
- **Camera transform**: the canvas save/translate/scale/translate/restore applied around
  a layer's draw.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A push camera zooms the frame 1.25× by its `to` frame and is the identity at
  its `from` frame (verified by the gate).
- **SC-002**: A depth-0 layer is byte-identical across a parallax move while a depth-1
  layer moves.
- **SC-003**: Every malformed-camera case is dropped and reported; the spec still renders.
- **SC-004**: A camera spec rendered in chunks is byte-identical to the whole render; an
  un-camera'd spec is byte-identical to today (no golden hash moves).
- **SC-005**: `npm run verify` passes end to end; the purity scan is untouched.

## Boundaries

### Outcome

- **For a spec author**: camera moves and multi-plane parallax as a spec-level composition
  — no primitive changes, no per-primitive wiring.
- **For the project**: the format gains composition (camera + depth) alongside its
  primitives and bindings, with the same validate-and-report discipline.

### In scope

- The optional `camera` object and per-layer `depth` in the AnimSpec format: moves, easing,
  keyframes, validation, the transform in the interpreter, and the schema/prompt surface.
- Verify coverage: camera rendering, parallax depth, chunk equality, rejection cases.
- The constitution baseline amendment this feature requires.

**Boundary change**: yes — the AnimSpec contract gains a spec-level `camera` and a
per-layer `depth`, a new promise to hosts and model authors ("composition is expressible
in the spec"). The baseline's "The format" entry and the Quality Gates table are amended
in the same change that ships it.

### Out of scope

- **More than two keyframes**: a keyframe array is a future version.
- **Easing beyond linear/smooth**: a fuller easing set is a future version.
- **Rotation, shear or 3D cameras**: out of scope entirely.
- **Camera-driven primitive changes**: primitives stay transform-unaware.
- **A camera editor UI**: hosts own their tools.

### External dependencies

- **None.** The transform uses the canvas 2D save/translate/scale/restore and closed-form
  math.

### Assumptions

- Zoom is isotropic (a single scale); aspect is preserved by the canvas dimensions.
- The camera point `(x, y)` is normalised (0.5, 0.5 is the frame centre).
- Depth applies only to parallax, per the maintainer's clarified decision.

### Non-negotiable constraints

- **Principle I**: the camera is a pure function of the frame index; chunk renders are
  byte-identical; un-camera'd specs are byte-identical to today.
- **Principle II**: the camera grammar lives in the interpreter/validator alongside the
  registry — one source of truth, validated against it.
- **Principle IV**: malformed cameras are dropped and reported; the spec still renders.
- **Principle VI**: all checks run inside the one offline `npm run verify`.
- **Principle VII**: this spec names the contract change; the baseline is amended in the
  same change that ships it.
