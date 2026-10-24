# Feature Specification: Clip Sequences

**Feature Branch**: `feature/025-clip-sequences`

**Created**: 2026-10-24

**Status**: Draft

**Input**: Issue #91: "Spec-level clip sequence using absolute frame indices, with transitions (wipe, iris, etc.) as a sequence field rather than as primitives. Must stay frame-order independent." This is the last item on the Motion Studio integration list: the Director layer's shot list compiles into a sequence, so Motion Studio doesn't have to stitch shots together itself.

Maintainer decisions (2026-10-24):

- The transitions are `cut`, `wipe`, `iris` and `fade`.
- A fade is composition between two clips of the same spec, rendered inside animspec. It is not a filter on a finished frame, so post-process effects stay out of scope (the #90 decision stands).

## User Scenarios & Testing *(mandatory)*

A spec today is a single shot: one set of layers for the whole render. A documentary or
explainer is a sequence of shots (title card, diagram, character scene, closing card), joined
by cuts, wipes, iris transitions and fades. Today a host renders each shot separately and
stitches the frames itself. That loses the single declarative spec, and every host
re-implements transitions differently.

### User Story 1 - Declare a sequence of shots (Priority: P1)

An author writes a spec as a list of clips. Each clip has an absolute frame range and its own
layers (and, optionally, its own camera). Frame *n* renders whichever clip owns *n*.

**Why this priority**: It is the core of #91, and what a shot list compiles into.

**Independent Test**: A three-clip sequence renders each clip's layers inside its range. Any frame rendered alone equals the same frame from a sequential render.

**Acceptance Scenarios**:

1. **Given** a `sequence` of clips with ranges [0, 60), [60, 150) and [150, 210), **When** frame 75 renders, **Then** it shows the second clip's layers and nothing from the others.
2. **Given** a clip, **When** its layers render, **Then** the frame's time and index start at 0 at the clip's first frame. Each shot animates from its own beginning, while the signal (amplitude, spectrum, labels and so on) is the one at the absolute frame.
3. **Given** a clip with its own camera, **When** it renders, **Then** that camera applies to that clip only, with keyframes relative to the clip's first frame.
4. **Given** a frame outside every clip, **When** it renders, **Then** it shows only the background.
5. **Given** any frame index, **When** it is rendered alone, in chunks, or in any order, **Then** it is byte-identical to the same frame from a sequential render. Sequences are frame-order independent.
6. **Given** a spec without `sequence`, **When** it renders, **Then** every frame is byte-identical to before this feature.

---

### User Story 2 - Join shots with transitions (Priority: P2)

An author gives a clip a transition in from the previous clip, with a type and a length in
frames. During the transition, both clips render and are combined by the transition.

**Why this priority**: Transitions are #91's named example, and the reason they belong in the spec rather than in each host.

**Independent Test**: For each transition type, frames inside the transition combine both clips the way the type says. Frames outside it show one clip only.

**Acceptance Scenarios**:

1. **Given** clip B with `transition: { type: "cut" }`, **When** frames render around B's start, **Then** the previous clip shows up to the last frame before B's start and B shows from it. There is no blend.
2. **Given** `type: "wipe"`, a direction (`left`, `right`, `up` or `down`) and a length of *k* frames, **When** the transition plays, **Then** a straight edge sweeps across the frame. Every pixel comes entirely from one clip or the other, and the share showing B grows from 0 to 1 over the *k* frames.
3. **Given** `type: "iris"`, **When** it plays, **Then** a circle centred on the frame grows (iris open) to reveal B. Every pixel comes entirely from one clip or the other.
4. **Given** `type: "fade"`, **When** it plays, **Then** each pixel is a mix of the two clips' pixels, moving steadily from the outgoing clip to the incoming one.
5. **Given** a transition, **When** it plays, **Then** it occupies the first *k* frames of the incoming clip. The outgoing clip keeps rendering during that time as if its range continued, with its own clip time still advancing.
6. **Given** a transition longer than the incoming clip, or a transition on the first clip, **When** the spec is validated, **Then** it is clamped to the incoming clip's length, or ignored for the first clip, and reported.

---

### User Story 3 - Shot lists from models and hosts (Priority: P3)

A model or a host (Motion Studio's Director) writes a sequence spec and gets clear validation:
overlapping or unordered clips are reported, and the JSON schema describes the sequence.

**Why this priority**: The Director compiles shot lists automatically, so errors must be reported precisely, never silently accepted.

**Independent Test**: The schema describes `sequence`. Overlapping, unordered, empty or over-long sequences are reported. A valid shot list validates with 0 errors.

**Acceptance Scenarios**:

1. **Given** clips that overlap or are out of order, **When** the spec is validated, **Then** the offending clips are dropped and reported, and the rest render.
2. **Given** a clip with no valid layers, or an empty frame range, **When** it is validated, **Then** it is dropped and reported.
3. **Given** a spec with both `sequence` and top-level `layers`, **When** it is validated, **Then** the top-level `layers` are ignored and that is reported. A sequence spec's layers live in its clips.
4. **Given** the CLI renders a sequence spec over any range, **When** it writes frames, **Then** they equal in-process frames, and the manifest records the clip count.

### Edge Cases

- **A gap between clips**: frames in the gap show only the background. A transition into a clip after a gap blends from the background.
- **Clips at the layer cap**: each clip has up to 12 layers. A transition frame renders two clips. It must stay within the composition budget; otherwise the layers per clip during transitions are capped and that is reported.
- **Binds, `depth`, plugins, images, sprite sheets**: they work inside clips as they do in a single-shot spec. A bind's oscillator uses clip time.
- **Seeds**: each clip's layers get seeds that depend on the clip's position, so identical layers in two clips don't repeat exactly.
- **Transparent background**: transitions combine the two clips before the background is lifted, so a fade over a transparent background fades alpha too.
- **The camera**: a sequence spec's top-level `camera` is ignored and reported. Cameras belong to clips.
- **Too many clips**: at most 64 clips per sequence. Extras are dropped and reported.

## Requirements *(mandatory)*

### Functional Requirements

**Sequence**

- **FR-001**: A spec MUST accept an optional `sequence`: up to 64 clips, each with an absolute frame range (`from` inclusive, `to` exclusive, non-negative integers, `from < to`), its own layers (up to 12), an optional camera, and an optional `transition`.
- **FR-002**: Clips MUST be ordered and non-overlapping. Violations MUST be dropped and reported, and the rest of the sequence kept.
- **FR-003**: A frame MUST render the clip whose range contains it, or only the background when none does.
- **FR-004**: Inside a clip, the frame index and time passed to layers and the camera MUST be relative to the clip's first frame. The signal fields MUST be those of the absolute frame.
- **FR-005**: A frame MUST be a pure function of spec, signal, seed and absolute frame index, so it is frame-order independent and chunk-stable.
- **FR-006**: Without `sequence`, every frame MUST be byte-identical to before this feature. With `sequence`, top-level `layers` and `camera` MUST be ignored and reported.

**Transitions**

- **FR-007**: A clip MAY declare `transition: { type, frames, direction? }`: `type` is `cut`, `wipe`, `iris` or `fade`; `frames` is 1 to 600 (ignored for `cut`); `direction` (`left`, `right`, `up`, `down`) is for `wipe`, with `right` as the default.
- **FR-008**: A transition MUST occupy the incoming clip's first `frames` frames. During it the outgoing clip MUST keep rendering with its clip time continuing. The transition's progress MUST run linearly from 0 to 1 over those frames.
- **FR-009**: `wipe` and `iris` MUST take each pixel wholly from one clip. `fade` MUST mix each pixel of the two clips by the transition progress. These combine two renders of the same spec inside animspec. They are not effects applied to a finished frame.
- **FR-010**: A transition on the first clip MUST be ignored and reported. One longer than the incoming clip MUST be clamped and reported.

**Everywhere**

- **FR-011**: The JSON schema MUST describe `sequence`. The CLI MUST render sequence specs over any range, identically to in-process rendering, and record the clip count in its manifest.
- **FR-012**: Every existing reference frame MUST stay byte-identical. New reference cases MUST cover a plain sequence, each transition type, a gap, and a per-clip camera.
- **FR-013**: The constitution MUST be amended in the same change: "The format" gains `sequence`, with an explicit note that transitions compose two clips of a spec and are not post-process effects. This is a MINOR version (6.0.0 → 6.1.0).
- **FR-014**: Every check MUST run inside the one offline verify command.

### Key Entities

- **Clip**: an absolute frame range, a set of layers, an optional camera, and an optional transition in.
- **Transition**: a type, a length, and for wipes, a direction; it plays over the start of the incoming clip.
- **Sequence**: the ordered, non-overlapping list of clips that makes up a spec.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical, in both reference sets.
- **SC-002**: In a three-clip sequence, frames sampled from each clip show only that clip's layers (3 of 3), and gap frames are background only.
- **SC-003**: Frames rendered alone equal the same frames from a sequential render, across clip boundaries and inside each transition type (checked on at least three frames per type).
- **SC-004**: In wipe and iris frames, 100% of pixels equal the corresponding pixel of one clip or the other. In fade frames, every pixel lies between the two clips' pixels.
- **SC-005**: Each invalid input (overlap, out of order, empty range, empty clip, a transition on the first clip, an over-long transition, top-level layers beside a sequence) is reported (7 of 7).
- **SC-006**: Verify passes offline, and the build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For Motion Studio's Director and other hosts**: a shot list compiles into one spec, and animspec renders any frame of the whole programme, transitions included, deterministically.

### In scope

- The `sequence` format field, clip rendering with clip-relative time, and the four transitions.
- Validation, schema and CLI support.
- References, a showcase sequence and docs.
- The constitution amendment.

**Boundary change**: a contract change under Principle VII. "The format" gains `sequence`. A MINOR amendment records that transitions are composition, so post-process effects stay out of scope.

### Out of scope

- **Transitions beyond the four**: no dissolves with patterns, no push or slide moves.
- **Easing curves** for transitions (linear only in this spec).
- **Audio**: per-clip signals or audio crossfades. The signal is the host's one track.
- **Nested sequences.**
- **Finish effects** (#90, Motion Studio).

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: a pure function of the absolute frame. Chunk-stable and order-independent, within the cross-type tolerance.
- **Principle III**: a fade mixes two palette-legal renders, so its pixels are mixes of palette colours. The amendment's note states that this is composition, not post-processing.
- **Principle IV**: malformed sequences are dropped and reported, and the rest renders.
- **Principle V**: no existing frame moves.
- **Principle VI**: one offline verify command.

## Assumptions

- **Clip-relative time** matches how shot lists are authored: each shot starts at its own zero. The signal stays absolute because there is one soundtrack.
- **Transitions sit at the start of the incoming clip** (not centred on the cut), so a clip's `from` is the first frame where it appears.
- **64 clips, 600-frame transitions** are generous bounds for programmes and shot lists.
- **Linear progress** is enough for a first version; easing can follow.
- **Scope source**: issue #91, the Motion Studio integration list, and the maintainer decisions of 2026-10-24.
