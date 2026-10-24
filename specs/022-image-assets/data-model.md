# Data Model: Image Assets

## `AnimSpec.assets`

`Record<id, { sha256: string; width: number; height: number }>`, with these rules:
- **id**: `ROLE_NAME`.
- **sha256**: 64 lowercase hex characters.
- **width, height**: integers 1..8192.
- **Size**: at most 32 entries, kept by sorted id.
- **Reporting**: bad entries are dropped and reported.

## `SpecOpts.assets` / `DrawContext.assets`

`Readonly<Record<id, AssetImage>>`, decoded bitmaps supplied by the host. `DrawContext` also
gains `creative: boolean`.

## `image` layer params

| Param | Type | Default | Rule |
| --- | --- | --- | --- |
| asset | string ≤16 | `main` | must be declared in `assets` (validator) |
| x, y | 0..1 | 0.5 | anchor position |
| anchor | enum 9 positions | center | |
| fit | contain, cover, stretch, none | contain | |
| scale | 0.05..8 | 1 | |
| srcX, srcY | 0..1 | 0 | |
| srcW, srcH | 0..1 | 1 | clamped to the asset |
| flip | none, x, y, xy | none | |
| opacity | 0..1 | 1 | |
| smoothing | nearest, smooth | nearest | |
| colour | asset, palette | asset | asset only in creative mode |
| wrap | none, x, xy | none | |
| scrollX, scrollY | −4..4 | 0 | frame widths or heights per second |
| drive | level, none | level | level: scale pulse ±2% |

## CLI

- Assets come from `<spec folder>/<id>.png`, or `--assets <dir>`.
- Exit 5 means an asset is missing or mismatched.
- The manifest gains `assets: { id: sha256 }`.
