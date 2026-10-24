# Data Model: Camera Shake and a Wider Camera Range

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Camera (changed)

| Field | Before (014) | After (016) |
| --- | --- | --- |
| `move` | `static`, `pan`, `zoom`, `push`, `parallax` | unchanged |
| `from`, `to` | `{ frame, zoom, x, y }`, `x`/`y` clamped to 0..1 | `x`/`y` clamped to **-1..2** |
| `ease` | `linear` or `smooth` | unchanged |
| `shake` | — | optional `{ amp, freq }` |

## Shake

| Field | Type | Bounds | Default | Meaning |
| --- | --- | --- | --- | --- |
| `amp` | number | 0..0.05 (clamped) | required | largest offset, as a fraction of the frame's width (x) and height (y) |
| `freq` | number | > 0, at most 5 (clamped) | 3 | base oscillations per second |

**Rules**:

- The offset for a frame is a function of that frame's time, the render seed, `amp` and
  `freq` only.
- Under `parallax`, a layer's offset is multiplied by its `depth`; under other moves, by 1.
- `amp` of 0, or no `shake`, gives frames byte-identical to the camera without one.
- A malformed `shake` is dropped and reported; the rest of the camera is kept.
- The shake applies with any `move`, including `static`.

## Camera point

`x`, `y` in a keyframe: 0.5 is the frame centre, 0 and 1 the edges. The accepted range is
-1..2 (one and a half frames from the centre in each direction). Values inside 0..1 behave
exactly as before.
