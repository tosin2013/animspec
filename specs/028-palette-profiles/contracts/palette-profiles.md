# Contract: Palette Profiles

```jsonc
{ "background": "white", "profile": "gameboy-dmg", "pixelMode": true,
  "layers": [{ "type": "tetris" }, { "type": "sprite", "character": "hero", "motion": "static" }] }
// render with { creative: true }
```

| Promise | Holds when |
| --- | --- |
| Identical to no profile | creative mode off |
| Only the four DMG tones | gameboy-dmg, creative mode, solid primitives (tetris, sprite, solid grid/checker patterns, dither, pixel-mode bars/hbars/rings/emitter/particles) |
| Every channel on the 9-bit grid | genesis, creative mode, solid primitives and pixel-mode `image` |
| Spec `accent` / `roles` win | always (snapped under genesis) |
| `dither` `matrix: "2"` 50% band is a checkerboard | always |
