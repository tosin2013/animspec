# Data Model: Arcade HUD

## `versus-bars` (category `signal-bars`, tier `contrib`)

| Param | Type | Range or values | Default | Meaning |
| --- | --- | --- | --- | --- |
| `y` | number | 0–0.9 | 0.06 | top of the bars, fraction of height |
| `height` | number | 0.01–0.2 | 0.045 | bar thickness, fraction of height |
| `gap` | number | 0–0.5 | 0.12 | centre gap (for the timer), fraction of width |
| `angle` | number | 0–45 | 8 | slant of the outer ends in degrees (0 = square), drawn as whole-pixel steps |
| `tail` | boolean | | true | draw the damage tail |
| `drive` | enum | `level`, `none` | `level` | `level`: the tail flashes to fg on loud frames (energy ≥ 0.7) |

**Frame data**:
- `coords[0]`: left side, `{ x: fill, y: tail }`. `coords[1]`: right side. Each is clamped to
  0..1, and the tail is `max(fill, tail)`.
- With one entry, the right side is full. With none, the fills come from the spectrum's low and
  high halves, with no tail.

**Colours**: outline and fill `fg`. The tail is `accent` (creative, accent ≠ fg) or `#808080`;
`fg` while flashing.

## `hud-score` (category `text`, tier `contrib`)

| Param | Type | Range or values | Default | Meaning |
| --- | --- | --- | --- | --- |
| `layout` | enum | `shooter`, `versus` | `shooter` | where the labels go |
| `size` | number | 0.02–0.12 | 0.05 | text height, fraction of height (at least 10 px) |
| `captions` | boolean | | true | draw `1UP`, `HI-SCORE`, `CREDIT` |
| `drive` | enum | `level`, `none` | `level` | `level`: on loud frames (amplitude ≥ 0.6), `1UP` or the timer draws inverted |

**Frame data (`labels`)**:
- `shooter`: `[score, hiScore, credits]`.
- `versus`: `[timer, leftName, rightName]`.
- Values are cut to 12 characters, the timer to 3. A missing value is blank.

**Colours**: text `fg`. Inverted emphasis is `bg` text on an `fg` box.
