# Research: Image Assets

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. How bitmaps reach `draw`

**Decision**:
- **`SpecOpts.assets?: Readonly<Record<string, AssetImage>>`**, where `AssetImage` is anything
  the canvas `drawImage` accepts (an `@napi-rs/canvas` `Image` or `Canvas`), with a numeric
  `width` and `height`.
- **`DrawContext.assets`** carries it to primitives.
- **`drawSpec` stays synchronous.** Decoding (`loadImage`, `new Image()`) happens in the host
  or the CLI before rendering.

**Rationale**: Principle III means no file access in `draw`, and the render path is synchronous
today (chunked renders and the CLI loop depend on that). Pre-decoded bitmaps keep the frame a
pure function of (spec, assets, signal, seed).

**Alternatives**:
- Bytes in `SpecOpts`, decoded inside `drawSpec`: that would be async decode on the render
  path, or a hidden cache.
- Paths in the spec: rejected by the maintainer.

## R2. Digests

**Decision**: export `checkAssets(spec, bytes: Record<string, Uint8Array>)`, returning
`{ ok, problems }`, where each problem is `missing <id>` or `<id> sha256 mismatch`. It uses
`node:crypto` sha256 over the file bytes (the PNG as stored).

- **Validator**: checks `assets` shape only. The id follows `ROLE_NAME`, the sha256 is
  `/^[0-9a-f]{64}$/`, and width and height are integers 1..8192. At most 32 entries, kept by
  sorted id.
- **CLI**: reads `<id>.png` from the spec's folder or `--assets <dir>`, calls `checkAssets`,
  and on failure exits with the new `EXIT_ASSET = 5`, naming the asset. Otherwise it decodes
  with `loadImage` and passes the map. The manifest gains `assets: { id: sha256 }`.

**Rationale**: the digest pins which bytes were meant, independent of the machine. The library
check lets hosts other than the CLI verify too. `hashBytes` in `src/rng.ts` is FNV-32, too
weak for content pinning, so sha256 it is.

## R3. Validation across layers

`sanitizeLayer` sees one layer without spec context. `validateAnimSpec` does a pass after the
layers: an `image` layer whose `asset` is not in the sanitized `assets` map is dropped and
reported as `image dropped (asset "<id>" is not declared in assets)`. Its type is pushed to
`dropped` too, so callers see it.

## R4. The `image` primitive

- **Tier and category**: `tier: "contrib"`, `category: "structure"`.
- **Params**:
  - `asset` (string, default `"main"`, maxLen 16);
  - `x`, `y` (0..1, 0.5);
  - `anchor` (enum `center|top-left|top|top-right|left|right|bottom-left|bottom|bottom-right`,
    `center`);
  - `fit` (enum `contain|cover|stretch|none`, `contain`);
  - `scale` (0.05..8, 1);
  - `srcX`, `srcY` (0..1, 0); `srcW`, `srcH` (0..1, 1);
  - `flip` (enum `none|x|y|xy`);
  - `opacity` (0..1, 1);
  - `smoothing` (enum `nearest|smooth`, `nearest`);
  - `colour` (enum `asset|palette`, `asset`);
  - `wrap` (enum `none|x|xy`);
  - `scrollX`, `scrollY` (−4..4, 0, frame widths or heights per second);
  - `drive` (enum `level|none`, `level`).
- **Geometry**:
  - **Box**: the whole frame.
  - **Fit**: `contain` is `min(W/sw, H/sh)`, `cover` is `max`, `stretch` scales per axis, and
    `none` is 1. The result is multiplied by `scale`, and under `drive: level` by
    `1 + (amplitude − 0.5)·0.04`.
  - **Placement**: the anchor point is placed at `(x·W, y·H)`.
  - **Scroll**: the offset is `(scrollX·W·t) mod tileW`.
  - **Tiles**: the visible tiles are drawn, at most `ceil(W/tileW)+1` by `ceil(H/tileH)+1`,
    capped at 64 tiles (beyond that the tile is too small to matter; the layer reports
    nothing and draws the first 64).
- **Drawing**:
  - **Calls**: one `drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh)` per tile, inside
    `save`/`restore`.
  - **Flip**: done with `scale(−1, 1)` around the tile.
  - **Smoothing and opacity**: `imageSmoothingEnabled` follows `smoothing`; `globalAlpha`
    follows `opacity`.
- **Colour**:
  - **When the art keeps its colours**: only `colour === "asset"` with `p.roles !== undefined`
    or `p.accent !== p.fg`. A creative signal is needed, because `Palette` has no creative
    flag.
  - **Decision**: add `creative: boolean` to `DrawContext` (set by `drawSpec` from
    `opts.creative`). That is cleaner than inferring it.
- **Palette mapping**:
  - **Candidates**: `[bg, fg, accent, ...sorted roles]`, de-duplicated in that order (which
    is also the tie order).
  - **Per pixel**: the nearest candidate by squared RGB distance; alpha is kept.
  - **Where it runs**: on an off-screen copy of the source region, before placement.

