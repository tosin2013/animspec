# Data Model: Sprite Sheets

New `image` params:

| Param | Type | Default | Rule |
| --- | --- | --- | --- |
| sheetCols | number 1..64 | 1 | rounded |
| sheetRows | number 1..64 | 1 | rounded |
| frames | number 0..4096 | 0 | 0 means every cell; clamped to `cols × rows` |
| fps | number 0..60 | 8 | 0 holds `frameStart` |
| frameStart | number 0..4095 | 0 | taken modulo the frame count |

**Cell**: `floor(width / cols)` × `floor(height / rows)`, in reading order. The source rect
fractions apply within the cell.
