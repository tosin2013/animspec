# Contract: `stickman`

```jsonc
// A presenter pointing at a line chart's newest point and speaking.
{ "layers": [
  { "type": "line-chart" },
  { "type": "stickman", "action": "point", "x": 0.12, "scale": 0.45, "targetX": 0.88, "targetY": 0.3, "speech": true }
] }
// frame: { labels: ["sales doubled"], coords: [...] }

// A crowd, host-driven: figure i stands at coords[i].
{ "layers": [{ "type": "stickman", "action": "walk", "count": 6, "from": "coords", "index": 0 }] }
```

| Promise | Holds |
| --- | --- |
| Each action animates and differs from the others | always |
| Target actions aim at `targetX`/`targetY` | always |
| One speech bubble, with `labels[0]` cut to 40 characters, only when a label exists | `speech: true` |
| Figure *i* at `coords[index + i]`, else the arrangement | `from: "coords"` |
| A crowd figure's phase and size come from the layer seed; `count: 1` equals a single figure | always |
| Every pixel is a palette colour | the `pixel` style, or `pixelMode`, on a solid background |
| No state across frames, and no figure reads another | always |
