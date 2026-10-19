# Bind contract (spec 013)

The optional per-layer `bind` map, as hosts and model authors consume it. Byte layout,
validation philosophy and versioning live in the spec 008 contract; this adds the one
reactive field.

## Shape

```json
{ "type": "rig", "bind": {
    "mouthOpen": { "from": "amplitude", "out": [0, 1] },
    "headAngle": { "from": "band:3", "in": [0, 1], "out": [-8, 8], "curve": "smooth" },
    "eyeOpen":   { "from": "osc", "wave": "pulse", "period": 4.2, "duty": 0.05, "out": [1, 0] }
} }
```

- Keys: declared **numeric** params of the layer's primitive (enum/boolean/string targets
  are rejected).
- `from`: `amplitude` | `energy` | `band:<n>` | `osc`.
- `in` (default `[0, 1]`): the feature range; the feature is clamped into it, then
  normalised. `out` (default the param's registry bounds): the driven range.
- `curve`: `linear` (default) or `smooth` (smoothstep of the normalised position).
- `osc` only: `wave` (`pulse`, default — `out[0]` except for `duty` of each `period`
  seconds, when `out[1]`) or `sine` (smooth swing between `out[0]` and `out[1]`);
  `period` > 0 in seconds; `duty` in 0..1. The pulse/sine phase is seeded from the render
  seed, the layer index and the param name — deterministic per render, distinct across
  layers.

## Rules

- Evaluation happens per frame from the current SignalFrame (and `t`/seed for `osc`).
  No smoothing, no state across frames — hosts pre-smooth the track.
- A binding overrides the static param value each frame. A primitive's internal signal
  read for the same quantity still applies on top (documented stacking; e.g. do not bind
  `rig.mouthOpen` while also using `drive: "amplitude"`).
- A bind that cannot evaluate on a given frame (band index beyond the track's bands)
  falls back to the static value for that frame.
- Malformed binds (unknown target, non-numeric target, unknown `from`, malformed ranges,
  bad `period`/`duty`) are dropped and reported by the validator; the layer renders with
  static params.
- Specs without `bind` render byte-identically to earlier versions; bound specs are part
  of the saved contract and keep rendering under Principle V.
