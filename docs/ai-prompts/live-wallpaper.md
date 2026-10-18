# Live audio-reactive wallpaper

## Scenario

A page where the background is alive: the visitor allows microphone access (or plays a
track), and the wall of motion behind the content dances to the signal — bars, a
`gridhorizon`, `particles`, whatever palette the site uses.

## Example prompt

```text
Build a live audio-reactive wallpaper host + page.

1. server.js (Node 22+, ESM): a tiny http server that serves index.html and a
   WebSocket endpoint. The browser sends a 64-bin spectrum array ~30 times per
   second (from an AudioContext AnalyserNode). On each message, build a
   SignalFrame: values from the spectrum, amplitude = mean level, energy =
   mean absolute level, index/t from a frame counter at 30 fps.
2. Render each frame with drawSpec onto a 1280x720 canvas from @napi-rs/canvas
   using this spec: { background: "black", layers: [{ type: "gridhorizon" },
   { type: "bars" }, { type: "particles" }] }, seed 7, reducedFlicker true.
   Validate the spec with validateAnimSpec at startup and log result.dropped.
3. Stream the frames to the page as MJPEG (or raw RGBA over WebSocket into a
   canvas via putImageData) and show them full-bleed behind the page content.

Hard rules:
- animspec runs in Node.js 22+ only (never import it in the browser).
- Always validate model/spectator input with validateAnimSpec before drawing,
  and surface result.dropped to the user.
- Deterministic: the same spec + signal + seed must give identical frames.
  Seed all randomness from the seed; never use Math.random or Date.
- Draw with the palette only (palette.bg / palette.fg / palette.accent).
- The host owns: canvas creation, audio → SignalFrame, file writing, playback.
```

## What it yields

- `server.js` — the Node host: WebSocket, SignalFrame assembly, rendering, MJPEG stream.
- `index.html` — mic permission button, analyser plumbing, full-bleed `<img>`/`<canvas>`.

## What to check

- The browser never imports `animspec` — only the server does.
- Frames carry a monotonic `index`/`t`; a recorded segment replays identically.
- Mic silence still renders (the sweep tends to quiet, it does not stall).
