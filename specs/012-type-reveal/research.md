# Research: type-reveal

## R1. Text from the layer param, falling back to the active label

Every existing text primitive renders the context's active label (`x.text`). The proposal
asks for a layer-level `text` param, which makes a saved spec self-contained — the words
travel with the spec, one spec can hold several reveals, and the determinism promise
("a spec that rendered yesterday renders the same frames tomorrow") covers the content,
not just the layout. The registry cannot express "required, no default", so the default is
`""`.

The empty default alone would fail the reactivity gate (a default layer that draws the
same nothing for every label and level is signal-blind, and gates are never weakened).
`chapter-card` already solved this: layer text first, **active label as the fallback**.

**Decision**: layer param `text`, `maxLen` 500, default `""`, falling back to the active
label when empty; both empty draws nothing. (Layer param chosen by the maintainer in
clarification; the fallback follows the chapter-card precedent.) The context-label-only
pattern stays for the primitives that already use it.

## R2. "No emphasis" is the −1 sentinel

`emphasisStart`/`emphasisEnd` are word indices with a "none" state. A boolean plus indices
adds a param for something two values can express; `0`-means-none is ambiguous with a real
emphasis on the first word.

**Decision**: default −1 on both params, bounds −1–10,000; a reversed span
(`emphasisEnd < emphasisStart`) also means none. (Maintainer, clarified 2026-10-18.)

## R3. Bounds the proposal left open

`sanitizeLayer` clamps every number to declared min/max bounds, so "≥ 0" and "≥ 1" need
maxima. Chosen generously against real use (a sentence revealed over minutes):
`startFrame` 0–1,000,000 (~9 hours at 30 fps), `framesPerUnit` 1–600 (10 min per word at
the extreme), `emphasisStart`/`End` −1–10,000 (500-char text caps words well below that).
`fontSize` 12–160, `x`/`y`/`maxWidth` 0–1 come from the proposal.

**Decision**: bounds as stated in spec FR-002.

## R4. Reveal schedule

Units appear at `startFrame + k * framesPerUnit`; visible count is a pure function of the
frame index — `clamp(floor((index − startFrame) / framesPerUnit) + 1, 0, units)` — so
order-independence (forward, backward, chunked, fresh-process) holds by construction, and
the block holds after its last unit. Units never disappear or fade: no strobe, so
`reducedFlicker` needs no special handling.

**Decision**: binary appear-once schedule as in spec FR-004.

## R5. Wrapping and placement

Word mode wraps greedily to `maxWidth * width` with the context's own measurement, drawing
word by word so the emphasis span can colour individual words inside a wrapped line.
Line mode treats each newline-separated line as one unit. Position `(x, y)` is the block's
anchor, normalised; `align` lays each row out inside the wrap width.

**Decision**: per-word drawing with greedy wrap (spec FR-005).
