# Research: Caption Params

## R1. Defaults keep today's frames

The four defaults (`case: upper`, `box: solid`, `position: bottom`, `maxLines: 3`) map exactly
onto today's `caption.draw`: upper-cased text, last-3-lines, a filled box, and bottom
anchoring. The `box: solid` box is `palette.bg`-filled and text is `palette.fg`, which on the
default black background is byte-identical to the literal `"black"` fill + `"white"` text it
replaces.

**Decision**: defaults reproduce today's frames; no golden hash moves and no `golden/CHANGES.md`
entry is needed.

## R2. The palette fix (literal colour → palette.bg/fg)

`caption.draw` filled with literal `"black"`/`"white"` rather than `palette.bg`/`palette.fg`.
That happened to be palette-correct on the default background, but is not palette-correct in
general (on a white background, `"white"` text would be `bg`-coloured and `"black"` box would be
`fg`-coloured — still within the palette, but by accident). The issue flagged this and the
maintainer chose to fold the fix in.

**Decision**: read `palette.bg`/`palette.fg`. On the default black background this is
byte-identical; on a white background the solid box becomes a white (bg) box with black (fg)
text — still palette-pure, and now correct.

## R3. `outline` box colour

The issue phrases `outline` as "uses `bg` around `fg` text". A `bg`-coloured border is invisible
on the matching background, which would make `outline` indistinguishable from `none` in the
common (black-background) case. A `fg`-coloured border is a visible, unfilled box — a real
third style — and stays within `{bg, fg}`.

**Decision**: `outline` strokes the box border in `palette.fg`. Documented here so the
maintainer can correct it if `bg` was intended.

## R4. `case` is a reserved word

The param is named `case` (a JS keyword). This is fine because the registry, `sanitizeLayer`,
`buildVocabPrompt` and `draw` all use bracket notation (`l["case"]`) and object-literal keys;
nothing reads `layer.case` with dot notation, and JSON keys may be any string.

**Decision**: keep the name `case` as the issue names it; verified the code paths use bracket
access.

## R5. Probes and gates

`probeLayers` enumerates every non-default enum value and every number at min/max, so the new
params add seven probes (`case=asis`, `box=none`, `box=outline`, `position=top`,
`position=center`, `maxLines=1`, `maxLines=3`). Each passes the palette gate (bg/fg only), the
reactivity gate (text still drives output) and the budget gate (the default layer is unchanged).

**Decision**: no gate changes; the existing probes cover the new params.
