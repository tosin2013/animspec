# Contract: `pattern` and `breaks` on grid and checker (spec 018)

## Shape

```json
{
  "layers": [
    { "type": "grid", "solid": true,
      "pattern": "##.a.##/#.....#/..###../#.....#/##.a.##",
      "breaks": "3,2 r15; 0,4 dx0.25" }
  ]
}
```

## pattern

- Rows split by `/`; spaces are ignored; one letter per cell.
- `.` off · `#` foreground · `a` accent · `~` lit by the spectrum as today.
- **grid**: the pattern is the grid: columns = the longest row, rows = the number of rows;
  `cols`/`rows` are ignored.
- **checker**: the pattern repeats across the squares from the top-left; `size` sets the
  square size.
- `#` and `a` cells are static and opaque; with `solid: true` every pixel is exactly bg, fg or
  accent.
- Empty (the default): today's behaviour, byte-identical.

## breaks

- Entries split by `;`. Each is `col,row` followed by one or more of `r<degrees>`,
  `dx<cells>`, `dy<cells>`, separated by spaces. Example: `"3,2 r15; 5,1 dx0.5 dy-0.25"`.
- Columns and rows count from 0 at the top-left.
- A broken cell is turned about its own centre and/or moved, and drawn on top of the
  others. Every other pixel is unchanged.
- Order does not matter. A cell named twice adds its rotations and its offsets.
- Bounds: rotation -45..45°, offsets -1..1 cell (after adding); at most 16 entries.

## Validation (reported in `errors`; the layer always renders)

| Input | Result | Message (prefix `grid` or `checker`) |
| --- | --- | --- |
| unknown letter | read as `.` | `pattern: unknown letter "x" read as off` |
| `b` | read as `.` | `pattern: letter "b" is reserved; read as off` |
| short rows | padded with `.` | `pattern: rows padded to N columns` |
| more than 64 columns or rows | cut to 64 | `pattern: cut to 64 × 64` |
| malformed break entry | dropped | `breaks: entry "…" dropped (malformed)` |
| more than 16 entries | extra dropped | `breaks: N entries dropped (at most 16)` |
| cell outside the grid | ignored | `breaks: cell c,r is outside the grid; ignored` (grid only: a checker's board size depends on the frame size, so there it is ignored without a report) |
| value past its bound | clamped | — |

## For models

The `grid` and `checker` descriptions in the vocabulary prompt carry the letters and the
`breaks` form. Vocabulary version 13.
