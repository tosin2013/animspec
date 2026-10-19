# animspec User Guide

**Version:** 0.2.1
**Last Updated:** 2026-10-18
**Audience:** developers who render deterministic animation from Node.js

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Features](#features)
4. [Embedding](#embedding)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)
7. [Support](#support)
8. [Appendix](#appendix)

---

## Introduction

### What is animspec?

animspec is a TypeScript library that renders animation frames. You describe what to draw with a JSON spec, you supply a signal reduced to numbers, and the library draws one frame onto a canvas. The same spec, signal and seed always produce the same frame. The library ships 29 drawing primitives and three fonts.

### Who should use this manual?

This manual is for developers who install animspec and call it from their own code. It is also for teams that ask a language model to write specs.

### Document scope

This manual covers:

- Installing the library
- Writing a spec
- Building a signal frame
- Rendering frames with `drawSpec`
- Validating raw spec JSON with `validateAnimSpec`
- Selecting a vocabulary subset for a model
- Choosing a font
- Embedding animspec in a host application that renders whole videos

This manual does not cover:

- Adding a new primitive. See [CONTRIBUTING.md](../CONTRIBUTING.md)
- The release process. See [Deployment](deployment.md)
- How the library works inside. See the [Software Design Document](DESIGN_DOC.md)
- Audio analysis. You reduce your audio, data or text to numbers yourself.

---

## Getting Started

### Prerequisites

- [ ] Node.js 22 or later
- [ ] A supported processor type: arm64 or x64
- [ ] macOS or Linux. Windows is not supported.
- [ ] An installation of `@napi-rs/canvas` in your project

### Install

The package is public on npm. Run:

```bash
npm install animspec
```

The package is ESM-only and requires Node.js 22 or later. Check your version first:

```bash
node --version
```

To install from source instead, for example to test a local change:

1. Clone the animspec repository.
2. Run the build:

   ```bash
   npm install
   npm run build
   ```

3. Produce a tarball:

   ```bash
   npm pack
   ```

4. Install the tarball into your project:

   ```bash
   npm install /path/to/animspec/animspec-<version>.tgz
   ```

### Quick Start: render your first frame

1. Create a spec. Describe each layer by its `type` and its params.

   ```ts
   import { createCanvas } from "@napi-rs/canvas";
   import { drawSpec, validateAnimSpec, type SignalFrame } from "animspec";

   const { spec } = validateAnimSpec({
     background: "black",
     layers: [{ type: "grid" }, { type: "wave" }],
   });
   ```

2. Build a signal frame. The frame carries the numbers for one moment of your signal.

   ```ts
   const frame: SignalFrame = {
     index: 0,                                  // frame number, starts at 0
     t: 0,                                      // time in seconds
     values: new Float64Array(64).fill(0.5),    // main vector, 0..1
     spectrum: new Float64Array(64).fill(0.25), // spectrum bins, 0..1
     amplitude: 0.5,                            // overall level, 0..1
     energy: 0.4,                               // mean absolute level, 0..1
   };
   ```

3. Render the frame onto a canvas.

   ```ts
   const dims = { width: 1280, height: 720 };
   const canvas = createCanvas(dims.width, dims.height);
   const ctx = canvas.getContext("2d");

   drawSpec(ctx, dims, frame, spec!, {
     reducedFlicker: true,
     creative: false,
     seed: 1,
   });
   ```

4. Save the result.

   ```ts
   import { writeFileSync } from "node:fs";

   const png: Buffer = await canvas.encode("png");
   writeFileSync("frame-0.png", png);
   ```

**Verification:** the file `frame-0.png` shows a grid and a wave line on a black background.

### How the pieces fit together

- The **spec** says what to draw. It is a JSON object with a `layers` array.
- The **SignalFrame** says what the signal looks like at one moment. You build one per frame.
- The **seed** controls every random choice. The same seed gives the same picture.
- `drawSpec` renders one frame. Call it again for each frame of your animation, with a new `SignalFrame` each time.

---

## Features

### Write a spec

A spec has this shape:

| Field | Values | Meaning |
|-------|--------|---------|
| `background` | `"black"` or `"white"` | The frame background. Optional. |
| `accent` | hex color string | A third colour. Used only when `creative` is true. Optional. |
| `font` | `"dejavu"`, `"jetbrains"` or `"plex"` | The font for all text layers. Optional. |
| `layers` | array | The layers to draw, back to front. Required. |

Each layer is a `type` plus its params:

```ts
const spec = {
  background: "black",
  layers: [
    { type: "grid", cols: 64, rows: 36, threshold: 0.2 },
    { type: "wave", amp: 0.7, thickness: 3 },
    { type: "caption" },
  ],
};
```

#### Signal bindings

A layer may carry an optional `bind` map that drives any of its **numeric** params from
the SignalFrame each frame — lip-sync, beat-sync and idle motion without per-primitive
wiring:

```ts
{
  type: "rig", rig: "host", pose: "talk", drive: "none",
  bind: {
    mouthOpen: { from: "amplitude", out: [0, 1] },
    headAngle: { from: "band:3", in: [0, 1], out: [-8, 8], curve: "smooth" },
    eyeOpen:   { from: "osc", wave: "pulse", period: 4.2, duty: 0.05, out: [1, 0] },
  },
}
```

- `from` is `amplitude`, `energy`, `band:<n>` (an index into the frame's `values`), or
  `osc` (a deterministic oscillator of `t`, seeded from the render seed).
- The feature is clamped into `in` (default `[0, 1]`), shaped by `curve` (`linear` or
  `smooth`), mapped through `out` (default: the param's own bounds), then clamped to the
  param's registry bounds.
- `osc` takes `wave` (`pulse`, default — useful as a blink clock with `duty`) or `sine`,
  and a positive `period` in seconds.
- A binding overrides the static param value each frame; if the primitive also reads the
  signal for that same quantity (e.g. `rig`'s `drive: "amplitude"`), it still applies on
  top — avoid stacking. A bind that cannot evaluate (`band:<n>` past the track's bands)
  falls back to the static value. Malformed binds are dropped and reported; the layer
  renders with its static params.

#### Camera

A spec may carry a `camera` — a two-keyframe move applied as a transform around every
layer, so primitives pan/zoom/push without knowing a camera exists:

```ts
camera: {
  move: "push",                                // static | pan | zoom | push | parallax
  from: { frame: 0,   zoom: 1.0, x: 0.5, y: 0.5 },
  to:   { frame: 240, zoom: 1.25, x: 0.55, y: 0.45 },
  ease: "smooth",                              // linear (default) | smooth
}
```

- `pan` varies `x`/`y`; `zoom` varies `zoom`; `push` and `parallax` vary both; `static`
  holds `from`.
- A layer may set `depth` (0..1, default 1). Under `move: "parallax"` only, `depth` scales
  the camera's effect — `depth: 0` stays fixed, `depth: 1` follows the camera.
- The camera is a pure function of the frame index; a malformed camera is dropped and
  reported; a spec without one renders exactly as before.

Every primitive lists its params, defaults and ranges in [VOCABULARY.md](../VOCABULARY.md). The [gallery](../gallery/) shows one rendered thumbnail per primitive, so you can browse before you write.

**Tip:** start from the default layer. Every param has a default, so `{ "type": "grid" }` is a valid layer.

### Understand the SignalFrame contract

You turn your audio, data or text into numbers. The interpreter only reads them.

| Field | Type | Meaning |
|-------|------|---------|
| `index` | number | The frame number, starting at 0 |
| `t` | number | Media-clock time in seconds |
| `values` | Float64Array | The primary vector, each entry 0..1 |
| `spectrum` | Float64Array | Spectrum magnitude bins, each 0..1 |
| `amplitude` | number | The overall level, 0..1 |
| `energy` | number | The mean absolute level, 0..1 |
| `labels` | string[] (optional) | Text read-outs, for example hex or binary strings. The first entry feeds `caption`. |
| `coords` | { x, y }[] (optional) | Positional data, for example coordinates |

For an animation, advance `index` and `t` and update the numbers each frame. The reactivity rule guarantees the picture changes when your signal changes.

**Frames are order-independent.** A frame is a pure function of `(spec, frame, seed)`: frame *N* does not depend on frames *0…N−1*. You can render frames in any order, split a long render into chunks, or run chunks in parallel workers, and each frame comes out the same. Just keep `index` and `t` consistent — the same frame number must carry the same `index` and `t` on every machine and every pass, because motion and per-frame effects read them. Render a whole video on one processor type: arm64 and x64 agree within 8 of 255 per colour channel, so mixing types within one video can show a seam.

### Control rendering with options

`drawSpec` takes an options object:

| Option | Type | Effect |
|--------|------|--------|
| `seed` | number | Controls every random choice. Same seed, same picture. |
| `reducedFlicker` | boolean | Softens strobe effects. `flash` becomes a 25 percent wash. |
| `creative` | boolean | When false, the accent colour is ignored and drawings stay monochrome. |

```ts
drawSpec(ctx, dims, frame, spec, {
  reducedFlicker: true,
  creative: false,
  seed: 42,
});
```

Use the same `seed` across a whole animation unless you want per-frame noise.

### Validate a spec

Language models and humans both write broken specs. `validateAnimSpec` repairs what it can and reports the rest:

- It keeps at most 12 layers. Extra layers are dropped.
- It drops layers whose `type` it does not know, and lists their types.
- It clamps every param to its declared range.
- It fills missing params with defaults.
- It drops an invalid `accent` and an unrecognised `font`, and reports each.
- It writes the current `vocabulary` version into the spec.

The result has four fields: `valid`, `spec`, `errors` and `dropped`.

```ts
import { validateAnimSpec } from "animspec";

const result = validateAnimSpec(rawJsonFromModel);
if (result.errors.length > 0) console.warn(result.errors);
if (result.dropped.length > 0) console.warn("dropped layer types:", result.dropped);
drawSpec(ctx, dims, frame, result.spec!, { reducedFlicker: true, creative: false, seed: 1 });
```

**Warning:** always pass model output through `validateAnimSpec`. Do not feed raw model JSON to `drawSpec`.

### Show a vocabulary to a model

Do not offer all 29 primitives at once. Offer a selection.

Every primitive has a tier:

| Tier | Offered to a model |
|------|--------------------|
| `core` | with no kit, with any kit, and as extras |
| `extended` | only through a kit that lists it |
| `contrib` | only when the caller names it |
| `legacy` | never |

Tiers limit what a model is offered. They do not limit what a spec may contain.

Build a selection with `select`, then describe it to the model:

```ts
import { select, buildVocabPrompt, buildJsonSchema } from "animspec";

const selection = select("data-viz", 0.3, 0);
const prompt = buildVocabPrompt(selection);
const schema = buildJsonSchema(selection);
```

Kits include `auto`, `data-viz`, `particle-lab`, `minimal`, `glitch`, `text`, `arcade`, `dimensional` and `retro`. The second argument is breadth, between 0 and 1. The third is a seed, so the same request returns the same selection.

**Warning:** never use `buildVocabPrompt()` or `buildJsonSchema()` without a selection argument with a model. The no-argument forms cover the whole registry.

### Choose a font

All text is drawn with a font that ships inside the library. A font installed on your machine is never used.

| Key | Font | Default |
|-----|------|---------|
| `dejavu` | DejaVu Sans Mono | yes |
| `jetbrains` | JetBrains Mono | |
| `plex` | IBM Plex Mono | |

```ts
const spec = { font: "jetbrains", layers: [{ type: "caption" }] };
```

One font applies to the whole spec. A character a font lacks draws as that font's own empty box, the same on every machine. The font list is exported as `FONTS`.

---

## Embedding

This section is for a host application that renders whole videos — a streaming renderer that turns a spec plus a signal track into many frames, like Motion Studio. animspec draws one frame per call; the host decides how to turn those frames into a video.

### The worker model

Create one canvas per worker process and reuse it across every frame that worker renders.

```ts
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec } from "animspec";

const dims = { width: 1280, height: 720 };
const canvas = createCanvas(dims.width, dims.height);
const ctx = canvas.getContext("2d");

for (const frame of myChunk) {
  drawSpec(ctx, dims, frame, spec, { reducedFlicker: true, creative: false, seed });
  const rgba = ctx.getImageData(0, 0, dims.width, dims.height).data;
  await encodeFrame(rgba); // your encoder
}
```

Reusing the canvas is safe: `drawSpec` begins every frame by filling the whole canvas with the background, so no pixel survives from the previous frame. The interpreter does not reset the context's other state (transform, composite operation, alpha) between frames — the built-in primitives restore whatever they change. If you draw your own layers around `drawSpec`, restore your own context state.

Parallel chunks are safe because frames are order-independent: frame *N* does not depend on frames 0…N−1, so workers may render chunks in any order, out of order, or across processes. Keep `index` and `t` consistent and stay on one processor type per video.

### Pixel format

Read a frame's pixels with `getImageData`, which returns **straight (non-premultiplied) RGBA** — the same bytes the library's own reference hashes record.

```ts
const rgba = ctx.getImageData(0, 0, dims.width, dims.height).data; // Uint8ClampedArray, RGBA
```

`canvas.data()` (the lower-level `@napi-rs/canvas` method) returns the raw Skia surface, which is **premultiplied** RGBA, and differs from `getImageData` whenever a pixel is not fully opaque. animspec frames are always drawn over an opaque background, so for them the two agree; the difference only shows with the `image` layer and a transparent bitmap. Pick one readout and use it consistently — do not premultiply `getImageData` output again when converting to BGRA for display or to YUV for encoding, or you will double-convert. For a PNG, `await canvas.encode("png")` does the conversion for you.

### Reproducible manifests

To reproduce a render later, record everything that determines the output:

- the animspec package version,
- `VOCABULARY_VERSION` (the vocabulary the spec was written against),
- the pinned `@napi-rs/canvas` version,
- the `font` key, if the spec sets one,
- the `seed` passed to `drawSpec`,
- the processor type: arm64 or x64.

The determinism promise is per processor type: byte-identical frames on the same type, and within 8 of 255 per colour channel across arm64 and x64. A manifest that names these six things, plus the spec and the signal track, is enough to reproduce a frame.

### Authoring specs with a model

Show a model a bounded vocabulary, then validate what it returns, in one loop:

```ts
import { select, buildVocabPrompt, buildJsonSchema, validateAnimSpec } from "animspec";

const selection = select("data-viz", 0.3, 0);   // bounded, deterministic subset
const prompt = buildVocabPrompt(selection);      // describe the subset to the model
const schema = buildJsonSchema(selection);       // JSON schema for the same subset

const output = await yourModel({ prompt, schema }); // the model's JSON
const result = validateAnimSpec(output);

if (result.errors.length > 0) console.warn(result.errors);
if (result.dropped.length > 0) console.warn("dropped layer types:", result.dropped);
drawSpec(ctx, dims, frame, result.spec!, { reducedFlicker: true, creative: false, seed });
```

Always pass model output through `validateAnimSpec`, and surface `result.dropped` back to the user — the validator never drops a layer silently, and the host should report it. See [Validate a spec](#validate-a-spec) for what the validator repairs and reports.

### What stays with the host

animspec draws frames; the host owns everything around that:

- turning audio, data or text into `SignalFrame`s — audio decoding and FFT are not in animspec;
- persisting them — animspec ships `encodeSignalTrack` / `decodeSignalTrack` for a versioned on-disk track (see [the SignalFrame track format](../specs/008-signalframe-format/quickstart.md));
- creating the canvas, choosing its size, the frame rate, and the order frames are drawn in;
- scheduling and parallelising chunks across workers;
- writing frames to image or video files, and playing them back;
- calling a model and deciding what to do with the spec it returns.

This split is [the constitution's "held by the caller" list](../.specify/memory/constitution.md#scope-and-boundaries); animspec does not grow into a scheduler, an encoder or a signal processor.

---

## Troubleshooting

### Issue: the frame is blank

**Symptoms:** the rendered image is a solid black or white rectangle.
**Cause:** the signal is near zero, or the validator dropped every layer.
**Solution:**

1. Read `result.errors` and `result.dropped`.
2. Check `amplitude` and `values` in your `SignalFrame`. Raise them above 0.
3. Confirm each layer `type` matches [VOCABULARY.md](../VOCABULARY.md).

**Prevention:** log the validator result during development.

### Issue: a layer disappeared

**Symptoms:** fewer elements render than the spec lists.
**Cause:** `validateAnimSpec` dropped an unknown layer, or the spec had more than 12 layers.
**Solution:**

1. Read `result.dropped`. It lists the dropped layer types.
2. Fix the layer `type` spelling, or trim the spec to 12 layers or fewer.
3. Re-validate and render again.

### Issue: frames differ between machines

**Symptoms:** pixel values differ slightly on arm64 versus x64.
**Cause:** the two processor types round soft edges differently.
**Solution:** confirm both machines run the same spec, signal and seed. Machines of the same processor type produce byte-identical frames. Across the two types every colour channel stays within 8 of 255. Windows and other processor types are unsupported.

Rendering order never changes a frame: chunked or parallel renders are fine. Differences come only from mixing processor types, so render a whole video on one type.

### Issue: text shows empty boxes

**Symptoms:** characters render as hollow rectangles.
**Cause:** the selected font lacks the character.
**Solution:** try another shipped font, or use characters the font supports. The fallback is deterministic and identical on every machine.

### Issue: install fails with an engine error

**Symptoms:** `npm install animspec` prints an engine warning, or fails with an engine requirement error when `engine-strict` is set.
**Cause:** your Node.js version is below 22.
**Solution:**

1. Check your version: `node --version`.
2. Upgrade to Node.js 22 or later.
3. Retry the install.

**Prevention:** pin Node.js 22 or later in your project tooling.

### Error behaviour reference

| Behaviour | Meaning | Fix |
|-----------|---------|-----|
| Validator drops a layer | the `type` is not in the vocabulary | correct the type name |
| Validator clamps a param | the value was outside its range | read the range in VOCABULARY.md |
| Validator reports a font | the font key is unknown | use `dejavu`, `jetbrains` or `plex` |

### System requirements

**Minimum:**

- Node.js 22 or later
- arm64 or x64 processor
- macOS or Linux

**Recommended:**

- arm64 or x64, both verified against reference sets
- Linux for long render runs

---

## FAQ

### General

**Q: Does animspec make video files?**
A: No. It renders one frame per call. Use a video encoder of your choice on the frames you render.

**Q: Can I use my system fonts?**
A: No. Text is drawn only with the three shipped fonts. This keeps text identical on every machine.

**Q: Is output identical on arm64 and x64?**
A: Within 8 of 255 on every colour channel. Byte-identical frames are guaranteed only between machines of the same processor type.

**Q: Can I render frames out of order or in parallel?**
A: Yes. Each frame is independent of the others; only its own `SignalFrame` and the shared spec and seed matter. Keep `index`/`t` consistent and stay on one processor type per video.

**Q: Does it work on Windows?**
A: No. Windows is reported as unsupported.

### Technical

**Q: Can a spec contain a `contrib` or `legacy` primitive?**
A: Yes. Tiers limit what a model is offered. `validateAnimSpec` and `drawSpec` accept a primitive of any tier.

**Q: Where does the randomness come from?**
A: From the `seed` option, through the `mulberry32` generator. No ambient randomness, clock, file or network access is used while drawing.

**Q: How do I offer primitives to a language model?**
A: Call `select(kit, breadth, seed)`, then `buildVocabPrompt(selection)` and `buildJsonSchema(selection)`. Validate the model output with `validateAnimSpec`.

**Q: What is the `vocabulary` field in my spec?**
A: The vocabulary version the spec was written against. The validator writes it. The interpreter ignores it, so it never changes what is drawn.

---

## Support

### Getting help

- [VOCABULARY.md](../VOCABULARY.md): every primitive, its params, its tier
- [gallery](../gallery/): one thumbnail per primitive
- [Software Design Document](DESIGN_DOC.md): how the library works
- [Deployment](deployment.md): how versions are published
- [CONTRIBUTING.md](../CONTRIBUTING.md): how to propose a primitive
- [SECURITY.md](../SECURITY.md): how to report a vulnerability

### Community resources

- Repository: https://github.com/tosin2013/animspec
- Issues: use the issue templates in the repository

---

## Appendix

### Glossary

- **Spec**: the JSON description of a frame, with a `layers` array.
- **Layer**: one entry of the layers array, a `type` plus params.
- **Primitive**: one drawing type in the vocabulary, for example `grid` or `wave`.
- **SignalFrame**: the numbers that describe your signal at one moment.
- **Seed**: the number that controls every random choice in a render.
- **Tier**: the offer class of a primitive: `core`, `extended`, `contrib` or `legacy`.
- **Kit**: a named selection theme for `select`, for example `data-viz`.
- **Vocabulary version**: the integer the validator stamps on every spec.
- **Sanitization**: the validator step that drops unknown layers and clamps params.

### Version history

| Version | Date | Changes |
|---------|------|---------|
| 0.2.1 | 2026-10-18 | Packaging fix: the `animspec` bin is declared at the top level again — 0.2.0 shipped the CLI file but did not expose the command on install |
| 0.2.0 | 2026-10-18 | Vocabulary 8: `type-reveal` and `quote-card` primitives; the SignalFrame track format with its per-frame reader (`readSignalTrackHeader` / `readSignalFrame` / `indexSignalTrackSidecar`); the `animspec render` command-line renderer (frame ranges, raw RGBA or PNG); frame-order gates extended to fresh processes; `@napi-rs/canvas` 1.0.11 |
| 0.1.4 | 2026-10-17 | Documented frame-order independence (chunked and parallel renders are safe) and added the embedding guide (worker model, pixel format, reproducibility manifests, model authoring) |
| 0.1.3 | 2026-10-09 | First version of the guide, matching animspec 0.1.3 on npm |

Package versions map to vocabulary versions like this: **0.1.4 → vocab 3, 0.2.0 →
vocab 8**. A render manifest that records the package version therefore also pins the
vocabulary it was drawn with; `VOCABULARY_VERSION` is still exported separately and
remains the authority for spec validation.