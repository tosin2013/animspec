# Quickstart: Reading a SignalFrame track frame by frame

Scrub to any frame, or render a chunk, without decoding the whole track. The file on disk
is unchanged from spec 008 — only the way you read it differs.

## Random access to one frame

```ts
import { readFileSync } from "node:fs";
import {
  readSignalTrackHeader, readSignalFrame, indexSignalTrackSidecar,
} from "animspec";

const bytes = readFileSync("episode.asft");          // or a memory-mapped view
const sidecar = readFileSync("episode.asft.ndjson", "utf8");

const header = readSignalTrackHeader(bytes);          // validates the whole file once
const perFrame = indexSignalTrackSidecar(sidecar, header.frameCount);

// frame N — reads only its own record, wherever N points
const frame = readSignalFrame(bytes, header, 41_237, sidecar);
// frame.index === 41237, frame.t === 41237 / header.fps
```

A worker that renders a contiguous range reads the header and sidecar index once, then
calls `readSignalFrame` for each frame in its range. Cost per frame is the record alone,
regardless of how long the track is.

## Same result, either way

For every frame, the per-frame read equals the whole-track decode:

```ts
import { decodeSignalTrack } from "animspec";

const whole = decodeSignalTrack({ data: bytes, sidecar });
// whole.frames[n] deep-equals readSignalFrame(bytes, header, n, sidecar)
```

The verify gate proves this for the committed sample track on every `npm run verify`.

## Rules to remember

- The header read validates the file once (magic, version, fps, frame count, exact
  length); a corrupt file throws before any frame is read.
- `n` must be in `[0, frameCount)`; there is no clamping and no guessing.
- Unknown sidecar fields are ignored by v1 readers; a recognised field with the wrong
  shape throws.
- The library never touches the filesystem: you read or map the file, the library reads
  bytes.

## Byte-level conformance

`golden/signalframe/sample.asft` (+ `.ndjson`) is the committed reference track: 4 frames,
4+4 bands, frame 2 carrying `labels` and `coords`. Writers in any language can assert
their output against those exact bytes (SHA-256 is pinned in the repository). If the
library's encoder ever produces different bytes, `npm run verify` fails — the file cannot
silently drift.