## R5. Cost and caching

- **Asset-colour path**: up to 64 `drawImage` operations, well under 3,000.
- **Palette path**: per-pixel mapping of the source region. To stay under the 50 ms budget on
  large assets, the mapped canvas is memoised in a module-level
  `WeakMap<AssetImage, Map<key, Canvas>>`, keyed by the palette candidates and the source
  rect.
- **The memo cannot change output.** It is a pure function of its key, and the WeakMap holds
  no reference that outlives the asset, so determinism holds (Principle I is about output).
  It is a rendering cache, not frame state.

## R6. Gates without a spec

- **Probe asset**: `gateKit.probeAssets()` returns `{ main: <canvas> }`. It is a 64 × 48
  canvas drawn in code: a four-colour quadrant pattern, a diagonal gradient, and a
  transparent corner. It is deterministic and has no file.
- **Draw contexts**: every probe draw context gets `assets: probeAssets()` and
  `creative: <mode>`. That covers `renderProbe`, `measureBudget`, the composition budget, and
  the IO guard run.
- **Golden renders**: `GoldenApi` gains an optional `assets`, so golden renders supply the
  same map.
- **Not a weakening**: the gates' assertions are unchanged. They now give `image` something
  to draw.
- **Palette gate**: for `image` layers with `colour: asset` (the default) in creative probe
  modes, it skips the check. In monochrome and in `colour: palette`, it checks normally.
  Probe modes pass `creative` explicitly.

## R7. The interpreter and legacy `_bitmap`

`drawSpec` currently special-cases `layer.type === "image"` (`specInterpreter.ts:146`). The new
rule:
- if the raw layer carries `_bitmap`, use the legacy full-frame path (unchanged);
- otherwise, use the registry `image` primitive.

Validated specs never carry `_bitmap`, because `sanitizeLayer` keeps declared params only. So
the legacy path stays reachable only for unvalidated host calls, as before (Principle V).

## R8. Constitution 5.0.0

- **Principle IV**: replace the `image` bullet with "An `image` layer is accepted only when it
  names an asset declared in the spec's `assets` map (id, sha256, size); a spec never names a
  bitmap by path or URL. The legacy pre-loaded `_bitmap` path stays for callers that pass one,
  and is never reachable from a validated spec."
- **Principle III**: add the asset exemption, scoped to `colour: asset` in creative mode.
- **Scope**:
  - "The format" gains `assets`.
  - The CLI entry gains "loading the PNG assets a spec declares from its folder, checked by
    sha256", a boundary move from "held by the caller".
- **Quality Gates**: palette row exemption, an asset-digest row (CLI + `checkAssets`).
- **Version**: MAJOR, 4.2.0 → 5.0.0.

## R9. References and showcase

- **Golden assets**: in-code canvases (`goldenAssets()` in `goldenHashes.ts`):
  - `tile`: 32 × 32, crisp pixel art;
  - `photo`: 96 × 64, gradients;
  - `alpha`: 48 × 48, with transparency.
- **Cases**:
  - `image@*` (default, probe asset `main`);
  - `image:contain-corner`;
  - `image:cover`;
  - `image:src-flip`;
  - `image:opacity`;
  - `image:smooth`;
  - `image:wrap-scroll`;
  - `image:palette-mono`;
  - `image:palette-roles`;
  - `image:asset-creative`;
  - `image:asset-noncreative`.

  That is 11 × 3 = 33 per set.
- **Showcase**: `parallax-forest`. Four wrapping planes drawn as in-code canvases (sky,
  mountains, trees, ground) scroll at four speeds, with the `hero` walking. `ShowcaseCase`
  gains an optional `assets` factory.

## Implementation findings (2026-10-24)

- **Palette mapping happens after scaling.**
  - **The problem**: the first gate run failed. A palette-mapped image drawn with
    `smoothing: smooth` blended *two* palette colours at its edges (an accent/role mix,
    pixel `230,26,5`), which no palette triangle accepts.
  - **The fix**: in palette mode the source rect is scaled to its whole-pixel destination
    size first (with the chosen smoothing), then mapped, then drawn at a whole-pixel
    position with smoothing off. Every pixel is then an exact palette colour (checked by
    "palette mode stays exact under smooth scaling").
- **No palette-gate logic change.** The gates probe with creative off, so every image they
  see is palette-mapped and fully checked. The `colour: asset` exemption only applies to
  creative renders, which the gates never make. R6's planned skip rule was therefore not
  needed, and is recorded in the constitution's Quality Gates row instead.
- **The CLI gained `--creative`.** Without it the CLI always rendered with creative mode
  off, so `colour: asset` could never show the art's colours. The manifest records
  `creative`.
- **`GoldenApi.assets` is optional and explicit.** The determinism gate's deliberately fake
  "stateful" API has no real canvas, so assets are supplied only by the real APIs.
- **Cross-type**: the largest difference across 381 cases is 5/255, including
  `image:smooth`, inside the 8/255 tolerance.
