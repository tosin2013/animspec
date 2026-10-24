# Research: Designed Grid Patterns

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Where the params live

**Decision**: two new `string` params on both `grid` and `checker` in
`src/primitives/registry.ts`: `pattern` (default `""`, `maxLen` 4159 = 64 × 64 letters plus
63 separators) and `breaks` (default `""`, `maxLen` 512). The string `ParamSpec` kind gains an
optional `example` (a valid sample value) so the gates probe a meaningful value.

**Rationale**: string params already exist (`ParamSpec`, `registry.ts:32-36`), and
`sanitizeLayer` (`~1835`) already trims them to `maxLen` and replaces newlines. Principle II
holds: each param declares its type, bound and default. The default `""` keeps the draw on
today's code path (FR-003, FR-015).

**Alternatives**: a structured layer field (as `bind`), or a new param kind. Rejected by the
maintainer (2026-10-23): both are format changes, and a string matches the sprite-bitmap
authoring style models already handle.

## R2. Pattern grammar and parsing

```text
pattern := row ( "/" row )*
row     := letter*
letter  := "." off | "#" fg | "a" accent | "~" signal   (anything else → "." and reported)
```

- Spaces are ignored (a newline becomes a space in `sanitizeLayer`, so a multi-line pattern
  written with `/` still parses).
- Columns = the longest row; shorter rows are padded with `.` (reported). At most 64 columns
  and 64 rows (cut and reported).
- One pure function, `parsePattern(s)`, exported from the registry module, returns
  `{ cols, rows, cells, problems }`. `draw` uses `cells` (the problems are ignored there), and
  the validator reports `problems`. So a raw, unvalidated spec renders exactly as its
  validated form: the stored string is not rewritten, only interpreted.
- `b` (reserved for spec 019) reads as `.` and is reported as "reserved".

## R3. Breaks grammar

```text
breaks := entry ( ";" entry )*
entry  := col "," row ( " " op )+
op     := "r" number    rotation in degrees, clamped -45..45
        | "dx" number   offset in cells, clamped -1..1
        | "dy" number
```

Example: `"3,2 r15; 5,1 dx0.5 dy-0.25"`. `parseBreaks(s, cols, rows)` returns a map keyed by
`col,row`, with summed and then clamped values (FR-013), plus problems. Entries naming a cell
outside the grid are ignored (FR-014). At most 16 entries are kept, counted in written order
after malformed ones are dropped; the 17th and later are dropped and reported.

**Order independence**: the map is keyed by cell, and sums commute, so any ordering gives the
same transforms. Broken cells are drawn after the others in row-major cell order, not in
entry order, so overlap is order-independent too (FR-013).

## R4. Drawing

- **Grid, pattern set**: cols/rows come from the pattern (FR-004). `.` draws nothing; `#`
  and `a` draw at full opacity in fg/accent (FR-006); `~` uses today's spectrum intensity
  formula for that cell, so a pattern of all `~` equals the unpatterned grid at the
  pattern's size. Faint gridlines stay as today in the non-solid branch.
- **Solid**: the existing solid branch's whole-pixel rectangles. A rotated cell is filled
  scanline by scanline: for each pixel row, the span of pixel centres inside the rotated
  rectangle, one `fillRect` per row, so no edge pixel blends (FR-007). Offsets snap to whole
  pixels.
- **Non-solid broken cell**: `save` → `translate` to the moved cell centre → `rotate` →
  `fillRect` centred → `restore`. Anti-aliased like the other cells.
- **Checker, pattern set**: the letter for square (c, r) is `cells[r % rows][c % cols]`
  (FR-005). `#` and `a` fill the square, `.` leaves it, `~` keeps today's parity/spectrum
  flip for that square.
- **Breaks without a pattern**: they apply to the cells the spectrum lights. A cell that is
  off draws nothing, so its break has no effect.

## R5. Validation reporting

The validator already reports malformed binds after `sanitizeLayer` (`specValidator.ts`
~line 129). Next to it: for `grid`/`checker` layers, call `parsePattern`/`parseBreaks` on the
sanitized strings and push each problem as `grid pattern: …` or `checker breaks: …`. Nothing
is dropped: the layer renders with the problems read as `.` or ignored (Principle IV).

## R6. Telling models

`buildVocabPrompt` lists param names only, and the schema does not list params. So the two
descriptions carry the grammar, kept short:

- grid: "matrix grid of cells lit by the frequency spectrum, or drawn from a `pattern` of
  rows split by / (. off, # fg, a accent, ~ spectrum); `breaks` like '3,2 r15; 5,1 dx0.5'
  rotate or shift single cells"
- checker: the same, with "tiled across the squares".

A description change is a registry change: it is in the vocabulary record, with the version
rise to 13 (FR-017).

## R7. Checks and probes

- **Gates**: `probeLayers` (`scripts/lib/gateKit.ts:31`) feeds every string param the icon
  names `heart` and `zz-unknown`. Change: when a string param declares `example`, probe it
  with that example instead. So the palette, purity and budget gates see a real pattern and
  real breaks. `nonDefaultOverrides` (`scripts/lib/goldenHashes.ts:420`) uses `example` the
  same way, so the order checks cover patterned layers. Existing params have no `example`,
  so their probes and cases do not change.
- **Validator**: letters, ragged rows, an oversized pattern, a reserved letter, malformed and
  excess breaks, an out-of-grid break.
- **Determinism**: the quilt's `.`/`#`/`a` cells by pixel at quiet, mid and loud (SC-002); an
  all-`~` pattern equals an unpatterned grid of that size; one break leaves every pixel
  outside the cell's area unchanged (SC-003); two orderings of three breaks are identical
  (SC-004); a solid patterned grid with a rotated break has only bg/fg/accent pixels
  (SC-006); chunk equals whole.
- **Reference cases** (`PATTERN_CASES` in goldenHashes, like `PARAM_CASES`):
  `grid:pattern-quilt`, `grid:pattern-solid`, `grid:pattern-breaks`, `checker:pattern`;
  3 frames each, 12 per set.
- **Showcase**: a quilt case and a "break it once" case.

## R8. Governance

A vocabulary change (new params on existing primitives), not a format change, as in 0.4.0:
`VOCABULARY_VERSION` 13, `npm run vocab:record`, VOCABULARY.md. No constitution amendment:
Principle II's declaration rule holds (string params with type, `maxLen` and default), and the
Quality Gates table is unchanged.
