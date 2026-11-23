# Backgrounds and scenes

Use this file in step 3 of SKILL.md whenever the piece needs more than one
plain frame: a backdrop, a setting, or several scenes in a row.

## 1. The spec background is only the base colour

`background` is set once for the whole spec, and has three values:

| `background` | What you get |
|---|---|
| `"black"` (default) | white-on-black ink |
| `"white"` | black-on-white ink |
| `"transparent"` | an alpha channel for compositing over other video; add `"ink": "light"` or `"dark"` for the ink colour |

A `sequence` clip cannot change it. Every scene's look comes from its
**background layers**: the first layers of its `layers` list, drawn before
everything else. Layers draw back to front, at most 12 per clip.

## 2. Background layers

| Want | Layer | How to get it in your selection |
|---|---|---|
| Synthwave floor and sun | `gridhorizon` | `retro` kit only |
| Flowing demoscene field | `plasma` | `retro` kit only |
| Rushing tunnel | `tunnel` | `retro` kit only |
| Star field | `dots` | core: name it |
| Cell field or pattern wall | `grid`, `checker` (with `pattern`) | core: name it |
| Static or texture | `noise` | core: name it |
| Gradient sky or floor | `dither` (`colors`, region `x0`..`y1`, `drive: "none"`) | contrib: name it |
| Your own art: a painted set, a photo, a tiling strip | `image` with declared `assets` | contrib: name it |

"Name it" means listing it in the 4th argument of `selectDetailed` (step 2 of
SKILL.md). Static scenery should set `drive: "none"` where the layer has it,
so the backdrop doesn't pulse with the signal.

Keep the background quieter than the subject: lower contrast, slower motion,
and no accent colour.

### A field behind a subject

Selection: `selectDetailed("retro", 0.3, 0, ["stickman", "type-reveal"])`

```json
{ "background": "black", "accent": "#ff2d2d", "layers": [
  { "type": "gridhorizon" },
  { "type": "stickman", "action": "wave", "x": 0.3, "scale": 0.5 },
  { "type": "type-reveal", "text": "welcome back", "fontSize": 32, "y": 0.15 }
] }
```

### A gradient sky

Selection: `selectDetailed("minimal", 0.3, 0, ["dither"])`

```json
{ "background": "black", "accent": "#2d4a8c", "layers": [
  { "type": "dither", "colors": "bg,accent", "y0": 0, "y1": 0.7, "drive": "none" },
  { "type": "rings" },
  { "type": "caption" }
] }
```

The accent shows only with `--creative`. Without it, the gradient runs
between the two monochrome inks.

## 3. Your own art as the set

The `image` layer draws a PNG you declare in the spec's `assets`, pinned by
its sha256. The CLI loads `<id>.png` from the spec's folder (or
`--assets <dir>`) and refuses a file whose digest doesn't match.

```bash
shasum -a 256 sky.png    # paste the hash into the spec
```

Selection: `selectDetailed("minimal", 0.3, 0, ["image"])`

```json
{ "assets": { "sky": { "sha256": "<sha256 of sky.png>", "width": 320, "height": 180 } },
  "layers": [
    { "type": "image", "asset": "sky", "fit": "cover", "drive": "none" },
    { "type": "stickman", "action": "walk", "x": 0.5, "scale": 0.5 }
  ] }
```

- `fit`: `cover` fills the frame, `contain` fits inside it, and `none` keeps
  the art's size.
- **Scrolling parallax**: stack several images back to front with
  `"wrap": "x"` and rising `scrollX` speeds (frame widths per second), e.g. a
  sky at 0, mountains at 0.05, trees at 0.2 and ground at 0.5. The showcase's
  "Parallax forest" is a full worked example.
- The art keeps its own colours only with `--creative` (`colour: "asset"`);
  `colour: "palette"` maps it to the palette instead.
- `smoothing: "nearest"` (the default) keeps pixel art crisp.
- Never invent a digest. If you can't hash the file, say so; don't render
  without it.

## 4. Scenes are clips

A `sequence` is a list of up to 64 clips. Each clip is one scene with its own
`from`/`to` frames, its own `layers` (and so its own background layers), its
own `camera`, and a `transition` in (`cut`, `wipe`, `iris` or `fade`, 1–600
frames).

Selection: `selectDetailed("retro", 0.3, 0, ["dots", "stickman", "chapter-card", "bars"])`

```json
{ "background": "black", "sequence": [
  { "from": 0, "to": 60, "layers": [
    { "type": "dots", "count": 120 },
    { "type": "chapter-card", "kicker": "PART I", "title": "The Rise" } ] },
  { "from": 60, "to": 150, "transition": { "type": "wipe", "frames": 12 },
    "camera": { "move": "push", "from": { "frame": 0, "zoom": 1, "x": 0.5, "y": 0.5 }, "to": { "frame": 90, "zoom": 1.2, "x": 0.5, "y": 0.5 } },
    "layers": [
    { "type": "gridhorizon" },
    { "type": "bars" },
    { "type": "caption" } ] },
  { "from": 150, "to": 210, "transition": { "type": "fade", "frames": 15 }, "layers": [
    { "type": "plasma" },
    { "type": "stickman", "action": "bow", "scale": 0.5 } ] }
] }
```

Rules:

- With a `sequence`, top-level `layers` and `camera` are ignored. Put them
  in the clips.
- Clips must be in order and must not overlap. A gap between clips renders
  the plain `background`.
- A clip's camera keyframes count from the clip's own start (frame 0 is its
  `from`).
- The first clip's `transition` is ignored. Start on a title instead.
- One scene, one setting: change the background layers at each cut, so the
  viewer knows the place changed.
- `bow` needs animspec 0.12.0+; on older versions, close on `wave`.

## 5. The camera and the background

The camera moves every layer together, so the set moves with the subject.
For depth, use `"move": "parallax"` and give each layer a `depth`: 0 stays
put (a distant sky), 1 moves fully (the subject). See the camera lever in
[creative-direction.md](creative-direction.md).

## 6. Transparent output

For lower-thirds, captions or a character that sit on top of other video,
use `"background": "transparent"` with an `ink`, and leave out background
layers. PNG frames keep the alpha. Compositing them over footage is the
user's step, like audio.
