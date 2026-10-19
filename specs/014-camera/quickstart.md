# Quickstart: Camera moves and parallax

Give a spec a `camera` and the whole frame pans, zooms or pushes; give layers a `depth`
and parallax separates them.

## A slow push-in

```json
{ "background": "black", "layers": [{ "type": "grid" }, { "type": "wave" }],
  "camera": { "move": "push", "from": { "frame": 0, "zoom": 1.0, "x": 0.5, "y": 0.5 },
              "to": { "frame": 240, "zoom": 1.25, "x": 0.55, "y": 0.45 }, "ease": "smooth" } }
```

Over frames 0–240 the frame pushes in 1.25× toward a point drifting right and up.

## Ken Burns pan

```json
{ "camera": { "move": "pan", "from": { "frame": 0, "zoom": 1, "x": 0.3, "y": 0.5 },
              "to": { "frame": 300, "zoom": 1, "x": 0.7, "y": 0.5 }, "ease": "linear" } }
```

## Parallax between layers

```json
{ "camera": { "move": "parallax", "from": { "frame": 0, "zoom": 1, "x": 0.5, "y": 0.5 },
              "to": { "frame": 200, "zoom": 1.3, "x": 0.7, "y": 0.5 } },
  "layers": [
    { "type": "plasma", "depth": 0.0 },
    { "type": "mesh3d", "depth": 0.4 },
    { "type": "rig",    "depth": 1.0 }
  ] }
```

The background is pinned, the mid layer drifts at 0.4 of the move, the character follows
the camera.

## What to check

- A camera spec replayed with the same seed is byte-identical; chunked renders equal the
  whole.
- A malformed camera is dropped with a validator error and the spec still renders.
- `depth` only changes anything under `move: "parallax"`.
