# Contract: Camera Shake and Range (spec 016, amends spec 014's camera contract)

## Shape

```json
{
  "background": "black",
  "camera": {
    "move": "parallax",
    "from": { "frame": 0, "zoom": 1, "x": 0.5, "y": 0.5 },
    "to": { "frame": 240, "zoom": 1, "x": 1.5, "y": 0.5 },
    "shake": { "amp": 0.01, "freq": 4 }
  },
  "layers": [
    { "type": "gridhorizon", "depth": 0.2 },
    { "type": "figure", "depth": 1 }
  ]
}
```

- `shake.amp`: the largest offset as a fraction of the frame (0..0.05). Required.
- `shake.freq`: base oscillations per second (above 0, at most 5). Default 3.
- `from`/`to` `x`, `y`: -1..2; 0.5 is the frame centre.

## Behaviour

- The shake moves the picture left-right and up-down, irregularly, by at most `amp` of the
  frame. It is measured in the frame, so zoom does not enlarge it.
- Under `parallax` each layer shakes by `depth` of the full amount; under every other move,
  by the full amount.
- The shake depends only on the frame's time (`frame.t`), the render seed and the two
  settings. Any frame or chunk renders alone; chunked renders are byte-identical.
- A different seed gives a different shake.
- Without `shake`, or with `amp: 0`, frames are byte-identical to the camera without one.

## Validation

| Input | Result | Reported |
| --- | --- | --- |
| no `shake` | no shake | — |
| `shake` not an object | shake dropped, camera kept | `camera shake dropped (must be an object)` |
| `amp` missing or not a number | shake dropped, camera kept | `camera shake dropped (amp must be a number)` |
| `freq` not a number, or ≤ 0 | shake dropped, camera kept | `camera shake dropped (freq must be a positive number)` |
| `amp` above 0.05 or below 0, or `freq` above 5 | clamped | — |
| `x`/`y` outside -1..2 | clamped | — |

## Compatibility

- Specs whose keyframes lie inside 0..1 render exactly as before.
- Validation used to clamp `x`/`y` to 0..1; it now clamps to -1..2. A spec saved after
  validation already holds clamped values and does not change. A spec saved unvalidated, with
  a keyframe outside 0..1, now renders at its stated position once validated (an intended
  change, recorded in the changelog).

## For models

The JSON schema lists `shake` (`amp` 0..0.05, `freq` above 0 to 5) and the -1..2 range on
`x`/`y`.
