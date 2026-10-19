# Research: Camera moves and layer parallax

## R1. The camera is a closed-form function of the frame index

A camera must render any frame alone (chunking, scrub, resume) — the same requirement
that shaped the bindings (spec 013) and the frame-order gates (#32/#55).

**Decision**: `cameraState(camera, n)` is a pure function of *n* — two keyframes, eased
interpolation, no state. The interpreter computes it once per frame and applies the same
transform to every layer (with `depth` only affecting parallax).

## R2. A canvas transform around the draw; primitives stay unaware

The proposal is explicit: "implemented as a canvas transform applied before each layer's
draw; primitives stay unaware." `drawSpec` already resets nothing between layers
(primitives restore what they change), so the camera is a save/translate/scale/restore
around the layer body — and the transform is an identity without a camera.

**Decision**: wrap the per-layer draw (image included) in
`save → translate(centre) → scale(s) → translate(−lx·W, −ly·H) → draw → restore`. Identity
when `zoom = 1` and `(x, y) = (0.5, 0.5)`.

## R3. Depth applies to parallax only (clarified)

The maintainer chose: `depth` (0..1, default 1) scales the offset only under
`move: "parallax"`; pan/zoom/push move every layer together. This keeps pan/zoom/push as
genuine single-plane moves and makes parallax the multi-plane one.

**Decision**: under parallax, a layer's effective zoom is `1 + (zoom − 1)·depth` and its
looked-at point is `(0.5 + (x − 0.5)·depth, 0.5 + (y − 0.5)·depth)`; otherwise depth is
ignored and `s = zoom`, `(lx, ly) = (x, y)`.

## R4. Easing: linear + smooth only (clarified)

Matches the bindings' curve vocabulary and the Ken Burns default. `smooth` is smoothstep:
`p²(3 − 2p)`.

**Decision**: `ease: "linear" | "smooth"`, default linear.

## R5. Two keyframes only (clarified)

`from`/`to`, held before `from.frame` and after `to.frame`. A keyframe array is a future
version; nothing in the grammar blocks it later.

**Decision**: `{ move, from, to?, ease? }`; `to` required unless `move: "static"`.

## R6. Validation: drop the camera, keep the spec

A malformed camera (unknown move, non-object keyframes, `zoom` ≤ 0 or non-finite,
non-finite frames, missing `to`, `to.frame ≤ from.frame`, unknown ease) is dropped and
reported; the spec renders un-camera'd — the same drop-and-report discipline as binds.

**Decision**: `validateAnimSpec` parses and reports; `depth` is clamped (non-number → 1),
never fatal.

## R7. No new export, no new dependency, no golden movement

The camera rides the existing `drawSpec`/`validateAnimSpec` surface; golden cases carry no
camera, so the transform is a no-op for them. The schema gains `camera`/`depth`
descriptively.

**Decision**: zero new exports, zero new dependencies, no golden hash moves.
