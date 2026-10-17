# Quickstart: SignalFrame Track Format

Write a track once, read it anywhere.

## Encode

```ts
import { writeFileSync } from "node:fs";
import { encodeSignalTrack, type SignalTrack } from "animspec";

const track: SignalTrack = {
  fps: 30,
  frames: [
    { index: 0, t: 0, values: new Float64Array(64).fill(0.5), spectrum: new Float64Array(64).fill(0.25), amplitude: 0.5, energy: 0.4 },
    { index: 1, t: 1 / 30, values: new Float64Array(64).fill(0.6), spectrum: new Float64Array(64).fill(0.3), amplitude: 0.6, energy: 0.48 },
  ],
};

const { data, sidecar } = encodeSignalTrack(track);
writeFileSync("episode.asft", data);
if (sidecar !== null) writeFileSync("episode.asft.ndjson", sidecar);
```

## Decode

```ts
import { readFileSync, existsSync } from "node:fs";
import { decodeSignalTrack } from "animspec";

const data = readFileSync("episode.asft");
const sidecar = existsSync("episode.asft.ndjson") ? readFileSync("episode.asft.ndjson", "utf8") : null;
const track = decodeSignalTrack({ data, sidecar });

for (const frame of track.frames) {
  // frame.index is its position; frame.t === frame.index / track.fps
}
```

## Rules to remember

- `values` and `spectrum` must have the same length in every frame.
- Set `t = index / fps` in memory, and pass frames in index order, for a lossless round-trip.
- Everything on disk is float64; nothing is quantised to float32.
- A corrupt or future-version file throws — it never renders a best-effort guess.

## Verify

```bash
npm run verify:signalframe   # round-trip + render-identity + corrupt-input gate
```
