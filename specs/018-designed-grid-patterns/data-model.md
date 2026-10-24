# Data Model: Designed Grid Patterns

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## grid and checker (changed)

| Param | Type | Default | Bound | Meaning |
| --- | --- | --- | --- | --- |
| `pattern` | string | `""` | `maxLen` 4159; at most 64 × 64 cells | one letter per cell, rows split by `/` |
| `breaks` | string | `""` | `maxLen` 512; at most 16 entries | `col,row` entries that rotate or shift a cell |

Existing params are unchanged. On `grid`, `cols`/`rows` are ignored while `pattern` is set.
On `checker`, `size` still sets the square size.

## Cell (from a pattern letter)

| Letter | Role | Signal | Drawn as |
| --- | --- | --- | --- |
| `.` | off | — | nothing |
| `#` | fg | static | fg, full opacity |
| `a` | accent | static | accent, full opacity |
| `~` | signal | reacts | today's spectrum cell |
| `b` | reserved (spec 019) | — | nothing; reported |
| other | unknown | — | nothing; reported |

## Break

| Field | From | Bound | Combine |
| --- | --- | --- | --- |
| cell | `col,row` (0 at the top-left) | inside the grid, else ignored | key |
| rotation | `r<degrees>` | -45..45 after summing | add |
| offset x, y | `dx<cells>`, `dy<cells>` | -1..1 after summing | add |

**Rules**:
- Breaks are applied to the cell's drawing, centred on the cell.
- Broken cells are drawn after the others, in row-major order.
- At most 16 entries are kept.
