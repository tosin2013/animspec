# Quickstart: Real lip-sync and beat-sync

## Write a track with visemes and beats

```ts
import { encodeSignalTrack } from "animspec";

const track = {
  fps: 30,
  frames: [
    { index: 0, t: 0, values: v(), spectrum: s(), amplitude: 0.4, energy: 0.3, viseme: 0, beat: 0.0 },
    { index: 1, t: 1 / 30, values: v(), spectrum: s(), amplitude: 0.8, energy: 0.6, viseme: 14, beat: 0.9 },
    // ... frames without viseme/beat are just omitted
  ],
};
const { data, sidecar } = encodeSignalTrack(track);
```

A frame with neither field is simply absent from the chunk; the track stays byte-identical
to a pre-015 encode when no frame has either.

## Drive a mouth from the viseme

```json
{ "type": "rig", "rig": "host", "drive": "none",
  "bind": { "mouthOpen": { "from": "viseme", "in": [0, 14], "out": [0.15, 1] } } }
```

## Trigger a burst on the beat

```json
{ "type": "emitter", "shape": "spark",
  "bind": { "burst": { "from": "beat", "in": [0.5, 0.9], "out": [0, 1], "curve": "smooth" } } }
```

## What to check

- `viseme`/`beat` round-trip bit-identically; absent fields stay absent.
- A frame without the bound feature falls back to the static param value.
- The same track + spec + seed replays byte-identically.
