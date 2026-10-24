# Camera contract (spec 014)

The optional spec-level `camera` and per-layer `depth`, as hosts and model authors consume
them. Primitives are transform-unaware; the interpreter applies the camera around each
layer's draw.

## Shape

```json
{
  "background": "black",
  "camera": { "move": "push", "from": { "frame": 0, "zoom": 1.0, "x": 0.5, "y": 0.5 },
              "to": { "frame": 240, "zoom": 1.25, "x": 0.55, "y": 0.45 }, "ease": "smooth" },
  "layers": [
    { "type": "plasma", "depth": 0.2 },
    { "type": "rig", "depth": 1.0 }
  ]
}
```

- `move`: `static` (holds `from`), `pan` (x/y), `zoom` (scale), `push` (both),
  `parallax` (both, scaled per layer by `depth`).
- `from`/`to`: `{ frame, zoom, x, y }`; `x`/`y` normalised (0.5 is the centre; -1..2 since
  spec 016, 0..1 before), `zoom` > 0. Two keyframes
  only; the state holds `from` before `from.frame` and `to` after `to.frame`.
- `ease`: `linear` (default) or `smooth` (smoothstep).
- `shake` (spec 016, optional): `{ amp, freq }`, a seeded, closed-form tremble in frame
  pixels, scaled by `depth` under `parallax`. See
  [specs/016-camera-shake-range/contracts/camera-shake.md](../../016-camera-shake-range/contracts/camera-shake.md).
- `depth` (per layer, 0..1, default 1): under `parallax` only, a layer moves
  `depth` of the full offset — 0 is a fixed background, 1 follows the camera. Other moves
  ignore it.

## Rules

- The camera is a closed-form function of the frame index — any frame or chunk renders
  alone; chunk renders are byte-identical.
- A spec without `camera` renders byte-identically to earlier versions.
- A malformed camera (unknown move/ease, bad keyframes, `zoom` ≤ 0, missing `to` on a
  non-static move, `to.frame ≤ from.frame`) is dropped and reported; the spec renders
  un-camera'd. `depth` clamps to 0..1 (non-number → 1). Keyframe `x`/`y` clamp to -1..2
  (spec 016). A malformed `shake` is dropped on its own; the camera is kept.
