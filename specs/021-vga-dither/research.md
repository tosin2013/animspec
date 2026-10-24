# Research: VGA Dither Scenes

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Drawing strategy within the budget

**Decision**:
- Build the region's pixels in an off-screen canvas through `ImageData` (whole cells of
  `chunk` pixels, one stop colour each).
- Draw that canvas onto the frame with a single `drawImage` at integer coordinates, with
  `imageSmoothingEnabled = false` inside `save`/`restore`.

**Rationale**:
- At 1080p with `chunk` 1, per-cell `fillRect` would be about 2 M operations, against a
  budget of 3,000. `drawImage` is one counted operation; the operation counter skips
  off-screen canvases, and the time check (50 ms) covers them. A 1920 × 1080 byte loop is
  well under that.
- An unscaled integer `drawImage` copies bytes exactly. Under the camera's zoom, disabling
  smoothing keeps it nearest-neighbour, so pixels stay exact stop colours (FR-003).
- `drawImage` honours the context transform (camera) and composites normally (transparent
  background lift), unlike `putImageData`.

**Alternatives**:
- `createPattern` per stop pair: more calls, and the pattern origin interacts with the camera.
- Run-length `fillRect`: in a blend zone, rows alternate every pixel, so the operation count
  explodes.

## R2. Bayer thresholds and stop lookup

- **Matrices**: standard recursive Bayer 4 × 4 and 8 × 8, with threshold `(m[y][x] + 0.5) / N²`.
- **Lookup**: for a cell at gradient position `u` (0..1 across the region, along `direction`),
  `t = u·(n−1) + shift`, with `i = clamp(floor(t), 0, n−2)` and `f = t − i`. The cell takes
  stop `i+1` when `f > threshold`, else stop `i`.
- **Matrix indexing**: by cell coordinates relative to the frame origin (not the region), so
  adjacent bands share one continuous pattern.
- **One stop**: a solid fill.

## R3. `drive` (reactivity)

**Finding**: the vetting gate (`verify-gates.ts` `runReactivityGate`) fails any primitive whose
default layer renders identically for quiet versus loud and for two labels.

**Decision**: `drive: enum ["level", "none"]`, default `"level"`.
- `level`: `shift = (amplitude − 0.5) · 0.5`, so stop boundaries slide by at most a quarter
  stop either way: a shimmer.
- `none`: `shift = 0`, a static band.

**Rationale**: this follows `rig`'s `drive` precedent. The gate is unchanged, and designed
scenes set `none`.

## R4. Colours

- **Built-ins**: `bg`, `fg` and `accent` resolve to `p.bg`, `p.fg` and `p.accent`
  (`"black"`/`"white"` or hex).
- **Named roles**: `p.roles?.[name]`, else the grey `round(255·i/(n−1))` (on a white
  background, `255 −` that). One stop resolves to the background.
- **Parsing**: a small parser turns `black`, `white`, `#rgb` and `#rrggbb` into RGB.
- **`colors` string**: split on `,`, trimmed, empty entries dropped, first 6 kept. The
  validator reports an empty list, more than 6 entries, and names failing `ROLE_NAME`.

## R5. `caption.margin`

**Decision**: a number from 0 to 4, default 1, giving `blockTop = d.height − fs·margin − blockH`
(bottom) or `fs·margin` (top), and ignored at the centre.

**Byte-identity**: `fs·1 === fs`, so the default draws exactly as today.

## R6. `pixelAspect`

- **Validator**: a finite number from 0.5 to 2 is kept; anything else is dropped with
  `pixelAspect dropped (must be a number from 0.5 to 2)`.
- **Schema**: `{ type: "number", minimum: 0.5, maximum: 2 }`.
- **Types**: `AnimSpec.pixelAspect?`. The interpreter ignores it (FR-009).
- **CLI manifest** (`cli/render.ts:162`): `...(spec.pixelAspect !== undefined ? { pixelAspect } : {})`.
- **Constitution**: "The format" entry gains it. MINOR, 4.2.0.

## R7. Registry entry

- `type: "dither"`, `tier: "contrib"`, `category: "structure"`.
- **Params**:
  - `colors` (string, default `"bg,fg"`, maxLen 120, example `"bg,fg2,accent,fg"`).
  - `x0`, `y0` (0..1, default 0); `x1`, `y1` (0..1, default 1).
  - `matrix` (enum `8`|`4`, default `8`).
  - `direction` (enum `vertical`|`horizontal`).
  - `chunk` (1..8, default 1).
  - `drive` (enum `level`|`none`).
- **Description**: names the ordered Bayer dither, the roles, and the DOS/VGA use.
- **Vocabulary**: version 13 → 14 (a new primitive, and `caption.margin`).

## R8. References, showcase, site

- **Default cases**: `dither@quiet/mid/loud` are added automatically.
- **Named cases** (`DITHER_CASES`):
  - `dither:sky-roles`: creative, four named roles, vertical, `drive: none`.
  - `dither:horizontal-mono`: monochrome, horizontal.
  - `dither:solid-band`: one role, a region.
  - `dither:chunk4`: matrix 4, chunk 4.
  - `caption:margin-0`: two lines, bottom.
- **Showcase**: `ShowcaseCase` gains an optional `label` (the caption text), and
  `renderShowcase` uses it. The new case is `dos-adventure` (a creative loop):
  - the dithered sky, desert, bar, monolith and terminal, all as `dither` bands with
    `drive: none`;
  - the hero bouncing at `speed: π`;
  - a two-line caption at `margin: 0` with the verb row and the parser line.
- **Site**: `gallery:generate` and `loops:generate` produce `gallery/dither.png` and
  `loops/dither.gif`; then `site:generate`.
