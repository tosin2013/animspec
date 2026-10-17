# Data Model: Caption Params

## The `caption` layer

Four optional params, all with defaults that reproduce today's rendering.

| param | type | values / bounds | default | meaning |
| --- | --- | --- | --- | --- |
| `case` | enum | `upper`, `asis` | `upper` | letter case of the text |
| `box` | enum | `solid`, `none`, `outline` | `solid` | treatment of the box behind the text |
| `position` | enum | `bottom`, `top`, `center` | `bottom` | where the caption block sits |
| `maxLines` | number | 1–3 | 3 | most lines to show |

`sanitizeLayer` clamps `maxLines` to `[1, 3]` and drops an unknown enum value to its default.

## Rendering rules

- **Text source**: the active caption, else `SignalFrame.labels[0]` (unchanged).
- **`case`**: `upper` → `toUpperCase()`; `asis` → text as-is (after whitespace collapsing).
- **`box`**:
  - `solid` (default): fill the per-line box with `palette.bg`, then draw text in `palette.fg`.
  - `none`: no box; text in `palette.fg`.
  - `outline`: stroke the per-line box border in `palette.fg` (lineWidth 2); text in `palette.fg`.
- **`position`**: the block's top edge is `fs` (top), `(height − blockH) / 2` (center), or
  `height − fs − blockH` (bottom) — the bottom case reproducing today's exact geometry.
- **`maxLines`**: `lines.slice(-maxLines)`.

## Invariants

1. Default (`upper`, `solid`, `bottom`, `maxLines: 3`) is byte-identical to the pre-change caption.
2. Every style colours only with `palette.bg` and `palette.fg` (no accent, no literal colour).
3. `case`, `box`, `position` are `enum` params so `sanitizeLayer` clamps them; `maxLines` is a
   `number` with declared bounds.
