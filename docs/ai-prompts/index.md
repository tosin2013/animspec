# Prompting an AI to build an animspec host

animspec renders in **Node.js** — the same spec, signal and seed always produce the same
frames. It does not run in a browser: `@napi-rs/canvas` is a native Node module. So a
webpage that uses animspec is two halves, and an AI can build both:

| Half | What it does | Who owns it |
| --- | --- | --- |
| **Node host** | renders frames with `drawSpec` (or drives the `animspec render` command) | this library + the AI's code |
| **Browser page** | displays the frames and takes the controls (seed, spec, mic, chat) | the AI's code |

Audio decoding, model calls, storage and playback stay with the host too — animspec draws.

## What to hand the model

A model can only use what you show it. Three things, in this order:

1. **The vocabulary** — generated from the registry, never hand-pasted:

   ```js
   import { PRIMITIVES, select, buildVocabPrompt, buildJsonSchema } from "animspec";

   const subset = select(PRIMITIVES, { kit: "auto", breadth: 16, seed: 7 });
   const vocabPrompt = buildVocabPrompt(subset);   // one line per primitive
   const schema = buildJsonSchema(subset);         // JSON schema for structured output
   ```

   Browsing [VOCABULARY.md](../VOCABULARY.md) and the [gallery](https://tosin2013.github.io/animspec/gallery) helps you *choose* the kit; the generated prompt is what the model should *see*.

2. **The public API** — `drawSpec`, `validateAnimSpec`, the SignalFrame track
   (`encodeSignalTrack` / `decodeSignalTrack`, and the per-frame reader
   `readSignalTrackHeader` / `readSignalFrame` / `indexSignalTrackSidecar`),
   `VOCABULARY_VERSION`, and the `animspec render` command for pre-rendering.

3. **The rules** — paste this into every prompt:

   ```text
   Hard rules:
   - animspec runs in Node.js 22+ only (never import it in the browser).
   - Always validate model/spectator input with validateAnimSpec before drawing,
     and surface result.dropped to the user.
   - Deterministic: the same spec + signal + seed must give identical frames.
     Seed all randomness from the seed; never use Math.random or Date.
   - Draw with the palette only (palette.bg / palette.fg / palette.accent).
   - The host owns: canvas creation, audio → SignalFrame, file writing, playback.
   ```

## The recipe

```text
Build a small host + page:

1. server.js (Node 22+, ESM): import { createCanvas } from "@napi-rs/canvas"
   and { drawSpec, validateAnimSpec } from "animspec". Render <describe the
   scene> as <W>x<H> frames, seeded with <seed>, using this signal source:
   <amplitude from the mic / a track file / a synthetic sweep>. Serve the
   frames to the page as <MJPEG / WebSocket / PNG per frame>.
2. index.html: show the stream and these controls: <seed, spec JSON, sliders>.
3. Keep rendering deterministic; validate any user-edited spec and show
   result.dropped on the page.
<the hard rules block>
```

Pick a concrete shape from the use cases below, or write your own — the template
([use-case-template.md](./use-case-template.md)) shows the structure each case file
follows, and PRs that add one are welcome (see
[contributing](../contributing#add-an-ai-prompting-use-case)).

## Use cases

| Case | File |
| --- | --- |
| Live audio-reactive wallpaper (mic → frames) | [live-wallpaper.md](./live-wallpaper.md) |
| Kinetic-type landing page | [kinetic-type.md](./kinetic-type.md) |
| Quote / testimonial wall | [quote-wall.md](./quote-wall.md) |
| Talking avatar (rig driven by mic or a track) | [talking-avatar.md](./talking-avatar.md) |
| Chat assistant with an animated presence ("Jarvis") | [chat-assistant.md](./chat-assistant.md) |
| Spec sandbox (edit JSON → render → dropped report) | [spec-sandbox.md](./spec-sandbox.md) |
| Static showcase (pre-rendered loops / CLI PNGs) | [static-showcase.md](./static-showcase.md) |

## What to check in the AI's output

- It did **not** import `animspec` in browser code — the split above holds.
- Every path that draws goes through `validateAnimSpec`, and `result.dropped` is shown.
- The seed is a parameter, not a constant buried in the code; the same inputs replay.
- Text layers rely on the shipped fonts (no `font-family` that assumes a machine font).
- Anything temporal comes from the signal or the frame index — never the wall clock.
