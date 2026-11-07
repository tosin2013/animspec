# Data Model: Stickman, the Default Avatar

## Layer `stickman` (core, category `sprite`)

The params are in [research.md](research.md) R9. Every param is scalar, and every numeric param
can be bound.

## Frame data read

| Field | When | Use |
| --- | --- | --- |
| `labels[0]` | `speech: true` | The bubble text, cut to 40 characters. Only one figure speaks. |
| `coords[index + i]` | `from: "coords"` | Figure *i*'s centre `x` and ground line `y`, clamped to 0..1. If the entry is absent, the figure falls back to its arrangement position. |
| `amplitude` | `drive` level or beat | The bob size, and the beat hop when ≥ 0.6. |
| `t` | always | The action's local time is `t·speed + phase`, where `phase` is 0 for a single figure and seeded for crowd figures. |

## Derived per figure

| Value | Source |
| --- | --- |
| position (x, ground) | the params, the arrangement, or the coordinates; plus `travel·t` (wrapping) |
| size | `scale × H`, times the seeded crowd size (±8%) |
| facing | `facing`, or under `auto`: the target, the direction of travel, or right |
| colour | `colour`, or the accent for the highlighted figure |
| pose | `POSES[action](localTime, target)` |

## Invariants

1. The same spec, signal and seed always give the same pixels: twice-rendered and chunked
   output is identical.
2. `count: 1` with no variation is identical to the single-figure path.
3. The pixel path writes only palette colours.
4. No figure reads another layer: interaction goes only through params and frame data.
