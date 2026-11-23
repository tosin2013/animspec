# Creative direction

animspec is deterministic, not plain. The same spec always renders the same
frames, but the spec can still be bold. Use this file in step 2 of SKILL.md,
before you write a spec, and again whenever a draft looks flat.

## 1. Look before you write

Spend a minute on the three pages. They are drawn by the library itself.

- **Showcase**: https://tosin2013.github.io/animspec/showcase.html
  Finished looks, each with **its full spec under the picture**: retro
  profiles (Game Boy, Genesis, DOS, SNES), arcade HUDs (versus stage,
  vertical shooter, attract mode), camera moves (pan, shake, parallax), a
  `sequence` shot list, sprite sheets, print-exact bars, and the stickman
  presenter, fight and dancing crowd.
- **Gallery**: https://tosin2013.github.io/animspec/gallery.html
  One looping card per primitive. Use it to see what each layer looks like
  before you pick it.
- **Vocabulary**: https://tosin2013.github.io/animspec/vocabulary.html
  Every primitive and, from 0.12.0, every param with its range and default.

**Start from a showcase spec when one is close.** Copy the spec under the
picture, then change the data, the words, the colours and the timing. A spec
adapted from a working example beats one written from a blank page. The
showcase renders with seed 12345 at 320 × 180; use your own seed and size.

## 2. Decide a direction in one sentence

Before writing JSON, write the idea down, for example "a lone presenter on
black points at a rising line while the numbers tick past", or "a
16-bit fighting game where the health bars are the two candidates' poll
numbers". One sentence decides the kit, the palette, the camera and the
pacing. Report it with the render.

## 3. The levers

Every snippet below validates with `validateAnimSpec` on animspec 0.12.0,
with nothing dropped or changed, and names the selection that offers all of
its layers (step 2 of SKILL.md). Mix them, and widen your selection the same
way. Features marked **0.12.0+** fall
back quietly on older versions (an unknown action becomes `idle`, an
off-frame `x` is clamped to the edge), so check `package.json` first.

### Composition: layer back to front

Up to 12 layers per clip. Think in planes: a background field, the data, a
character, then text on top.

Selection: `selectDetailed("retro", 0.3, 0, ["dots", "stickman", "line-chart", "type-reveal"])`

```json
{ "background": "black", "accent": "#ff2d2d", "layers": [
  { "type": "dots", "count": 90 },
  { "type": "gridhorizon" },
  { "type": "line-chart", "points": 12, "fill": true },
  { "type": "stickman", "action": "point", "x": 0.08, "scale": 0.45, "targetX": 0.9, "targetY": 0.25 },
  { "type": "type-reveal", "text": "up 40% this quarter", "framesPerUnit": 6, "fontSize": 28, "y": 0.12 }
] }
```

Leave space. One strong element with empty frame around it reads better than
twelve layers competing.

### Camera: give the frame a point of view

`camera` moves everything at once: `pan`, `zoom`, `push`, or `parallax` with a
per-layer `depth` (0 stays still, 1 moves fully). A small `shake` sells an
impact.

Selection: `selectDetailed("retro", 0.3, 0, ["bars", "stickman"])`

```json
{ "camera": { "move": "parallax", "from": { "frame": 0, "zoom": 1, "x": 0.4, "y": 0.5 }, "to": { "frame": 90, "zoom": 1.15, "x": 0.6, "y": 0.5 }, "shake": { "amp": 0.01, "freq": 3 } },
  "layers": [
    { "type": "gridhorizon", "depth": 0.2 },
    { "type": "bars", "depth": 0.6 },
    { "type": "stickman", "action": "walk", "depth": 1 }
  ] }
```

### Motion that means something: bind to the signal

Let the data move one thing clearly, rather than everything a little. Binds
drive any numeric param from `amplitude`, `energy`, `band:<n>`, `beat`,
`viseme` or a deterministic `osc`.

Selection: `selectDetailed("minimal", 0.3, 0, [])`

```json
{ "layers": [
  { "type": "rings", "bind": { "count": { "from": "amplitude", "out": [3, 10] } } },
  { "type": "stickman", "action": "walk", "facing": "right",
    "bind": { "x": { "from": "osc", "period": 4, "wave": "sine", "out": [-0.2, 0.5] } } }
] }
```

