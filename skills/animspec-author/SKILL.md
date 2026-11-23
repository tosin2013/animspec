---
name: animspec-author
description: Author deterministic, data-driven animations with animspec — a JSON spec format and Node renderer for programmatic motion graphics. Use when an agent needs to turn data (a time series, a table of values, a signal) into animated charts, bars, waveforms, tickers, captions or HUD-style graphics as rendered frames, reproducibly from a seed. Covers choosing a primitive kit, reading primitive params from the selection, writing and validating a spec, building a signal track (.asft), binding layer params to signal values, rendering frames with the CLI, and assembling frames into video with ffmpeg. Picture only; adding audio is a manual ffmpeg step the user owns.
license: Apache-2.0
compatibility: Requires Node.js 22+ and npm on macOS or Linux. ffmpeg is needed only to assemble video; GitHub access only to file vocabulary gaps.
metadata:
  author: tosin2013
  version: "2.4"
  animspec: "0.12.0"
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
- Multi-shot pieces: a spec can carry a `sequence` of clips (see step 3).

## What it is not

- Not an After Effects / Premiere plugin and not a video editor. animspec
  renders **frames** (PNG or raw RGBA); a host tool such as ffmpeg assembles
  them into video.
- No audio. animspec renders picture only, and this skill never decodes,
  analyses or designs audio. `viseme` and `beat` values arrive precomputed in
  the `.asft` (the host computes them). If the deliverable needs sound, adding
  it is the user's job at the assembly step: step 7 shows the plain ffmpeg
  recipe.
- Not a general illustration tool. It draws with a fixed vocabulary of
  primitives (45 at vocabulary version 23) inside a strict palette/font system.

## Workflow

Work through these steps in order.

### 0. Inventory the environment

Before setting anything up, find out what this environment can actually do,
and report it in one short block before step 1:

```bash
node --version            # 22+ required
ffmpeg -version | head -1 # needed only for step 7 (assembly)
node -p process.arch      # arm64 or x64; record it with every render
df -h .                   # free disk: 1280×720 PNG frames run ~1–2 MB each
```

Also record, from what you know about your own harness:

- whether you can **view images** (rule 7 depends on it);
- whether you have **write access** to the working directory and to the
  animspec repo (filing gaps, last section, needs GitHub access);
- the **processor type** above: byte-identical frames are promised only on
  the same processor type (within 8 of 255 across arm64 and x64), so a render
  is reproduced on the same type.

