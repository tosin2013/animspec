# Data Model: Palette Profiles

| Field | Where | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- | --- |
| `profile` | spec | enum | `gameboy-dmg`, `genesis` | absent | In creative mode: the palette from the profile (R1–R2), or the 9-bit grid (R4) |
| `matrix` | `dither` layer | enum | `8`, `4`, `2` | `8` | `2`: a 2×2 Bayer matrix (checkerboard at 50%) |
| `profile` | `DrawContext` | string, optional | as above | absent | read by `image` for genesis snapping |

**Validation**: an unknown `profile` is dropped, and `profile dropped (must be gameboy-dmg or genesis)` is reported.

**Precedence**: the spec's `accent` and `roles` override the profile's. Under genesis, every colour is snapped.
