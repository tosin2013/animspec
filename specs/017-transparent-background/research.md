# Research: Transparent Background

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Format shape

**Decision**: `background: "transparent"` plus an optional `ink: "light" | "dark"` at the top
level of the spec, default `light` (clarified 2026-10-23).

**Rationale**: The background value says what the frame sits on; `ink` says which solid
render it is lifted from. Keeping `ink` separate leaves the background enum at three values
and gives future background work one obvious place for "artwork tone".

**Alternatives considered**: a fourth background value `transparent-dark` (fewer fields, but
mixes two ideas in one enum); light only (misses print, which #100 names).

## R2. How a transparent frame is made

**Decision**: render the frame exactly as today on the matching solid background (black for
light ink, white for dark ink), then lift the background out pixel by pixel:

```text
light ink: a = max(r, g, b);        colour = (r, g, b) · 255 / a
dark ink:  a = 255 − min(r, g, b);  colour = ((r, g, b) − (255 − a)) · 255 / a
a = 0 → (0, 0, 0, 0)
```

Rounded to the nearest integer and written back to the same canvas. Done once per frame at
the end of `drawSpec`, only when the background is transparent.

**Rationale**:

- It is the unique "un-composite": laid over the matching background, the lifted pixel gives
  back the solid pixel (FR-007). A prototype over every primitive (38), both inks and three
  signal levels, composited over the matching background after the canvas round trip,
  showed **no difference** from the solid render.
- It needs no primitive change (FR-009, Principle III): background-coloured seams and masks
  become alpha 0, background-derived greys become partly transparent foreground (FR-006),
  and fully covered foreground or accent pixels keep their exact colour at alpha 255
  (FR-005), because one channel is at full strength.
- It is integer arithmetic on the frame's own bytes: deterministic, closed-form per frame,
  chunk-stable (FR-008).
- Cost: about 10 ms per 1080p frame in the prototype (a read, one pass, a write). Opt-in, so
  solid renders pay nothing.

**Alternatives considered**:

- Skip the fill and clear to alpha 0, as #100 sketches: primitives that paint the background
  colour (grid seams, figure and rig cut-outs, sprite and led unlit cells, 11 sites in the
  registry) would paint solid black or white; fixing each one changes primitives and leaves
  greys derived from the background (`#333` gridlines) as opaque grey.
- A `destination-out` composite for background-colour draws: covers exact-background fills
  only, not the greys, and needs a palette sentinel the primitives would have to honour.

## R3. Where the palette is decided

**Decision**: `drawSpec` resolves `bg`/`fg` from the lift source: light ink → `bg` black,
`fg` white; dark ink → `bg` white, `fg` black. Primitives receive an ordinary solid palette
and draw exactly as on that background. The lift runs after all layers and the camera.

**Rationale**: primitives stay palette-only (Principle III); a primitive that reads
`p.bg === "black"` for a tone keeps its behaviour.

## R4. Canvas round trip and what callers read back

**Decision**: write the lifted pixels with `putImageData`. The canvas stores premultiplied
colour, so a caller reading back with `getImageData` (the CLI, the reference sets) gets the
canvas's quantised unpremultiplied colour. Hashes are of those read-back bytes, so they are
deterministic. The colour of very faint pixels (alpha of a few steps) is coarse, but its
contribution to any composite is within one step, which is what FR-007 measures.

## R5. Validation

| Input | Result | Reported |
| --- | --- | --- |
| `background` `"transparent"` | kept | — |
| `background` unknown | `"black"` (today's rule) | — (unchanged) |
| `ink` absent with transparent | `ink` omitted; renders light | — |
| `ink` `"light"`/`"dark"` with transparent | kept | — |
| `ink` other value with transparent | `ink: "light"` | `ink must be light or dark; using light` |
| `ink` present with a solid background | dropped | `ink dropped (only applies to a transparent background)` |

The interpreter treats a missing or unknown `ink` as light, so an unvalidated spec renders
the same as its validated form.

**FR-013**: today the interpreter draws any background other than `"white"` on black, and
the validator rewrites unknown values to `"black"`. A raw spec with `"transparent"` therefore
drew on black and now draws transparent; a validated one holds `"black"` and is unchanged.
Recorded as a justified exception in the plan, as spec 016 did for FR-012.

## R6. Command line

**Decision**: no new flag. `--png` already writes RGBA PNGs and `--raw` already writes four
bytes per pixel (alpha 255 today). The one change: the renderer reuses one canvas across
frames, and the lift reads the canvas, so `drawSpec` MUST start a transparent frame from a
known state. It already fills the whole canvas with the source background before the layers,
which overwrites any earlier frame, so FR-011 holds without a `clearRect`; a CLI check proves
it (a frame from a range equals the same frame alone).

## R7. Checks

- **Gate (all primitives, FR-009, SC-002)**: in `scripts/verify-gates.ts`, a transparency
  check renders each primitive's validated default layer through `drawSpec` with both inks at
  the three probe levels, composites over the matching background, and compares with the
  solid render: at most 1 per channel. A new primitive therefore passes it or fails verify.
- **Determinism (FR-004, FR-005, FR-008, SC-003, SC-004)**: in
  `scripts/verify-determinism.ts`: empty pixels have alpha 0; fully covered foreground pixels
  are opaque in that colour; renders twice and in chunks are identical; a solid spec is
  unaffected by an `ink` value the validator would drop.
- **Validator**: the table in R5.
- **CLI**: a transparent `--raw` range equals the library's frames, alpha included; a `--png`
  file has alpha 0 in an empty corner.
- **Reference cases**: `background:transparent-light`, `background:transparent-dark` and
  `background:transparent-accent` (creative, accent set), three frames each, 9 per set.
- **Cross-type comparison** (revised at implementation): `comparePixels` ignored alpha. A raw
  comparison with alpha added was tried first, under Principle I as then written. For every
  existing case alpha is 255 on both sides, so the comparison and its results are unchanged.
  Raw colour is kept, not premultiplied: in monochrome transparent frames every lifted pixel
  is pure fg at some alpha, so the types differ only in alpha, by the amount their solid
  renders differ. If a reference case with an accent exceeds 8 in a raw channel, that is a
  Principle I question for the maintainer, not a reason to change the measurement
  (analysis finding C1, 2026-10-23).

  **Outcome**: the monochrome cases passed raw (colour 0, alpha at most 2), but
  `background:transparent-accent` differed by 255: a pixel at alpha 1 was pure red on arm64
  and white on x64, a difference of about 2 as seen. The maintainer chose to amend Principle
  I (constitution 3.0.0, its own commit): a pixel that is not fully opaque is compared by its
  colour weighted by alpha, plus its alpha, each within 8. `comparePixels` does that; opaque
  pairs compare raw colour exactly as before. Under it the largest cross-type difference in
  either set is 5.
- **Composition budget**: the composition gate gains one transparent 12-layer case, so the
  200 ms per 1080p frame bound covers the lift (analysis finding U1).

## R8. Governance

Constitution 3.1.0 (MINOR): the baseline's "The format" entry gains the transparent
background with light or dark ink; the Quality Gates table gains a row "a transparent frame
over its matching background equals the solid render (every primitive, both inks)". No
scope change, no new export (the `AnimSpec` type widens), no golden render hash moves,
`VOCABULARY_VERSION` untouched.
