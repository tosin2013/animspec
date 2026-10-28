# Contract: Arcade HUD

## Spec usage

```jsonc
{
  "background": "black", "accent": "#e02020", "pixelMode": true,
  "layers": [
    { "type": "versus-bars", "y": 0.06, "angle": 8 },
    { "type": "hud-score", "layout": "versus" }
  ]
}
```

## Frame data (host → animspec, per frame)

```jsonc
{
  "coords": [ { "x": 0.4, "y": 0.6 }, { "x": 0.8, "y": 0.8 } ],  // left, right: fill (x), tail (y)
  "labels": [ "98", "RYU", "KEN" ]                               // versus: timer, left, right
}
```

Shooter layout labels: `[score, hiScore, credits]`.

## Promises

| Promise | Holds |
| --- | --- |
| Fill length = `x` × bar length (±1 px); tail from fill to `max(x, y)` | always |
| `versus-bars` pixels are exactly bg, fg, accent or #808080 on a solid background | always (no pixel mode needed) |
| Text comes only from `labels`; no value is invented | always |
| Same frame data, signal and seed → same pixels | always |
| No state across frames (a tail that drains is the host's data) | always |
