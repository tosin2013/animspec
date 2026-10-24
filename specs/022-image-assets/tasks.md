---

description: "Task list for image assets"
---

# Tasks: Image Assets

**Input**: Design documents from `/specs/022-image-assets/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/image-assets.md, quickstart.md

**Tests**: No separate suite. The checks go in the existing gates, plus new reference cases.

**Organization**: by user story:
- US1: assets, the validated layer and the CLI (#108).
- US2: placement (#109, #113).
- US3: scrolling (#109).
- US4: colour modes.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- No gate assertion, threshold or tolerance edits. Supplying probe assets (R6) is harness
  input, not a weakening.
- At most 3 failed `npm run verify` attempts.
- Fixture images are drawn in code. No binary fixtures, and nothing copied from issues.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point:
  - Branch `feature/022-image-assets` is based on `main` at or after `a5b21d9`.
  - `.specify/feature.json` points at `specs/022-image-assets`.
  - `npm run verify` passes.
  - `docker info` works.

---

## Phase 2: Foundational

**Purpose**: the asset plumbing and the gate harness. Nothing renders differently.

- [X] T002 In `src/primitives/registry.ts`, extend `DrawContext` (line ~24) with:
  - `creative?: boolean`, commented "spec 022: creative mode, for image colour".
  - `assets?: Readonly<Record<string, AssetImage>>`, commented "spec 022: host-supplied decoded bitmaps".

  Import the `AssetImage` type from `../assets.js`.
- [X] T003 [P] Create `src/assets.ts`:
  - `export interface AssetImage { width: number; height: number }`, documented as "anything the canvas drawImage accepts, e.g. an @napi-rs/canvas Image or Canvas".
  - `ASSET_ID = ROLE_NAME` (re-export), `SHA256 = /^[0-9a-f]{64}$/`, `MAX_ASSETS = 32` and `MAX_ASSET_SIDE = 8192`.
  - `sanitizeAssets(raw): { assets: Record<string, {sha256,width,height}>; problems: string[] }`, with messages exactly as in contracts/image-assets.md. Keys are taken in sorted order, the first 32 valid ones kept.
  - `checkAssets(spec, bytes: Record<string, Uint8Array>): { ok: boolean; problems: string[] }`, using `node:crypto` sha256 (hex, lowercase), with problems `missing <id>` and `<id> sha256 mismatch`.
- [X] T004 In `src/specInterpreter.ts`:
  - Add `assets?: Record<string, {sha256: string; width: number; height: number}>` to `AnimSpec`, and `assets?: Readonly<Record<string, AssetImage>>` to `SpecOpts`.
  - Build `dctx` with `creative: opts.creative, assets: opts.assets`.
  - Change the special case (line ~146) to `if (layer.type === "image" && "_bitmap" in layer)` → legacy `drawImage`. Otherwise the registry path runs, with a comment on the legacy rule (R7).
- [X] T005 [P] In `scripts/lib/gateKit.ts`:
  - Add `export function probeAssets(): Record<string, Canvas>`, returning `{ main }`. It is a 64 × 48 canvas: four coloured quadrants (`#c83030`, `#30a050`, `#3050c8`, `#e0c040`), a diagonal grey gradient band, and a transparent 12 × 12 top-left corner. It is built once and memoised.
  - Add `assets: probeAssets()` and `creative` to every draw context built here (`renderProbe`, `measureBudget`, the composition budget's `drawSpec` opts). `RenderOpts` gains `creative?: boolean`, default false.
- [X] T006 [P] In `scripts/lib/goldenHashes.ts`:
  - `GoldenApi` gains an optional `assets`. `render` passes `assets` through `renderOpts`.
  - Export `goldenAssets()`: `tile` (32 × 32 pixel art), `photo` (96 × 64 gradients) and `alpha` (48 × 48 with transparency), all drawn in code with fixed colours, plus `main: probeAssets().main`.
  - Wire `goldenAssets()` into every `GoldenApi` construction (`verify-determinism.ts`, `golden-update.ts`, `order-child.ts`, `verify-package.ts` if it renders cases).
- [X] T007 Run `npm run check && npm run verify:determinism && npm run verify:gates`. Expect every existing hash unchanged and all gates passing (no `image` primitive yet).

---

## Phase 3: User Story 1 - Use art in a spec (Priority: P1) 🎯 MVP

**Goal**: A declared asset plus an `image` layer validates, renders deterministically, and works from the CLI with digest checking.

**Independent Test**:
- The spec validates with 0 errors.
- The CLI renders identically twice and in chunks.
- A tampered PNG exits 5 and names the asset.

- [X] T008 [US1] In `src/specValidator.ts`:
  - Sanitize `obj.assets` with `sanitizeAssets`, pushing its problems. Keep the result when non-empty and add it to the returned spec.
  - After the layer loop, drop every `image` layer whose `asset` is not a key of the sanitized assets. Push `image dropped (asset "<id>" is not declared in assets)` to `errors` and `"image"` to `dropped`. The spec is invalid only if no layers remain.
- [X] T009 [US1] In `src/primitives/registry.ts`, add the `image` entry after `dither`:
  - Header: `tier: "contrib"`, `category: "structure"`, and a description naming declared assets, placement, scrolling and the colour modes.
  - Params, exactly per data-model.md:
    - `asset` (string, default `"main"`, maxLen 16, example `"main"`);
    - `x`, `y` (0..1, 0.5);
    - `anchor` (enum `center|top-left|top|top-right|left|right|bottom-left|bottom|bottom-right`, default `center`);
    - `fit` (enum `contain|cover|stretch|none`, default `contain`);
    - `scale` (0.05..8, 1);
    - `srcX`, `srcY` (0..1, 0); `srcW`, `srcH` (0..1, 1);
    - `flip` (enum `none|x|y|xy`);
    - `opacity` (0..1, 1);
    - `smoothing` (enum `nearest|smooth`, default `nearest`);
    - `colour` (enum `asset|palette`, default `asset`);
    - `wrap` (enum `none|x|xy`);
    - `scrollX`, `scrollY` (−4..4, 0);
    - `drive` (enum `level|none`, default `level`).

  This task implements the asset-colour, non-wrap path per R4:
  - **Source**: look up `x.assets?.[asset]` and return when it is absent. The source rect is clamped, in asset pixels.
  - **Size**: from the fit, times `scale`, times the drive pulse `1 + (f.amplitude − 0.5)·0.04` (only when `drive` is `level`).
  - **Placement**: the anchor point sits at `(x·W, y·H)`.
  - **Drawing**: `save`; `globalAlpha = opacity`; `imageSmoothingEnabled = smoothing === "smooth"`; flip by translate plus `scale(±1, ±1)`; one 9-argument `drawImage`; `restore`. Cast `drawImage` as the existing code does (`registry.ts` dither and `specInterpreter.ts:193`).
- [X] T010 [US1] In `src/primitives/registry.ts` `buildJsonSchema`, add `assets: { type: "object", maxProperties: 32, propertyNames: { pattern: "^[a-z][a-z0-9-]{0,15}$" }, additionalProperties: { type: "object", properties: { sha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, width: { type: "integer", minimum: 1, maximum: 8192 }, height: { type: "integer", minimum: 1, maximum: 8192 } }, required: ["sha256","width","height"], additionalProperties: false } }`.
- [X] T011 [P] [US1] In `src/index.ts`, export `checkAssets`, and the type `AssetImage`, from `./assets.js`.
- [X] T012 [US1] In `cli/render.ts`:
  - Add the option `--assets <dir>` (default: the spec file's folder) and `const EXIT_ASSET = 5`.
  - After validation, for each id in `spec.assets`, read `<dir>/<id>.png`. A missing file exits with `fail(EXIT_ASSET, "asset <id>: missing <path>")`.
  - Run `checkAssets` and exit with `fail(EXIT_ASSET, "asset <id>: sha256 mismatch")` on the first problem.
  - Decode with `await loadImage(bytes)`, pass `assets` into every `drawSpec` call, and add `...(spec.assets ? { assets: Object.fromEntries(ids.map(id => [id, spec.assets[id].sha256])) } : {})` to the manifest.
  - Update the usage text.
- [X] T013 [US1] In `scripts/verify-cli.ts`:
  - Write a 16 × 8 PNG with `@napi-rs/canvas` into the temp folder as `pic.png`, compute its sha256, and write a spec with `assets: { pic: {...} }` and an `image` layer.
  - Assert that two `--raw` renders are byte-identical and that the manifest has `assets.pic === sha`.
  - Assert that after flipping a byte (rewriting a corrupted copy), the exit is 5 and stderr names `pic`.
  - Assert that a missing file also exits 5.
- [X] T014 [P] [US1] In `scripts/verify-spec-validator.ts`, add the contract's four messages, a clean asset spec (0 errors), sorted-order independence, and the undeclared-asset drop, which must appear in both `errors` and `dropped`.
- [X] T015 [US1] In `scripts/verify-determinism.ts`, add an "Image assets (spec 022)" block. Check:
  - (a) A creative `asset`-mode render of `photo` at `fit: none`, `scale: 1`, centred: its pixels equal the source pixels at the matching positions.
  - (b) Twice is identical.
  - (c) Chunked frames equal the whole.
  - (d) A spec without the bitmap supplied draws nothing for that layer.
  - (e) The legacy `_bitmap` raw layer still renders full-frame.
  - (f) `drive: none` gives the same output at quiet and loud levels.

**Checkpoint**: Art renders from specs and from the CLI with digests.

---

## Phase 4: User Story 2 - Place, crop and flip (Priority: P2)

**Goal**: Fit modes, anchor, source rect, flip, opacity and smoothing work.

**Independent Test**: The reference cases for each render known frames, and the determinism checks pass.

- [X] T016 [US2] Confirm that T009 implements every fit mode, all nine anchors, source-rect clamping (a zero area draws nothing), the three flips, opacity, and smoothing.
- [X] T017 [P] [US2] In `scripts/verify-determinism.ts`, check:
  - `flip: x` of `tile` equals a mirrored copy, pixel for pixel, at nearest smoothing and integer placement.
  - `fit: contain` keeps the aspect ratio inside the frame, and `cover` fills it.
  - A source rect of the left half draws only left-half colours.
  - `opacity: 0` draws nothing.
  - Nearest smoothing at `scale: 3` makes uniform 3×3 blocks.

---

## Phase 5: User Story 3 - Scroll and parallax (Priority: P3)

**Goal**: Seamless wrapping, scrolling as a closed form of time.

**Independent Test**: Frame n rendered alone equals frame n in sequence, and tiles join without a seam.

- [X] T018 [US3] In `src/primitives/registry.ts` `image` draw, add `wrap`:
  - The offset is `((scrollX·W·f.t) mod tileW + tileW) mod tileW` (and the same for y).
  - Draw the tile grid covering the frame from `−tile + offset`, capped at 64 tiles in total.
  - With `wrap: none`, scrolling moves the single image by the same offset, without tiling.
- [X] T019 [P] [US3] In `scripts/verify-determinism.ts`, check:
  - A wrapping, scrolling `tile` render of frame 17 alone equals frame 17 within a 0–30 sequence.
  - A one-tile-width scroll period returns to the frame-0 image.
  - Three planes at different speeds hash differently from the same planes static.

---

## Phase 6: User Story 4 - Colour modes (Priority: P4)

**Goal**: `palette` maps to palette colours, and `asset` keeps colours only in creative mode.

**Independent Test**: In palette mode with nearest smoothing, image pixels are only palette colours. `asset` outside creative mode equals `palette`.

- [X] T020 [US4] In `src/primitives/registry.ts`, add `colour` handling:
  - When `colour === "palette"` or `!x.creative`, map the source region through a memoised palette pass (R4, R5).
    - The candidates are `[p.bg, p.fg, p.accent, ...sorted roles values]`, de-duplicated in that order.
    - Each pixel gets the nearest candidate by squared RGB distance, with alpha kept.
    - The result is an off-screen canvas, cached in a module `WeakMap<AssetImage, Map<string, Canvas>>`, keyed by the candidate list and the source rect.
  - Draw from the mapped canvas in place of the asset.
- [X] T021 [US4] In `scripts/lib/gateKit.ts`, apply the palette-gate rule in `scripts/verify-gates.ts` `runPaletteGate`: skip the check only when `def.type === "image"`, the layer's `colour` is `"asset"`, and the probe is in creative mode. Probes pass `creative` false in monochrome mode, and true in the accent and roles modes. Document the rule in the gate's comment, quoting constitution 5.0.0 Principle III.
- [X] T022 [P] [US4] In `scripts/verify-determinism.ts`, check:
  - `colour: palette` with nearest smoothing on `photo` gives 0 image pixels outside {bg, fg, accent, roles}.
  - `asset` with creative false equals `palette` with creative false.
  - `asset` with creative true shows non-palette colours.

---

## Phase 7: Vocabulary, references, showcase

- [X] T023 Raise `VOCABULARY_VERSION` from 14 to 15 in `src/primitives/registry.ts`, then run `npm run vocab:record -- "spec 022: image primitive (declared, digest-pinned assets; placement, scrolling, colour modes)"`.
- [X] T024 In `scripts/lib/goldenHashes.ts`, add `IMAGE_CASES` per research.md R9 (11 named cases). Run `npm run golden:update`. Confirm key by key against `main`: 0 changed, and only `image@*` and `image:*@*` added. Add `golden/CHANGES.md` rows (2026-10-24, spec 022, both).
- [X] T025 [P] Run `npm run gallery:generate` and `npm run loops:generate` for `gallery/image.png` and `loops/image.gif`. These need the probe asset, so update `scripts/lib/thumbnails.ts` and the loop generator to pass `probeAssets()`.
- [X] T026 In `scripts/lib/showcase.ts`:
  - `ShowcaseCase` gains `assets?: () => Record<string, AssetImage>`, and `renderShowcase` passes it.
  - Add `parallax-forest` (since `0.8.0`, a loop, creative). Four in-code wrapping planes (sky gradient, mountain silhouettes, tree band, ground strip) scroll at speeds 0, 0.05, 0.15 and 0.4, with `drive: none`, and the `hero` bounces at speed π. The spec declares the four assets with placeholder digests computed from the canvases' PNG encoding.

  Then run `npm run showcase:generate` and `npm run site:generate`, and inspect frames with the scratchpad strip script.

---

## Phase 8: Polish

- [X] T027 Amend `.specify/memory/constitution.md` to 5.0.0 per research.md R8: Principle IV's image bullet, the Principle III exemption, "The format" (`assets`), the CLI scope entry (asset loading, a boundary move), the Quality Gates rows (palette exemption; asset digests checked by `checkAssets` and the CLI), and an amendment note (MAJOR).
- [X] T028 [P] Docs:
  - **`docs/user-guide.md`**: an "Images" section covering declaring assets, host bitmaps, CLI asset folders and exit 5, params, and colour modes; and the `assets` row in the spec fields table.
  - **`CHANGELOG.md`**: an Unreleased (vocabulary 15) entry.
  - **`specs/ROADMAP.md`**: a 022 row.
- [X] T029 Run `npm run verify`, at most 3 failed attempts. If `image:smooth` exceeds the cross-type tolerance, do not widen it: remove the case, open a known-issue like #126, and note it in the PR.
- [X] T030 Commit, push, and open the PR ("feat: image primitive with declared, digest-pinned assets (spec 022)"). Comment on #108 and #109.

---

## Dependencies & Execution Order

- T001 → T002 → T004.
- T003, T005 and T006 can run in parallel after T002. T007 closes Phase 2.
- **US1**: T008 → T009 → T010. T011 can run in parallel. T012 → T013. T014 and T015 come after T009.
- **US2**: needs T009.
- **US3**: T018 needs T009.
- **US4**: T020 needs T009, then T021 and T022.
- **Phase 7**: needs US1–US4.
- **Polish**: last.

## Parallel Examples

- After T002: T003 (`src/assets.ts`), T005 (`gateKit`) and T006 (`goldenHashes`).
- After T009: T014, T017, T019 and T022 (check files) alongside T018 and T020 (`registry`), keeping the `registry.ts` edits sequential.
- Polish: T028 alongside T027.

## Implementation Strategy

- **MVP**: Phases 1–3. Art renders from specs and the CLI with digests, and covers #108.
- **Then**: placement, scrolling and colour modes (#109, #113), then references, the showcase, the amendment and docs.
- One PR. The amendment ships with it, because Principles III and IV are violated without it.
