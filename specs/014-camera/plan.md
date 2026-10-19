# Plan: Camera moves and layer parallax

## Summary

Add a spec-level `camera` (two keyframes, `linear`/`smooth` ease, moves `static|pan|zoom|push|parallax`) and a per-layer `depth` (0..1, default 1) to the AnimSpec format. The interpreter applies the camera as a save/translate/scale/restore around each layer's draw; `depth` scales the offset only under `parallax`. Closed-form per frame; un-camera'd specs are byte-identical; no golden hash moves. Constitution → 2.13.0 (MINOR); vocabulary untouched.

## Approach

1. **Interpreter** (`src/specInterpreter.ts`): the `AnimSpec` type gains `camera`; `cameraState(camera, n)` is a closed-form eased interpolation of `{zoom, x, y}`; the layer loop wraps each draw (image included) in the transform. Parallax scales zoom and offset by the layer's `depth`.
2. **Validator** (`src/specValidator.ts`): validate the camera (move/from/to/ease grammar, zoom > 0, frames finite, `to` required unless static, `to.frame` > `from.frame`); malformed → dropped + reported. `depth` clamps 0..1, non-number → 1.
3. **Registry** (`src/primitives/registry.ts`): `sanitizeLayer` preserves a clamped `depth`; `buildJsonSchema` gains `camera` (spec level) and `depth` (layer level).
4. **Gates**: camera rejection cases in `verify:validator`; camera/parallax/chunk determinism in `verify:determinism`.
5. **Governance**: constitution amendment (format + gates, MINOR) and ROADMAP row in the same change.

## Gates and golden hashes

- **Touched**: `verify:validator` and `verify:determinism` gain camera cases. Purity scan and package gate unchanged (no new export — camera rides `drawSpec`/`validateAnimSpec`).
- **Golden render hashes**: **no movement** — golden cases carry no camera, and the transform is a no-op without one.

## Constitution Check (Principle VII)

- **Boundary change**: yes — the AnimSpec contract gains spec-level `camera` and per-layer `depth`; the baseline's "The format" entry and gates table are amended in the same change (FR-009). Principle V holds: un-camera'd specs render byte-identically; camera is part of the saved contract.
- **Principles**: I (closed-form per frame; chunk equality gated), II (one camera grammar in the interpreter/validator), IV (malformed cameras dropped and reported), VI (one offline verify), VII (this spec).

## Out of scope

More than two keyframes, easing beyond linear/smooth, rotation/shear/3D, camera-driven
primitive changes, camera editors.

## Tasks

See `tasks.md`.
