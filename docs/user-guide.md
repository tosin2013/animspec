# animspec User Guide

**Version:** 0.8.1
**Last Updated:** 2026-10-23
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
| `background` | `"black"`, `"white"` or `"transparent"` | The frame background. Optional; default `"black"`. |
| `ink` | `"light"` or `"dark"` | With a transparent background only: light artwork (default) or dark artwork. Optional. |
| `accent` | hex color string | A third colour. Used only when `creative` is true. Optional. |
| `assets` | object of id → `{ sha256, width, height }` | Image assets the spec uses (0.8.0). The host passes the decoded bitmaps; the command-line renderer loads `<id>.png` next to the spec and checks the sha256. Optional. |
| `sequence` | array of clips | A shot list instead of top-level `layers` (0.8.0): each clip has `from`/`to` frames, its own `layers` and `camera`, and an optional `transition`. Optional. |
| `pixelAspect` | number, 0.5 to 2 | The intended pixel shape (height ÷ width), e.g. `1.2` for VGA Mode 13h. Metadata only: recorded in the command-line manifest so an encoder can stretch the output; it never changes a pixel. Optional. |
| `pixelMode` | `true` or `false` | Whole-pixel drawing (0.9.0): camera offsets rounded, no smoothing, and palette-exact edges in `bars`, `hbars`, `rings`, `emitter`, `particles` and `image`. See [Pixel mode](#pixel-mode). Optional. |
| `roles` | object of role name → hex color | Named colours for palette roles, such as a sprite character's hair or cloak. Used only when `creative` is true. Optional. |
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

- `from` is `amplitude`, `energy`, `band:<n>` (an index into the frame's `values`),
  `viseme` (a mouth-shape index 0..14 the host computed), `beat` (an onset strength 0..1),
  or `osc` (a deterministic oscillator of `t`, seeded from the render seed). A frame
  without the bound feature falls back to the static value.
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
- `x`/`y` run from -1 to 2 (0.5 is the centre), so a pan can travel one and a half screens
  from the centre. Values outside are clamped. Travel past a layer's drawn area shows the
  background.

A camera may also shake (0.5.0):

```ts
camera: {
  move: "static",
  from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 },
  shake: { amp: 0.02, freq: 4 },               // amp 0..0.05 of the frame; freq above 0, at most 5, default 3
}
```

- `amp` is the largest offset as a fraction of the frame; `freq` is oscillations per
  second. The shake is measured in the frame, so zoom does not enlarge it.
- It works with every `move`. Under `parallax` each layer shakes by its `depth`, so a
  `depth: 0` background stays still; other moves shake every layer fully.
- The shake is seeded and depends only on the frame's time, so chunked renders match. A
  different seed shakes differently; `amp: 0` is no shake. A malformed `shake` is dropped
  and reported, and the rest of the camera is kept.

#### Transparent background

`background: "transparent"` (0.5.0) gives frames with alpha, ready to lay over video, a photo
or a page:

```ts
{ background: "transparent", ink: "dark", layers: [{ type: "grid" }, { type: "wave" }] }
```

- `ink: "light"` (the default) draws the frame as on black and lifts the black out; `"dark"`
  draws as on white and lifts the white out. Use dark ink for print over light paper.
- Laid over its matching background (black for light ink, white for dark), a transparent
  frame looks exactly like the solid one. Empty areas, seams and cut-outs drawn in the
  background colour are fully transparent; dim tones become the ink colour at partial alpha.
- Pixels fully covered by the foreground keep its exact colour. An accent pixel can come out as
  a more saturated colour at partial alpha that looks the same over the matching background,
  so recolour by exact colour on a solid render, not a transparent one.
- `ink` on a black or white background is dropped and reported.
- From the command line, `--png` writes RGBA PNGs and `--raw` carries alpha in the fourth
  byte of each pixel.

#### Designed grids

`grid` and `checker` take a `pattern` (0.6.0): one letter per cell, rows split by `/`.

```ts
{ type: "grid", solid: true, pattern: "##.a.##/#.....#/..###../#.....#/##.a.##", breaks: "3,2 r15" }
```

- `.` off, `#` foreground, `a` accent, `b` second tone, `~` lit by the spectrum as without a
  pattern. `#`, `a` and `b` cells are opaque and do not react to the signal.
- `b` (0.7.0) draws the `fg2` role: the colour in `roles.fg2` when `creative` is true, and
  mid grey (`#808080`) otherwise, so two tones stay distinct in black and white.
- On `grid` the pattern is the grid: its longest row sets the columns and its row count the
  rows; `cols` and `rows` are ignored. On `checker` the pattern repeats across the squares
  from the top-left, and `size` still sets the square size.
- At most 64 × 64 cells. Spaces are ignored but count toward the length limit.
- `breaks` turns or shifts single cells: entries split by `;`, each `col,row` (from 0 at the
  top-left) followed by `r<degrees>` (-45..45), `dx<cells>` and/or `dy<cells>` (-1..1). A
  cell named twice adds its values; order does not matter; at most 16 entries.
- With `solid: true`, turned cells are filled pixel row by pixel row, so every pixel is still
  exactly the background, foreground or accent.
- Unknown letters and short rows read as off, oversized patterns are cut, malformed breaks
  are dropped; each is reported in `errors`, and the layer still renders.

#### Images

`image` (0.8.0) draws a declared image asset: art from an artist or an image model, placed,
fitted, cropped, flipped, faded, and tiled and scrolled for backgrounds and parallax.

```ts
{
  assets: { forest: { sha256: "<64 hex>", width: 640, height: 180 } },
  layers: [{ type: "image", asset: "forest", fit: "cover", wrap: "x", scrollX: 0.1, drive: "none" }],
}
drawSpec(ctx, dims, frame, spec, { creative: true, reducedFlicker: true, seed, assets: { forest: img } });
```

- **Decoding**: decode bitmaps with `await loadImage(bytes)` from `@napi-rs/canvas`. An
  `Image` given `src` bytes synchronously reports its size but draws no pixels.
- **Declaring**: every asset is declared by id with the sha256 of its file and its size. An id
  uses lowercase letters, digits and `-`, starts with a letter, and is at most 16 long, so
  `my-logo` works and `my_logo` is dropped. An `image` layer naming an undeclared or dropped
  asset is dropped and reported. `checkAssets(spec, bytes)`
  verifies supplied file bytes.
- **Command-line renderer**: it loads `<id>.png` from the spec's folder (or `--assets <dir>`)
  and exits with code 5 when a file is missing or its sha256 differs. Add `--creative` to see
  the art's own colours. The manifest records each asset's digest. It prints the validator's
  `errors` as a JSON line on stderr; add `--strict` to exit with code 2 instead of rendering
  when anything was dropped or reported.
- **Placement**: `x`, `y` and `anchor` place it. `fit` is `contain`, `cover`, `stretch` or
  `none`, then `scale`. `srcX`/`srcY`/`srcW`/`srcH` crop (fractions of the asset). `flip`,
  `opacity` and `smoothing` (`nearest` keeps pixel art crisp).
- **Scrolling**: `wrap` (`x` or `xy`) tiles the image, and `scrollX`/`scrollY` scroll it in
  frame widths or heights per second. Any frame renders alone identically.
- **Colour**: `colour: "asset"` (the default) keeps the art's colours, but only in creative
  mode. `colour: "palette"`, and every image outside creative mode, maps each pixel to the
  nearest palette colour (background, foreground, accent, `roles`).
- **`drive`**: `drive: "level"` (the default) adds a small size pulse with the signal. Art
  usually wants `"none"`.
- **Sprite sheets** (0.8.0): `sheetCols` and `sheetRows` describe a grid of equal cells, read
  left to right then top to bottom. `frames` limits how many are used (0 = all), `fps` sets
  the rate (0 holds one), and `frameStart` offsets the cycle. The cell shown is
  `(frameStart + floor(t × fps)) mod frames`, so any frame renders alone. Flip, crop, fit,
  wrap and colour apply to the current cell.

#### Sequences

A spec can be a shot list (0.8.0, spec 025): a `sequence` of clips in place of top-level
`layers`.

```jsonc
{ "sequence": [
  { "from": 0,  "to": 90,  "layers": [{ "type": "text" }] },
  { "from": 90, "to": 240, "layers": [{ "type": "grid" }, { "type": "wave" }],
    "transition": { "type": "wipe", "frames": 15, "direction": "left" } }
] }
```

- **Clips**: each clip owns frames `from` (inclusive) to `to` (exclusive), with up to 12
  layers and an optional `camera`. Clips must be in order and must not overlap; frames
  between clips show the background. At most 64 clips.
- **Time**: inside a clip, animation and the camera start from the clip's own frame 0. The
  signal (audio, data, labels) is the one at the absolute frame. The frame rate is assumed
  constant.
- **Transitions**:
  - `transition` blends a clip in from the previous one over its first `frames` frames
    (1–600). The previous clip keeps playing underneath.
  - `cut` switches at once.
  - `wipe` (with `direction` `left`, `right`, `up` or `down`, the way the edge moves) and
    `iris` reveal the new clip with each pixel taken from one clip.
  - `fade` mixes them.
  - After a gap, a transition blends from the background.
- **Rendering**: any frame renders alone identically, so chunked renders match.
- **Budget**: a transition frame renders two clips off-screen. The drawing-operation count
  doesn't see that work, but the 200 ms per 1080p frame limit still bounds it.
- **Validation**: invalid clips (overlapping, out of order, empty) are dropped and reported
  as `sequence[i]: …`. Top-level `layers` and `camera` beside a sequence are ignored and
  reported.

#### Plugins

A host can add primitives without changing animspec (0.8.0, spec 024). A plugin is a module
whose default export is `{ id, version, licence, primitives }`. Its primitives are written
like core ones, with a pure `draw`.

```ts
import { registerPlugin } from "animspec";
registerPlugin(acme); // once, at startup
```

```jsonc
{ "plugins": { "acme": { "version": "1.2.0" } },
  "layers": [{ "type": "ext:acme/starfield", "count": 200 }] }
```

- **The licence** must be a valid SPDX expression, such as `Apache-2.0` or
  `MIT OR Apache-2.0`.
- **Validation**: a plugin layer is dropped and reported unless its plugin is declared in
  the spec, registered by the host, at the same version, and provides that type. Params are
  clamped to the plugin's bounds. Binds, the camera and transparency work as for core
  layers.
- **Randomness**: use `dctx.layerSeed` (render seed plus layer position), so repeated
  layers differ.
- **A throwing plugin layer** draws nothing for that frame. `SpecOpts.onLayerError` hears
  about it.
- **Verifying**: `verifyPlugin(plugin)` from `animspec/verify`, or
  `animspec verify-plugin ./acme.js [--json]` (exit 0 pass, 6 a check failed, 2 usage or
  load error), runs the checks core passes: determinism, palette roles, budget, reactivity
  and purity. The purity check is a test, not a sandbox, so run untrusted plugins in an
  isolated worker.
- **Rendering from the CLI**: `animspec render spec.json --signal t.asft --plugin ./acme.js …`.
  The manifest lists each plugin's id, version, licence and file sha256, and marks the
  render `core-only`. Plugin output is outside animspec's reference frames.
- **Models**: plugin primitives are never offered by `select`. Name them explicitly to
  include them in a prompt, where they are labelled `[external]`.

#### Dithered scenes

`dither` (0.7.0) fills a rectangle with an ordered (Bayer) dither gradient through up to six
palette roles, the way DOS and VGA games faked colours outside their palette.

```ts
{
  roles: { s0: "#000014", s1: "#281444", s2: "#6c3468", bar: "#0000a8" },
  layers: [
    { type: "dither", colors: "s0,s1,s2", y1: 0.56, drive: "none" },
    { type: "dither", colors: "bar", y0: 0.7, drive: "none" },
    { type: "caption", box: "none", margin: 0, maxLines: 2 },
  ],
}
```

- `colors` lists the stops (`bg`, `fg`, `accent` or names from `roles`). One stop draws a
  solid band, which is useful for UI bars and props.
- `x0`, `y0`, `x1`, `y1` set the region (0..1). `matrix` is `8` or `4`, `direction` is
  `vertical` or `horizontal`, and `chunk` (1..8) makes the dots chunkier.
- Every pixel is exactly one stop colour. Without creative mode, named stops draw evenly
  spaced greys from background to foreground, so the band still reads in black and white.
- `drive: "level"` (the default) lets the stop boundaries shimmer with the signal; use
  `"none"` for static scenery.
- `caption`'s `margin` (font-heights from the edge, default 1) places text inside a bar.

#### Palette roles and v2 characters

A spec may name colours for palette roles (spec 020). `sprite`'s `hero` character draws each
of its parts in a role: `outline`, `hair`, `hair-light`, `skin`, `eyes`, `gold`, `cloak`,
`cloak-shade`, `tunic` and `boots`.

```ts
{
  roles: { hair: "#8a4a20", skin: "#f0c8a0", cloak: "#2d4a8c", gold: "#e0b030" },
  layers: [{ type: "sprite", character: "hero", scale: 6 }],
}
```

- Roles take effect only with `creative: true`, like `accent`. Without it, every part draws
  in its grey (dark, body or highlight), so the frame stays monochrome and reads in pure
  black and white.
- A role the spec does not name also falls back to its grey.
- Names are lowercase letters, digits and `-`, start with a letter, and are at most 16 long;
  `bg`, `fg` and `accent` are reserved. Values are `#rgb` or `#rrggbb`. At most 16 roles
  (extra ones are dropped by sorted name). Each dropped entry is reported in `errors`.
- `mascot`, `bot` and `ghost` ignore roles and draw exactly as before.
- The `fg2` role is the second tone of `grid` and `checker` patterns (the letter `b`), and
  of `bars` and `rings` with `tone2` (0.9.0).

#### Pixel mode

`pixelMode: true` (spec 026, 0.9.0) asks for whole-pixel drawing, for print renders that must
be palette-exact and for pixel art next to crisp sprites.

```ts
{
  pixelMode: true,
  roles: { fg2: "#d8c8a0" },
  layers: [{ type: "bars", tone2: "alternate" }, { type: "rings", tone2: "alternate" }],
}
```

- **Primitives that honour it**: `bars` and `hbars` (bar edges by cumulative rounding, so
  the bars still fill the frame), `rings` (whole-pixel outlines at the requested thickness),
  `emitter` and `particles` (opaque whole-pixel squares), and `image` (nearest sampling at a
  whole-pixel size and position). On a solid background, every pixel they draw is exactly a
  palette colour.
- **Every other primitive** draws as without pixel mode.
- **Camera**: pan, parallax and shake offsets are rounded to whole pixels, and image smoothing
  is off for the frame. A zoom other than 1 still scales the drawing by a fraction, so
  exactness is promised only at zoom 1.
- **`emitter`** has no partial opacity in pixel mode: a particle appears while its fade is at
  least one half and is hidden otherwise, so it pops in and out instead of fading.
- **Not exact**: a `fade` transition (it mixes two shots), an `image` with `opacity` below 1,
  and plugin layers (they receive the flag and may honour it).
- **`tone2`**: on `bars`, `alternate` draws odd bars (from 0) in the second tone and `peak`
  draws the loudest bar in it instead of the accent. On `rings`, `alternate` draws even rings
  (from 1) in it. The second tone is `roles.fg2` in creative mode, else mid grey `#808080`.
  `tone2` works with or without pixel mode.

#### Arcade HUD

`versus-bars` and `hud-score` (spec 027, 0.9.0) draw an arcade HUD whose values come from the
frame: the host puts them in `coords` and `labels` each frame, and animspec only draws them.

```ts
// spec
{ accent: "#e02020", layers: [{ type: "versus-bars" }, { type: "hud-score", layout: "versus" }] }
// each frame, from the host
{ ...frame, coords: [{ x: 0.4, y: 0.6 }, { x: 0.8, y: 0.8 }], labels: ["98", "HERO", "RIVAL"] }
```

- **`versus-bars`**: two opposed health bars. `coords[0]` is the left side and `coords[1]`
  the right; `x` is the health and `y` the damage tail (0..1). The fill grows from the outer
  edge toward the centre and the tail continues it, in the accent (creative mode) or mid grey.
  A host drains the tail by lowering `y` over a few frames; animspec keeps no state between
  frames. Without `coords` the bars show the low and high halves of the spectrum. Every edge
  is whole pixels, so the bars are palette-exact even without `pixelMode`. Params: `y`,
  `height`, `gap`, `angle`, `tail`, `drive` (`level` flashes the tail on loud frames).
- **`hud-score`**: `layout: "shooter"` reads `labels` as score, hi-score and credits and
  draws `1UP`, `HI-SCORE` and `CREDIT`; `layout: "versus"` reads the timer and the two names.
  Values are cut to 12 characters (the timer to 3); a missing label is left blank. Params:
  `layout`, `size`, `captions`, `drive` (`level` inverts `1UP` or the timer on loud frames).

#### Style profiles

Arcade looks are a render size plus a spec. The host picks the width and height.

| Profile | Size | Spec |
|---------|------|------|
| CPS II versus stage | 384 × 224 | `pixelMode: true`; a `dither` stage; two `sprite`s, the second with `faceLeft: true` (or an `image` with `flip: "x"`); `versus-bars`; `hud-score` with `layout: "versus"` |
| Arcade vertical ("tate") | 224 × 288 | `pixelMode: true`; a `dots` starfield; a `sprite` or `image` player; `hud-score` with `layout: "shooter"` |

See both on the [showcase](showcase.md) (`cps2-versus`, `tate-shooter`). The CRT, scanline
and aperture-grille finish is applied after animspec by the host (it belongs to Motion
Studio, #90); named palette profiles are tracked in #102.

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

- It keeps at most 12 layers (in each clip of a sequence too). Extra layers are dropped,
  reported in `errors` and listed in `dropped`.
- It drops layers whose `type` it does not know, and lists their types.
- It clamps every param to its declared range.
- It fills missing params with defaults.
- It drops an invalid `accent` and an unrecognised `font`, and reports each.
- It writes the current `vocabulary` version into the spec.
- It reports a left- or right-aligned `type-reveal` whose wrap box leaves the frame. Rows
  align inside a `maxWidth` box centred on `x`, so `align: "left"` starts at
  `x − maxWidth/2`, not at `x`. For a label at the left edge, keep `x − maxWidth/2 ≥ 0` (for
  example `x: 0.25, maxWidth: 0.4`).

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

1. Read `result.errors` and `result.dropped`. They say which layers were dropped and why
   (the command-line renderer prints both on stderr).
2. Fix the layer `type` spelling or the asset id, or trim the spec to 12 layers or fewer.
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

The full list of changes in each release is in [CHANGELOG.md](https://github.com/tosin2013/animspec/blob/main/CHANGELOG.md).

| Version | Date | Changes |
|---------|------|---------|
| 0.6.0 | 2026-10-23 | Vocabulary 13: `pattern` and `breaks` on `grid` and `checker` (designed grids); the showcase page; gallery thumbnails checked for freshness |
| 0.7.0 | 2026-10-24 | Vocabulary 14: palette roles (`roles`), sprite format v2 and the `hero` character, the second tone `b`/`fg2`, the `dither` primitive, `caption.margin` and `pixelAspect`; Game Boy, SNES and DOS showcase loops |
| 0.8.0 | 2026-10-24 | Vocabulary 16: the `image` primitive with declared, digest-pinned `assets` and sprite sheets; the plugin slot (`registerPlugin`, `animspec/verify`, CLI `--plugin` and `verify-plugin`); clip `sequence`s with cut, wipe, iris and fade; CLI `--assets` and `--creative`; parallax-forest, sheet-walk and shot-list showcase loops |
| 0.8.1 | 2026-10-24 | `emitter` petals rasterise within the cross-type tolerance (#126); two petal reference frames moved |
| 0.8.2 | 2026-10-28 | Reporting fixes: layers past 12 are reported (#155); the CLI prints the validator's errors and gains `--strict` (#154); the asset-id rule is stated; `type-reveal`'s wrap box is documented and reported off-frame (#156); `decodeSignalTrack` accepts raw file bytes (#157) |
| 0.9.0 | — | Vocabulary 18: `pixelMode` (whole-pixel, palette-exact `bars`, `hbars`, `rings`, `emitter`, `particles` and `image`, and rounded camera offsets; #111, #159) `tone2` on `bars` and `rings` (#158); the `versus-bars` and `hud-score` arcade HUD and the CPS II and tate style profiles (#105, #106) |
| 0.5.0 | 2026-10-23 | Camera shake (`camera.shake`) and a -1..2 camera keyframe range; the transparent background with light or dark `ink`; cross-type checks include alpha (constitution 3.0.0) |
| 0.4.0 | 2026-10-23 | Vocabulary 12: `figure` `x`/`y`/`scale` and `wave`/`cheer` stances; `rig` `wave`/`present`/`reach` poses; `grid` `solid`; `thickness` on `radial`, `lissajous`, `shape`, `rings` and `graph` (and up to 32 on `wave`); the whole-composition budget gate; a clear error from `buildJsonSchema`/`buildVocabPrompt` without a selection; README links that work on npm; TypeScript 7 |
| 0.3.0 | 2026-10-18 | Vocabulary 11: `rig`, `emitter` and `figure` primitives; per-layer signal `bind` map; spec-level `camera` with layer `depth`; `SignalFrame` `viseme`/`beat` with an ASFT extras chunk; the CLI streams with bounded memory; the AI-prompting guide and `llms.txt` |
| 0.2.1 | 2026-10-18 | Packaging fix: the `animspec` bin is declared at the top level again — 0.2.0 shipped the CLI file but did not expose the command on install |
| 0.2.0 | 2026-10-18 | Vocabulary 8: `type-reveal` and `quote-card` primitives; the SignalFrame track format with its per-frame reader (`readSignalTrackHeader` / `readSignalFrame` / `indexSignalTrackSidecar`); the `animspec render` command-line renderer (frame ranges, raw RGBA or PNG); frame-order gates extended to fresh processes; `@napi-rs/canvas` 1.0.11 |
| 0.1.4 | 2026-10-17 | Documented frame-order independence (chunked and parallel renders are safe) and added the embedding guide (worker model, pixel format, reproducibility manifests, model authoring) |
| 0.1.3 | 2026-10-09 | First version of the guide, matching animspec 0.1.3 on npm |

Package versions map to vocabulary versions like this: **0.1.4 → vocab 3, 0.2.0/0.2.1 →
vocab 8, 0.3.0 → vocab 11, 0.4.0 → vocab 12, 0.5.0 → vocab 12, 0.6.0 → vocab 13, 0.7.0 → vocab 14, 0.8.0 → vocab 16, 0.8.1 → vocab 16**. A render manifest that records the package version therefore
also pins the vocabulary it was drawn with; `VOCABULARY_VERSION` is still exported
separately and remains the authority for spec validation.