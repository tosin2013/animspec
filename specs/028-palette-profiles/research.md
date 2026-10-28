# Research: Palette Profiles

## R1. Where the profile resolves

**Decision**: In `drawSpec`, after the accent and roles are computed, and only when
`opts.creative` and `spec.profile` are set.
- **`gameboy-dmg`**: bg, fg and accent become the arrangement's tones (unless the background is
  transparent, when bg and fg stay names). `roles` becomes the profile's roles (fg2 and the hero
  roles), overlaid with the spec's own roles. The spec's `accent` wins.
- **`genesis`**: bg and fg stay `"black"` and `"white"` (both are on the grid). The accent and every
  role are snapped with `snap9`.

`dctx.profile` carries the name, for `image`.

**Rationale**: Primitives already read only the palette. Resolving once keeps the profile out of
every primitive except the ones with fixed greys (R3) and `image` (R4).

## R2. Tones

**gameboy-dmg**:
- light (white background): bg `#9bbc0c`, fg `#0f380f`, accent `#306230`, fg2 `#8bac0f`.
- dark (black background): bg `#0f380f`, fg `#9bbc0c`, accent `#8bac0f`, fg2 `#306230`.

**Hero roles**:
- `outline`, `eyes`, `boots`, `cloak-shade` take fg.
- `hair`, `cloak`, `tunic` take the accent.
- `hair-light`, `skin`, `gold` take fg2.

## R3. Fixed greys

**Decision**: `shade(p, onBlack, onWhite, t)`.
- When bg is `"black"` it returns `onBlack`, and when bg is `"white"` it returns `onWhite`.
- Otherwise it mixes bg→fg at `t`, per channel, then returns the nearest of bg, fg, accent and the
  role colours (squared RGB distance; ties go to bg, fg, accent, then roles by name, as in
  `paletteMapped`).

Call sites and `t`:

| Site | Literals | `t` |
| --- | --- | --- |
| grid gridlines | #333 / #ccc | 0.2 |
| grid faint lines | rgba 0.08 | kept as fg at alpha 0.08 when not named |
| rain glyph | fg RGB | `rgbOfColour(p.fg)` |
| led off-dots | #141414 / #ececec | 0.08 |
| sprite D shade | #3a3a3a on black, fg on white | 0.23 on non-named |
| sprite B and W | — | 0.6 and 1, when bg is not named |
| tetris grid | #171717 / #e8e8e8 | 0.09 |
| dither grey stops | `g` or `255 − g` | mix at `i/(n−1)`, snapped |

**Rationale**: The literals are untouched, so no frame moves. Snapping makes GB solid draws land
on the four tones.

## R4. Genesis snapping of images

**Decision**: `snap9(c) = round(round(c·7/255)·255/7)` per channel. In `image`, when
`x.profile === "genesis"` and the asset draws in its own colours, the source rect is scaled (with
the existing smoothing rule; pixel mode forces nearest) into an off-screen canvas. Every pixel is
snapped there, alpha is kept, and the result is cached by asset and key, like `paletteMapped`.
Then it is drawn at whole pixels.

## R5. BAYER2

`[[0, 2], [3, 1]]`, so the thresholds are 0.125, 0.625, 0.875 and 0.375. At frac 0.5, the pixels
whose threshold is below 0.5 take the upper stop: a checkerboard.

## R6. Checks and cases

- **Reference cases**:
  - `profile:gameboy-light` and `profile:gameboy-dark` (tetris, hero, b-checker, pixel bars)
  - `profile:genesis-image` (image, pixel mode)
  - `dither:matrix2` (two stops)
  - `profile:gameboy-mono` (the same spec without creative mode, equal to no profile)
- **Determinism**:
  - The GB scene at 160×144 uses exactly 4 colours, at three levels and in both arrangements.
  - Every primitive's default layer under the GB palette passes `paletteViolation`.
  - The Genesis image has every channel on the grid.
  - The `matrix: "2"` 50% band is a checkerboard.
  - Profile without creative mode equals no profile.
  - A spec accent overrides the profile.
  - Chunk equals whole.
