# Data Model: VGA Dither Scenes

## `dither` layer

| Param | Type | Default | Rule |
| --- | --- | --- | --- |
| colors | string | `"bg,fg"` | comma-separated role names, 1–6 used; maxLen 120 |
| x0, y0, x1, y1 | number 0..1 | 0, 0, 1, 1 | region; min/max taken per axis; zero area draws nothing |
| matrix | enum `8`, `4` | `8` | Bayer matrix size |
| direction | enum `vertical`, `horizontal` | `vertical` | gradient axis |
| chunk | number 1..8 | 1 | dither cell size in pixels (rounded) |
| drive | enum `level`, `none` | `level` | `level` slides boundaries by ≤ ¼ stop with amplitude |

## `caption.margin`

A number 0..4, default 1: font-heights between the text block and the top or bottom edge.

## `AnimSpec.pixelAspect`

An optional number 0.5..2. It is metadata only, and is recorded in the CLI manifest.
