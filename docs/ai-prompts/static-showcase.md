# Static showcase

## Scenario

The simplest possible use: a page that shows pre-rendered animspec output — the loops and
thumbnails from the repository's `loops/` and `gallery/` folders, or frames produced by the
`animspec render` command. No Node at runtime; the AI builds a build script and a page.

## Example prompt

```text
Build a static showcase page.

1. showreel.js (Node 22+, ESM): use the animspec CLI to pre-render a showreel:
   spawn `animspec render showreel.spec.json --signal showreel.asft --width
   1280 --height 720 --png frames/` (build showreel.asft with
   encodeSignalTrack from a synthetic 240-frame sweep, seed 3).
2. Encode frames/ to showreel.webm with ffmpeg, then generate index.html: a
   full-width video, a thumbnail strip from frames/ every 24th frame, and a
   caption listing the spec and seed so the reel is reproducible.

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

- `showreel.js` — the build script (track + spec + CLI render + encode).
- `showreel.webm`, `frames/`, and a static `index.html` that any host serves.

## What to check

- The page ships no JavaScript that renders — the video and images are the output.
- The caption's spec + seed regenerate the reel byte-for-byte (that is the point).
- This is also the pattern for CI: render in a build step, deploy the artifacts.
