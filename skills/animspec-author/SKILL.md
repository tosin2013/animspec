---
name: animspec-author
description: Author deterministic, data-driven animations with animspec — a JSON spec format and Node renderer for programmatic motion graphics. Use when an agent needs to turn data (a time series, a table of values, a signal) into animated charts, bars, waveforms, tickers, captions or HUD-style graphics as rendered frames, reproducibly from a seed. Covers choosing a primitive kit, reading primitive params from the selection, writing and validating a spec, building a signal track (.asft), binding layer params to signal values, rendering frames with the CLI, and assembling frames into video with ffmpeg.
---

# animspec author

animspec is a deterministic declarative animation spec plus a reference
interpreter (npm package `animspec`, Node 22+, ESM, macOS/Linux). A **spec** is
a JSON object that says what to draw; a **SignalFrame** says what the data
looks like at one moment; a **seed** controls every random choice, so the same
spec + seed + frames always render the same pictures. That determinism is the
point: animations an agent can regenerate, diff and verify.

Version note: the npm package is **0.11.0**. The user guide's header still
says 0.8.1 — that header is stale; trust `package.json`.

## What this skill is for

- Data-driven motion graphics authored by an agent: animated bar/line charts,
  spectrum and waveform visuals, tickers, caption cards, score/HUD overlays.
- Repeatable renders: batch-producing variants of one graphic from many data
  rows by regenerating specs and frames programmatically.
- Signal-reactive pieces: layer parameters bound to values in the data
  (beat-sync, level meters, lip-sync-style rigs).
- Multi-shot pieces: a spec can carry a `sequence` of clips (see step 3).

## What it is not

- Not an After Effects / Premiere plugin and not a video editor. animspec
  renders **frames** (PNG or raw RGBA); a host tool such as ffmpeg assembles
  them into video.
- No audio. animspec renders picture only; if the deliverable needs sound,
  synthesise or attach a bed at the assembly step (step 7).
- Not a general illustration tool. It draws with a fixed vocabulary of
  primitives (29 in the current registry) inside a strict palette/font system.

## Workflow

Work through these steps in order.

### 1. Set up

```bash
node --version   # must be 22+
npm install animspec @napi-rs/canvas
```

### 2. Choose a kit — and read the params from the selection

Do not write a spec against all 29 primitives. Select a kit first; the
selection is the set of primitives you may use. Each kit adds these
specialities on top of the core set (breadth, 0..1, controls how many are
offered; the third argument is a *selection* seed, separate from the render
seed):

| Kit | Adds |
|---|---|
| `data-viz` | grid, bars, hbars, radial, wave, crosshair, scan, caption, stickman |
| `particle-lab` | particles, orbits, dots, shape, rings, spiral, wave, flash, mesh3d |
| `minimal` | wave, scan, shape, text, led, caption, rings, stickman |
| `glitch` | barcode, noise, checker, scan, flash, sweep, grid |
| `text` | text, rain, caption, led, grid, wave, scan |
| `arcade` | sprite, tetris, grid, led, scan, flash, caption, stickman |
| `dimensional` | mesh3d, orbits, spiral, radial, rings, wave, dots, caption |
| `retro` | plasma, gridhorizon, tunnel, checker, scan, noise, led |

```ts
import { select, buildVocabPrompt, buildJsonSchema } from "animspec";

const selection = select("data-viz", 0.3, 0); // kit, breadth, selection seed
const prompt = buildVocabPrompt(selection);
const schema = buildJsonSchema(selection);
```

**Params live in the selection, not in the docs.** The vocabulary documents
list each primitive's type, category, tier and description — they do NOT give
params, defaults or ranges. Every entry in the `select()` result is a full
primitive definition including its `params`. Print them before authoring:

```ts
for (const def of selection) console.log(def.type, JSON.stringify(def.params));
```

For spreadsheet-style data graphics start with `data-viz`; for titles and
captions start with `text`.

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

**Sequences.** Instead of top-level `layers`, a spec may carry a `sequence`:
an array of clips, each with `from`/`to` frame numbers, its own `layers` and
`camera`, and an optional `transition`. Camera keyframe frames inside a clip
count from that clip's start. The first clip's `transition` is ignored (the
validator reports it as a non-fatal error entry — see step 5).

**Colour.** Rendering defaults to monochrome (`creative: false`): the accent
colour and palette profiles are ignored. Pass `--creative` to the CLI (or
`creative: true` to `drawSpec`) when the piece needs colour.

### 4. Build the signal track (.asft)

The CLI renders a spec against a signal track file. Build one with
`encodeSignalTrack` — `values`/`spectrum` lengths must be fixed across all
frames:

