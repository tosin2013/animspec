# Quickstart: Driving params from the signal

Give a layer a `bind` map and any numeric param follows the signal — lip-sync, beat-sync,
idle motion — with no per-primitive wiring.

## Lip-sync a host

```json
{
  "background": "black",
  "layers": [
    { "type": "rig", "rig": "host", "pose": "talk", "drive": "none",
      "bind": { "mouthOpen": { "from": "amplitude", "out": [0, 1] } } }
  ]
}
```

Render it like any spec: the mouth opens with the frame's amplitude. `drive: "none"`
keeps the primitive from adding the amplitude again (see the stacking note in the
contract).

## Beat-sync an emitter

```json
{ "type": "emitter", "shape": "spark", "source": "center",
  "bind": { "burst": { "from": "band:3", "in": [0.4, 0.9], "out": [0, 1], "curve": "smooth" } } }
```

When band 3 crosses into the mapped range, the emitter crosses its burst threshold —
the beat triggers the flash.

## Blink on a clock

```json
{ "type": "rig", "rig": "host",
  "bind": { "eyeOpen": { "from": "osc", "wave": "pulse", "period": 4.2, "duty": 0.05, "out": [1, 0] } } }
```

Eyes hold open and close for a twentieth of each 4.2 s cycle, at a phase seeded from the
render seed. Use `wave: "sine"` for a smooth drift instead.

## What to check

- The same spec + signal + seed replays identically — bindings are pure per frame.
- A malformed bind is dropped with a validator error and the layer still renders with its
  static params.
- Bound params never leave their registry bounds, whatever the mapping says.