Build only from what the inventory finds. State any missing capability up
front ("no ffmpeg: I will deliver PNG frames, not an MP4"; "I can't view
images: the render will be visually unverified") rather than discovering it
mid-render.

### 1. Set up

```bash
node --version   # must be 22+
npm install animspec @napi-rs/canvas
```

In a bare directory with no `package.json`, run `npm init -y` first —
without it the install can fail with npm's `Tracker "idealTree" already
exists` error.

### 2. Choose a kit — and read the params from the selection

Do not write a spec against the whole registry. Select a kit first; the
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

**Read params from the selection.** Every entry in the `select()` result is a
full primitive definition including its `params` (types, ranges, defaults,
descriptions). From animspec 0.12.0 the same tables are also generated onto
the vocabulary page (`VOCABULARY.md`, Params section); on older versions the
selection is the only source. Print them before authoring:

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
frames. The snippet below is TypeScript: to run it with plain `node` as an
`.mjs` file, drop the `type SignalFrame` import and the `: SignalFrame[]`
annotation (or save it as `.ts` and use a TypeScript runner):

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

**Save the render manifest as the handoff.** The CLI prints a manifest as its
last JSON line on stderr: `version`, `vocabulary`, `canvas`, `arch`, `width`,
`height`, `start`, `end`, `seed`, `frames` and `creative`, plus (from 0.12.0)
`fps`, `specSha256` and `signalSha256`, and `pixelAspect`, `assets`, `plugins`
or `clips` when used. Capture it beside the frames:

```bash
npx animspec render spec.json --signal track.asft --seed 42 \
  --width 1280 --height 720 --png frames/ 2> render.log
grep '"manifest"' render.log | tail -1 > render-manifest.cli.json
```

Then write `render-manifest.json`: the CLI manifest's fields plus the ones only
you know (kit, selection seed, frame pattern, cues, whether you verified the
picture, substitutions). The field table and sources are in
[references/render-manifest.md](references/render-manifest.md). Every render
you deliver leaves `render-manifest.json` beside its frames.

### 7. Assemble video (host step)

Needs ffmpeg (step 0). If the inventory found none, deliver the PNG frames
and `render-manifest.json` and say so.

```bash
ffmpeg -framerate 30 -i frames/%06d.png -c:v libx264 -pix_fmt yuv420p picture.mp4
```

Use the manifest's `fps` for `-framerate`. The pattern is `%06d`: the
renderer writes 6-digit names, so `%04d` finds nothing.

**Adding audio is the user's job.** animspec makes no sound, and this skill
does no sound design. When the user wants audio, say so, hand them the picture
plus the manifest, and show them the plain ffmpeg recipes in
[references/audio-handoff.md](references/audio-handoff.md) (add a track; voice
plus a ducked music bed). Mixing, loudness and cue timing belong to a studio or
director tool when one is present.

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
7. **Verify the picture — honestly — and report the manifest.** Inspect a
   contact sheet or sample frames before claiming a finished animation. If
   your inventory (step 0) says you cannot view images, say the render is
   **visually unverified**, set `visuallyVerified: false`, and hand stills to
   a human or a vision-capable model — do not present an unexamined render as
   checked. Report each render by its `render-manifest.json` (step 6): it
   carries the kit, both seeds, frame count, dimensions and inputs' digests.

## When the vocabulary can't draw it

Sooner or later a brief will need something the vocabulary does not have — a
missing action on a figure, a motion no primitive produces. Handle it in this
order:

1. **Verify the gap before claiming it.** Check the full registry (your
   selection plus the vocabulary documents) and try params and `bind`s. Many
   "gaps" are an existing primitive with different params — those are not
   gaps, and the repo will decline them as such.
2. **Substitute deliberately, and say so.** If the piece must ship, use the
   nearest expressible alternative and state the substitution plainly in your
   report (what was wanted, what you used instead). Never let a substitution
   pass silently as the requested thing.
3. **File the gap**, one issue per gap, with the repo's **"Unsupported
   animation"** template. Its fields, the different vehicle for a brand-new
   primitive or a new action on an existing one, and what to do without
   GitHub access are in [references/filing-gaps.md](references/filing-gaps.md).
   A gap reported with its fields filled is filed work; a gap mentioned in
   passing is lost.

## Reference

- User guide: https://github.com/tosin2013/animspec/blob/main/docs/user-guide.md
  (its header names the package version; a registry check keeps them equal
  from 0.12.0)
- Signal track format quickstart: the repo's
  `specs/008-signalframe-format/quickstart.md`
- Vocabulary (type, category, tier, description, and from 0.12.0 a Params
  table per primitive; `select()` returns the same params, step 2): the
  repo's `docs/vocabulary.md` and `VOCABULARY.md`
- Gallery of primitives and loops: the repo's `docs/gallery.md`
- Prompt library for AI-built hosts: the repo's `docs/ai-prompts/` —
  worked prompts for building animspec host apps and scene writers,
  including the stickman scene prompts (`stickman-choreography.md`,
  `stickman-interactive.md`, `stickman-narrator.md`). Adjacent to
  single-spec authoring, but the first place to look for figure and
  scene choreography patterns.
- Issue templates: the repo's `.github/ISSUE_TEMPLATE/` (`unsupported-animation.yml`, `primitive-proposal.md`)
- This skill's own references (loaded only when needed):
  [render-manifest.md](references/render-manifest.md),
  [audio-handoff.md](references/audio-handoff.md),
  [filing-gaps.md](references/filing-gaps.md)
