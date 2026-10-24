# Data Model: Transparent Background

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Spec (changed)

| Field | Before | After (017) |
| --- | --- | --- |
| `background` | `"black"` (default) or `"white"` | `"black"` (default), `"white"` or `"transparent"` |
| `ink` | — | optional, `"light"` (default) or `"dark"`; only with `"transparent"` |

## Lift source

| `background` | `ink` | Drawn on | Palette `bg` / `fg` | Then |
| --- | --- | --- | --- | --- |
| `black` | — | black | black / white | nothing |
| `white` | — | white | white / black | nothing |
| `transparent` | `light` or absent | black | black / white | black lifted out |
| `transparent` | `dark` | white | white / black | white lifted out |

## Transparent pixel

| Solid pixel | Light ink result | Dark ink result |
| --- | --- | --- |
| the source background | alpha 0 | alpha 0 |
| fully covered fg | fg, alpha 255 | fg, alpha 255 |
| fully covered accent | accent, alpha 255 if a channel is 255; else more saturated at partial alpha | accent, alpha 255 if a channel is 0; else more saturated at partial alpha |
| a tone between the two | fg-side colour, partial alpha | fg-side colour, partial alpha |

**Rules**:

- Over the matching background (black for light, white for dark), a transparent frame gives
  back the solid frame within one step per channel.
- The frame depends only on spec, signal and seed.
- `ink` with a solid background is dropped and reported; an unknown `ink` becomes `light`
  and is reported.
