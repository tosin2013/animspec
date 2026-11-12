---
name: animspec-author
description: Author deterministic, data-driven animations with animspec — a JSON spec format and Node renderer for programmatic motion graphics. Use when an agent needs to turn data (a time series, a table of values, a signal) into animated charts, bars, waveforms, tickers, captions or HUD-style graphics as rendered frames, reproducibly from a seed. Covers choosing a primitive kit, writing and validating a spec, binding layer params to signal values, rendering frames with the CLI, and assembling frames into video with ffmpeg.
---

# animspec author

animspec is a deterministic declarative animation spec plus a reference
interpreter (npm package `animspec`, Node 22+, ESM, macOS/Linux). A **spec** is
a JSON object that says what to draw; a **SignalFrame** says what the data
looks like at one moment; a **seed** controls every random choice, so the same
spec + seed + frames always render the same pictures. That determinism is the
point: animations an agent can regenerate, diff and verify.

## What this skill is for

- Data-driven motion graphics authored by an agent: animated bar/line charts,
  spectrum and waveform visuals, tickers, caption cards, score/HUD overlays.
- Repeatable renders: batch-producing variants of one graphic from many data
  rows by regenerating specs and frames programmatically.
- Signal-reactive pieces: layer parameters bound to values in the data
  (beat-sync, level meters, lip-sync-style rigs).

## What it is not

- Not an After Effects / Premiere plugin and not a video editor. animspec
  renders **frames** (PNG or raw RGBA); a host tool such as ffmpeg assembles
  them into video.
- Not a general illustration tool. It draws with a fixed vocabulary of
  primitives (29 in the current registry) inside a strict palette/font system.

## Workflow

Work through these steps in order.

### 1. Set up

```bash
node --version   # must be 22+
npm install animspec @napi-rs/canvas
```

### 2. Choose a kit — never offer the whole vocabulary

Do not write a spec against all 29 primitives. Select a kit first and author
only against the primitives it offers:

```ts
import { select, buildVocabPrompt, buildJsonSchema } from "animspec";

const selection = select("data-viz", 0.3, 0); // kit, breadth 0..1, seed
const prompt = buildVocabPrompt(selection);   // describe these to yourself/the model
const schema = buildJsonSchema(selection);    // JSON schema for the spec
```

Kits: `auto`, `data-viz`, `particle-lab`, `minimal`, `glitch`, `text`,
`arcade`, `dimensional`, `retro`. For spreadsheet-style data graphics start
with `data-viz`; for titles and captions start with `text`.

### 3. Write the spec

A spec is `{ background, layers }` plus optional `camera`, `sequence`,
`font` and more. Layers draw back to front, at most **12** per clip.

```json
{
  "background": "black",
  "font": "jetbrains",
  "layers": [
    { "type": "grid", "cols": 64, "rows": 36, "threshold": 0.2 },
    { "type": "bars", "bind": { "level": { "from": "band:2", "out": [0, 1] } } },
    { "type": "caption" }
  ]
}
```

Data enters through the SignalFrame, not the spec: each frame carries
`values` (a Float64Array of 0..1 bands), `spectrum`, `amplitude` and `energy`.
A layer's `bind` map drives any numeric param from the frame each frame —
`from` is `amplitude`, `energy`, `band:<n>`, `viseme`, `beat`, or a
deterministic `osc`. To animate a data series, generate one SignalFrame per
output frame with the series mapped into `values`/`amplitude`.

### 4. Always validate before rendering

Model-written specs are routinely broken. `validateAnimSpec` repairs what it
can (clamps params, fills defaults, drops unknown layers past the 12-layer
cap) and reports the rest. Never feed raw spec JSON to the renderer.

```ts
import { validateAnimSpec } from "animspec";
const { valid, spec, errors, dropped } = validateAnimSpec(rawSpec);
```

### 5. Render frames

Library route — one `drawSpec(ctx, dims, frame, spec, { seed })` call per
frame onto a `@napi-rs/canvas` canvas, then encode each canvas to PNG.

CLI route — renders a spec against a signal track file:

```bash
npx animspec render spec.json --signal track.asft --png --out frames/
```

Use the **same seed across a whole animation** unless per-frame noise is the
effect you want.

### 6. Assemble video (host step)

```bash
ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -pix_fmt yuv420p out.mp4
```

## Rules an author agent must keep

1. **Validate first, always** (step 4). Check `errors` and `dropped` and fix
   the spec rather than rendering a silently degraded one.
2. **Stay inside the selected kit.** A primitive outside the selection is a
   spec bug, not a creative choice.
3. **One seed per animation.** Determinism is the feature; changing seeds
   mid-sequence reads as flicker.
4. **Data goes in SignalFrames; layout goes in the spec.** Do not bake data
   values into layer params frame-by-frame — bind them.
5. **Text layers**: `type-reveal` rows align inside a `maxWidth` box centred
   on `x`; for left-aligned text keep `x - maxWidth/2 >= 0` or the validator
   will report the wrap box off-frame.
6. **Fonts** are `dejavu`, `jetbrains` or `plex` only.
7. **Report honestly**: state the kit, seed, frame count and dimensions of
   every render, and show a contact sheet or sample frames before claiming a
   finished animation.

## Reference

- User guide: https://github.com/tosin2013/animspec/blob/main/docs/user-guide.md
- Vocabulary (every primitive, its params and tier): the repo's
  `docs/vocabulary.md` and `VOCABULARY.md`
- Gallery of primitives and loops: the repo's `docs/gallery.md`
- License: Apache-2.0