```ts
import { encodeSignalTrack, type SignalFrame } from "animspec";
import { writeFileSync } from "node:fs";

const frames: SignalFrame[] = [];
for (let i = 0; i < 1800; i++) {
  const a = 0.5 + 0.5 * Math.sin(i / 90);              // your data goes here
  frames.push({
    index: i, t: i / 30,
    values: new Float64Array(64).fill(a),
    spectrum: new Float64Array(64).fill(a / 2),
    amplitude: a, energy: a * 0.8,
  });
}
const { data, sidecar } = encodeSignalTrack({ fps: 30, frames });
writeFileSync("track.asft", data);
if (sidecar) writeFileSync("track.asft.ndjson", sidecar); // CLI reads <track>.ndjson
```

For per-frame text read-outs, put strings in a frame's `labels` array (the
first entry feeds `caption` layers); those land in the sidecar automatically.

### 5. Always validate before rendering

Model-written specs are routinely broken. `validateAnimSpec` repairs what it
can (clamps params, fills defaults, drops unknown layers past the 12-layer
cap) and reports the rest. Never feed raw spec JSON to the renderer.

```ts
import { validateAnimSpec } from "animspec";
const { valid, spec, errors, dropped } = validateAnimSpec(rawSpec);
```

Read the result properly: **`valid: true` can still carry entries in
`errors`** — those are non-fatal notices (for example, an ignored first-clip
transition). Fix what they name when it matters, and always check `dropped`:
a non-empty `dropped` means layers you wrote were removed.

### 6. Render frames

The CLI's exact interface (there is no `--help`; this is its usage string):

```
animspec render <spec.json> --signal <track.asft> [--seed n] [--start n]
  [--end n] [--width n] [--height n] [--creative] [--assets <dir>]
  [--plugin <module>]... [--strict] (--raw | --png <dir>)
```

```bash
npx animspec render spec.json --signal track.asft \
  --seed 42 --width 1280 --height 720 --png frames/
```

Notes that bite if missed:

- `--png` takes the output **directory** as its value. There is no `--out`.
- Set `--width`/`--height` explicitly; set the same `--seed` for the whole
  animation — per-frame seed changes read as flicker.
- Frame files are **6-digit**: `000000.png`, `000001.png`, …
- Add `--strict` in CI: it makes the CLI fail on any validation error or
  dropped layer instead of rendering a degraded spec.
- The library route also works: one `drawSpec(ctx, dims, frame, spec,
  { seed, creative })` call per frame onto a `@napi-rs/canvas` canvas.

### 7. Assemble video (host step)

```bash
ffmpeg -framerate 30 -i frames/%06d.png -c:v libx264 -pix_fmt yuv420p out.mp4
```

The pattern is `%06d` — the renderer writes 6-digit names, so `%04d` finds
nothing. If the piece needs audio, animspec provides none: a tested pattern
is an ffmpeg-synthesised drone (`aevalsrc`) whose volume envelope follows the
same amplitude formula used to build the signal track, muxed in at this step.

## Rules an author agent must keep

1. **Validate first, always** (step 5). Check `errors` and `dropped` and fix
   the spec rather than rendering a silently degraded one.
2. **Stay inside the selected kit.** A primitive outside the selection is a
   spec bug, not a creative choice. If no single kit covers the piece, say
   so and re-select deliberately — do not drift.
3. **One render seed per animation.** Determinism is the feature.
4. **Data goes in SignalFrames; layout goes in the spec.** Do not bake data
   values into layer params frame-by-frame — bind them.
5. **Text layers**: `type-reveal` rows align inside a `maxWidth` box centred
   on `x`; for left-aligned text keep `x - maxWidth/2 >= 0` or the validator
   will report the wrap box off-frame. Keep captions and text inside the
   frame's margins — text placed at the very edge gets clipped in the render.
6. **Fonts** are `dejavu`, `jetbrains` or `plex` only.
7. **Verify the picture — honestly.** Inspect a contact sheet or sample
   frames before claiming a finished animation, and report the kit, both
   seeds, frame count and dimensions of every render. If your model cannot
   read images, say the render is **visually unverified** and hand stills to
   a human or a vision-capable model — do not present an unexamined render
   as checked.

## Reference

- User guide: https://github.com/tosin2013/animspec/blob/main/docs/user-guide.md
  (header version is stale; the interface notes above are verified against
  the 0.11.0 source)
- Signal track format quickstart: the repo's
  `specs/008-signalframe-format/quickstart.md`
- Vocabulary (type, category, tier, description — params come from
  `select()`, step 2): the repo's `docs/vocabulary.md` and `VOCABULARY.md`
- Gallery of primitives and loops: the repo's `docs/gallery.md`
- License: Apache-2.0