The stickman's `x` runs from -0.2 (fully off-frame) to 0.5: a walk-in, not a
pop-in. (**0.12.0+**: earlier versions clamp `x` to 0..1.)

### Story: cut it into clips

A piece that changes every few seconds holds attention. A `sequence` gives
each beat its own layers and camera, joined by `cut`, `wipe`, `iris` or
`fade`.

Selection: `selectDetailed("data-viz", 0.3, 0, ["chapter-card"])`

```json
{ "sequence": [
  { "from": 0, "to": 60, "layers": [{ "type": "chapter-card", "kicker": "PART I", "title": "The Rise" }] },
  { "from": 60, "to": 150, "transition": { "type": "wipe", "frames": 12 }, "layers": [{ "type": "bars" }, { "type": "caption" }] },
  { "from": 150, "to": 210, "transition": { "type": "iris", "frames": 15 }, "layers": [{ "type": "stickman", "action": "bow" }] }
] }
```

Open with a title, give the data the middle, and close on a gesture or a held
frame. (`bow` is **0.12.0+**; on older versions close on `wave` instead.)

### Colour: monochrome first, colour on purpose

Without `--creative` everything is black and white, which is a strong look in
itself. With `--creative`:

- `accent` is one highlight colour. Spend it on the one thing that matters.
- `roles` name more colours: `fg2` is a second tone, and sprite parts take
  their own.
- `profile: "gameboy-dmg"` or `"genesis"` gives a whole retro palette, and
  `pixelMode: true` keeps edges on whole pixels for an authentic pixel look.
- `background: "transparent"` (with `ink`) renders an overlay for compositing.

Selection: `selectDetailed("arcade", 0.3, 0, ["checker"])`

```json
{ "background": "white", "profile": "gameboy-dmg", "pixelMode": true, "layers": [
  { "type": "checker", "pattern": "b", "size": 16 },
  { "type": "tetris", "cols": 8 },
  { "type": "sprite", "character": "hero", "motion": "bounce", "scale": 2, "y": 0.95, "reactive": false }
] }
```

### Characters: give the data a face

- `stickman` is the house avatar: walk, run, jump, punch, kick, fall, ko,
  wave, dance (and `bow`, `spin` from 0.12.0), `point`/`present`/`look` at a
  target, `speech` bubbles from the frame's label, crowds (`count`), and six
  styles.
- `sprite` characters `hero`, `fighter` and `ship`, with `pose` (punch, hit,
  ko) and a player-two `variant: "alt"`.

Selection: `selectDetailed("data-viz", 0.3, 0, [])`

```json
{ "accent": "#ff2d2d", "layers": [
  { "type": "stickman", "action": "dance", "count": 9, "arrangement": "cluster", "highlight": 5, "scale": 0.35, "drive": "beat" }
] }
```

### Type: words that arrive

`type-reveal` writes word by word with an emphasised span; `chapter-card`,
`quote-card`, `caption`, `ticker` and `hud-score` cover titles, quotes,
subtitles, a news band and arcade read-outs.

Selection: `selectDetailed("text", 0.3, 0, ["type-reveal"])`

```json
{ "accent": "#ff2d2d", "layers": [
  { "type": "type-reveal", "text": "the frame tells the story", "framesPerUnit": 8, "fontSize": 40, "emphasisStart": 4, "emphasisEnd": 4 }
] }
```

## 4. Art-direction checklist

- **One idea, one accent.** Every frame should have a clear subject.
- **Contrast and space.** Big against small, busy against empty, still
  against moving.
- **Motion with meaning.** The signal drives one or two things you want the
  viewer to watch. Everything else holds or moves slowly.
- **Change over time.** A new beat every 2–4 seconds: a clip, a camera move, a
  reveal.
- **Land the ending.** Finish on a hold, a bow or a title rather than
  mid-motion.
- **Stay honest.** Creativity lives in the spec. Never add randomness outside
  the seed. If the look needs a primitive outside your selection, name it in
  `selectDetailed` (core and contrib primitives can be named; `sprite`,
  `tetris`, `plasma`, `gridhorizon` and `tunnel` come only with their own kit)
  and say so. If the vocabulary can't draw it, substitute openly
  ([filing-gaps.md](filing-gaps.md)).
- **Give each scene a place.** Backgrounds, image sets and multi-scene
  sequences are in [backgrounds-and-scenes.md](backgrounds-and-scenes.md).
