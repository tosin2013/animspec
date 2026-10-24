# Research: Sprite Sheets

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Where the frame choice goes

**Decision**: compute the current cell at the top of `image`'s draw
(`src/primitives/registry.ts`, around line 601), before the source rect. The existing
`srcX/srcY/srcW/srcH` fractions are then applied to the **cell**, not the asset:

```text
cols = clamp(round(sheetCols), 1, 64)    rows = clamp(round(sheetRows), 1, 64)
cellW = floor(asset.width / cols)        cellH = floor(asset.height / rows)
cells = cols × rows                      count = frames > 0 ? min(round(frames), cells) : cells
i = fps > 0 ? (round(frameStart) + floor(f.t × fps)) mod count : round(frameStart) mod count
cx = (i mod cols) × cellW                cy = floor(i / cols) × cellH
sx = cx + round(srcX × cellW)            sw = min(cellW − (sx − cx), round(srcW × cellW))   (and the same for y)
```

**Byte-identity**: with the defaults (1×1, `frames` 0), the cell size equals the asset size
and the cell offset is 0. So `sx`, `sy`, `sw` and `sh` are exactly today's expressions
(`round(srcX × width)` and so on), and every existing image frame is unchanged (FR-005).

**Closed form**: `i` depends only on `f.t`, so seeking is exact and chunks match (FR-006).
`floor(f.t × fps)` with `f.t = index / fps_track` is deterministic in IEEE doubles on both
processor types.

## R2. Everything downstream

Flip, fit, anchor, wrap, scroll, opacity and smoothing all work on `(sx, sy, sw, sh)`, so they
apply to the cell with no change. Palette mode's memo key already includes the source rect
(`paletteMapped`), so each frame is mapped once and cached (FR-004).

## R3. Fixture and references

- **Fixture**: `goldenAssets()` gains `sheet`, a 64 × 16 canvas of four 16 × 16 cells. Each
  cell has a distinct colour block plus a moving "leg" pixel group, so the cell index is
  readable from fixed pixels. It is drawn in code; no binary.
- **Reference cases** (`goldenHashes.ts`):
  - `image:sheet-walk`: `sheetCols: 4`, `fps: 8`, `fit: none`, `scale: 4`, `drive: none`.
  - `image:sheet-start`: the same, with `frameStart: 2` and `flip: x`.
  - `image:sheet-fps0`: `fps: 0`, `frameStart: 3`, `colour: palette`.

  That is 9 per set. The default `image@*` cases are unchanged.
- **Showcase**: `sheet-walk`, a loop. An 8-frame walk sheet (`showcase/assets/sheet-walk/walk.png`,
  made by `scripts/generate-showcase-assets.ts`) plays over 022's scrolling ground plane.
  - **Why a committed file**: the showcase page prints the declared sha256, and PNG encoder
    bytes differ between macOS and Linux (the 022 CI finding). A committed file has one digest
    everywhere.
  - **Decoding**: it is decoded with `loadImage` by `preloadShowcaseAssets()`, which loads every
    file in `ASSET_FILES`.

## R4. Vocabulary

New params change the vocabulary snapshot, so `VOCABULARY_VERSION` goes from 15 to 16, then
`vocab:record`. No constitution change.
