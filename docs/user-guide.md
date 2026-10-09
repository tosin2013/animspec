# animspec User Guide

**Version:** 0.1.3
**Last Updated:** 2026-10-09
**Audience:** developers who render deterministic animation from Node.js

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Features](#features)
4. [Troubleshooting](#troubleshooting)
5. [FAQ](#faq)
6. [Support](#support)
7. [Appendix](#appendix)

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

The package is named `animspec`. Once it is public, run:

```bash
npm install animspec
```

Until it is public, build and pack it locally:

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

   const png: Buffer = await canvas.encode("image/png");
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

### Issue: text shows empty boxes

**Symptoms:** characters render as hollow rectangles.
**Cause:** the selected font lacks the character.
**Solution:** try another shipped font, or use characters the font supports. The fallback is deterministic and identical on every machine.

### Issue: install from the registry fails

**Symptoms:** `npm install animspec` returns a 404.
**Cause:** the package is not public yet.
**Solution:** build the tarball locally and install it. Follow the steps in [Install](#install).

### Error behaviour reference

| Behaviour | Meaning | Fix |
|-----------|---------|-----|
| Validator drops a layer | the `type` is not in the vocabulary | correct the type name |
| Validator clamps a param | the value was outside its range | read the range in VOCABULARY.md |
| Validator reports a font | the font key is unknown | use `dejavu`, `jetbrains` or `plex` |
| Determinism gate reports no exact comparison | the machine is Windows or an unverified type | run on arm64 or x64 |

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
| 0.1.3 | 2026-10-09 | Matches the current pre-release of the library |