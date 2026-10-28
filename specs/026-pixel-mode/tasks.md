---

description: "Task list for pixel mode and two-tone bars and rings"
---

# Tasks: Pixel Mode and Two-Tone Bars and Rings

**Input**: Design documents from `/specs/026-pixel-mode/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pixel-mode.md, quickstart.md

**Tests**: There is no separate test suite. The checks live in the existing gate scripts (the
spec's FR-010 and FR-013 require them), plus new reference cases.

**Organization**:
- US1: palette-exact `bars`, `hbars` and `rings` (#159).
- US2: pixel-art camera, `image`, `emitter` and `particles` (#111).
- US3: `tone2` (#158).

## Format: `[ID] [P?] [Story] Description`

- Paths are relative to the repository root.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- Never change a gate threshold or tolerance to make verify pass.
- At most 3 failed `npm run verify` attempts, then stop and report.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point: on branch `feature/026-pixel-mode`, `main` at 0.8.2 and `npm run verify` green before any change. Docker is reachable (`docker info`) for the x64 set.

---

## Phase 2: Foundational (blocks every story)

- [X] T002 Add `pixelMode?: boolean` with a doc comment (`/** Spec 026: whole-pixel drawing; see the primitives that honour it. */`) after `pixelAspect` in `AnimSpec` in `src/specInterpreter.ts`.
- [X] T003 Add `pixel?: boolean` with a doc comment to `DrawContext` in `src/primitives/registry.ts`. Set it in `drawSpec`'s `dctx` in `src/specInterpreter.ts`, only when `spec.pixelMode === true`, so the object stays the same shape for absent or false.
- [X] T004 Validator in `src/specValidator.ts`, following the `pixelAspect` block (lines ~124-128):
  - Keep `pixelMode` when `typeof v === "boolean"`.
  - For any other value, push exactly `pixelMode dropped (must be true or false)`.
  - Spread `...(pixelMode !== undefined ? { pixelMode } : {})` into both spec objects (the sequence path and the layers path).
- [X] T005 Add `pixelMode: { type: "boolean" }` next to `pixelAspect` in `buildJsonSchema` in `src/primitives/registry.ts` (line ~2647).
- [X] T006 In `renderShot` in `src/specInterpreter.ts` (research R2, R3), when `dctx.pixel` is set:
  - Save `ctx.imageSmoothingEnabled`, set it to `false` before the layer loop, and restore it after.
  - Build the camera transform from rounded offsets: at `s === 1`, one `translate(Math.round(W/2 + shakeX − lx·W), Math.round(H/2 + shakeY − ly·H))`; otherwise round the pre-scale and post-scale translates separately.
  - Leave the non-pixel path's three calls exactly as they are.
- [X] T007 Add validator checks to `scripts/verify-spec-validator.ts` as a new section "17. Pixel mode (spec 026)":
  - `true` and `false` are kept with no errors.
  - `1`, `"true"` and `null` are each dropped with `pixelMode dropped (must be true or false)`.
  - It is kept inside a sequence spec.
  - The schema lists `pixelMode`.
- [X] T008 Add a check to `scripts/verify-determinism.ts`: `pixelMode: false` renders byte-identically to no `pixelMode` for a composite spec with a camera.

**Checkpoint**: `npm run verify:validator` passes, and `npm run verify:determinism` still matches every existing hash.

---

## Phase 3: User Story 1 - Palette-exact print renders (P1) 🎯 MVP

**Goal**: With `pixelMode: true`, `bars`, `hbars` and `rings` frames contain only palette colours, even at a fractional pitch.

**Independent Test**: Render solid `bars` at width `n × 248.025` (where `n` is the spectrum length), and `rings`, both with `pixelMode`. Count the non-palette pixels: 0.

- [X] T009 [US1] Add `bars` pixel branch in `src/primitives/registry.ts` (R4). When `x.pixel`:
  - Bar `i` spans `x0 = Math.round(i*W/n)` to `x1 = Math.round((i+1)*W/n)`, width `Math.max(x1 - x0 - 1, 1)`.
  - Height is `Math.max(Math.round(spec[i]*maxH), 1)`.
  - The top is `H - h`, or `Math.round(H/2 - h/2)` for `baseline: "middle"`.
  - The non-pixel path is unchanged.
- [X] T010 [US1] Add `hbars` pixel branch in `src/primitives/registry.ts`: the same rule on the y axis (`y0 = round(i*H/n)`), with width `max(round(spec[i]*maxW), 1)`.
- [X] T011 [US1] Add `ringRaster(dw, dh, cx, cy, rings: Array<{ r: number; colour: string }>, thickness)` in `src/primitives/registry.ts`, next to `paletteMapped` (R5):
  - It builds an offscreen canvas of the bounding box with `createCanvas`.
  - Each ring has radius `R = Math.round(r)` and half-thickness `h = thickness/2`.
  - For each row, measured from pixel centres, it writes exact RGBA from `rgbOfColour` into `ImageData` over the spans where the centre's distance lies in `[R-h, R+h]`. Later rings overwrite earlier ones.
  - It returns the canvas and its integer top-left.
- [X] T012 [US1] Add `rings` pixel branch in `src/primitives/registry.ts`: when `x.pixel`, compute the same radii as today. Draw them with one `drawImage` of `ringRaster(...)`, smoothing off, at the integer top-left, centred on `Math.round(W/2), Math.round(H/2)`. The colour is the accent (US3 adds `tone2`). The non-pixel `arc` and `stroke` path is unchanged.
- [X] T013 [US1] Update the `bars`, `hbars` and `rings` descriptions in `src/primitives/registry.ts` to say "whole pixels in pixel mode".
- [X] T014 [US1] Add gate checks in `scripts/verify-determinism.ts`, under a "pixel mode (spec 026)" block:
  - `bars` at width `n × 248.025` and at the reference width, `hbars`, and `rings` at count 5 and at count 12 with thickness 9: 0 pixels outside {bg, fg, accent} at quiet, mid and loud, in pixel mode.
  - Bars cover the full width: the last bar's right edge (plus the 1 px gap) is `W`.
  - Each case renders identically twice, and a chunked render equals the whole.
- [X] T015 [US1] Add reference cases `bars:pixel`, `bars:pixel-middle`, `hbars:pixel`, `rings:pixel` and `rings:pixel-thick` (count 12, thickness 9) to `COMPOSITE_SPECS` in `scripts/lib/goldenHashes.ts`.
- [X] T016 [US1] Add pixel-mode probes of `bars`, `hbars` and `rings` (count 12, thickness 32) to the budget gate's probe list in `scripts/verify-gates.ts`. Do not change any threshold.

**Checkpoint**: US1 is independently demonstrable (quickstart §2).

---

## Phase 4: User Story 2 - Pixel-art scenes without host workarounds (P2)

**Goal**: With pixel mode, camera offsets are whole pixels, images sample nearest, and `emitter` and `particles` draw opaque whole-pixel squares.

**Independent Test**: An `image` with `smoothing: "smooth"`, a camera pan and an `emitter`, all in pixel mode: no blended column, and 0 non-palette particle pixels.

- [X] T017 [P] [US2] Add `image` pixel branch in `src/primitives/registry.ts` (R7). Introduce `const exact = !own || x.pixel === true`, and use it in place of `!own` / `own` in the `w`, `h` and `snap` expressions. Set `ctx.imageSmoothingEnabled = own && smooth && !x.pixel`. The palette and non-pixel paths are unchanged.
- [X] T018 [P] [US2] Add `particles` pixel branch in `src/primitives/registry.ts`: when `x.pixel`, `const s = Math.max(1, Math.round(size))`, then `fillRect(Math.round(px - s/2), Math.round(py - s/2), s, s)`.
- [X] T019 [US2] Add `emitter` pixel branch in `src/primitives/registry.ts` (R6). When `x.pixel`:
  - Every shape draws as `fillRect(round(px - s/2), round(py - s/2), s, s)`. `s = max(1, round(d))`, where `d` is the shape's visual diameter: petal `sPx*0.55*2`, spark `max(1, sPx*0.25)`, dust `sPx*0.6`, snow and ember `sPx*0.68`, and snow keeps its sway.
  - A particle draws at `globalAlpha = 1` only when its alpha is ≥ 0.5, and is skipped otherwise.
  - The burst ring draws with `ringRaster` at full opacity when its alpha is ≥ 0.5.
  - The non-pixel path is unchanged.
- [X] T020 [US2] Update the `emitter`, `particles` and `image` descriptions in `src/primitives/registry.ts` to mention pixel mode.
- [X] T021 [US2] Add gate checks in `scripts/verify-determinism.ts`:
  - `emitter` (dust, petal, spark, rate 200), `particles`, and `image` (smoothing smooth, scale 3, creative): 0 pixels outside the palette (and, for image, the art's own colours) in pixel mode.
  - A camera pan over a 1-px-column test layer (a `grid` with `cols` equal to the width, or the `image` fixture) shows no blended column on 16 sampled frames.
  - Chunk equals whole for each case.
- [X] T022 [US2] Add reference cases `emitter:pixel` (dust, petal), `particles:pixel`, `image:pixel` and `camera:pixel-pan` to `COMPOSITE_SPECS` in `scripts/lib/goldenHashes.ts`.
- [X] T023 [US2] Add pixel-mode probes of `emitter` (rate 200) and `particles` (count 500) to the budget gate in `scripts/verify-gates.ts`.

**Checkpoint**: US2 is independently demonstrable (quickstart §3 and §4).

---

## Phase 5: User Story 3 - Two-tone bars and rings (P3)

**Goal**: `tone2` puts the `fg2` role on alternate or peak bars and on alternate rings, with no leak.

**Independent Test**: Solid `bars` and `rings` with `tone2: "alternate"` and `roles.fg2` in creative mode: `fg2` appears only in the named bars or rings.

- [X] T024 [US3] Add `tone2: { type: "enum", values: ["none", "alternate", "peak"], default: "none", desc: "second tone (roles.fg2 in creative mode, else mid grey): alternate = odd bars, peak = the loudest bar instead of the accent" }` to `bars` in `src/primitives/registry.ts`:
  - `alternate`: odd `i` take `secondTone(p)` and even `i` take `p.fg`, while the peak keeps `p.accent`.
  - `peak`: the peak takes `secondTone(p)`.
  - It applies in both the pixel and non-pixel paths.
- [X] T025 [US3] Add `tone2: { type: "enum", values: ["none", "alternate"], default: "none", desc: "second tone (roles.fg2 in creative mode, else mid grey) on even rings, counted from 1" }` to `rings` in `src/primitives/registry.ts`:
  - Off pixel mode, set `strokeStyle` per ring only when `tone2 !== "none"`, so default calls are unchanged.
  - In pixel mode, pass per-ring colours to `ringRaster`.
- [X] T026 [US3] Bump `VOCABULARY_VERSION` to 17 in `src/primitives/registry.ts`. Run `npm run vocab:record -- "tone2 on bars and rings: a second tone (fg2) on alternate or peak bars and alternate rings"`, which updates `golden/vocabulary.json` and `VOCABULARY.md`.
- [X] T027 [US3] Add gate checks in `scripts/verify-determinism.ts`, in the style of spec 019's "b cells are exactly fg2":
  - In pixel mode with `roles.fg2` in creative mode, the named bars and rings are 100% `fg2`, and 0 `fg2` pixels lie elsewhere, at quiet, mid and loud.
  - In monochrome they are `#808080`.
  - `tone2: "none"` equals no `tone2`.
  - Chunk equals whole.
- [X] T028 [US3] Add reference cases `bars:tone2-alternate-fg2` (creative, roles.fg2), `bars:tone2-peak` (monochrome) and `rings:tone2-alternate-fg2` (creative, pixel mode) to `COMPOSITE_SPECS` in `scripts/lib/goldenHashes.ts`.

**Checkpoint**: US3 is independently demonstrable (quickstart §5).

---

## Phase 6: Polish & Cross-Cutting

- [X] T029 Amend `.specify/memory/constitution.md` from 6.1.0 to 6.2.0:
  - "The format" gains "the optional `pixelMode` (whole-pixel camera offsets, no smoothing, and whole-pixel drawing in the primitives that honour it)" after `pixelAspect`.
  - Add the Sync Impact Report and a Governance history entry, and update the version line.
- [X] T030 Refresh the reference sets with `npm run golden:update` (arm64 locally, x64 via Docker). Confirm that `git diff golden/*/hashes.json` shows only added keys. Add `golden/CHANGES.md` rows for the US1, US2 and US3 cases, marked spec 026 and both sets.
- [X] T031 [P] Add a print-exact showcase still (`bars` and `rings` with `tone2` in pixel mode) to `scripts/lib/showcase.ts`, then run `npm run showcase:generate`.
- [X] T032 [P] Add a "Pixel mode" section to `docs/user-guide.md` under Features, after "Palette roles and v2 characters". It covers:
  - the field and the six primitives that honour it;
  - camera rounding, and the zoom ≠ 1 and fade caveats;
  - emitter's 0.5 alpha threshold;
  - `tone2` with an example.
  Also add `pixelMode` to the spec-fields table.
- [X] T033 [P] Add a spec 026 row to `specs/ROADMAP.md` (pixel mode #111, #158, #159, 0.9.0), and update the "Pixel mode" open-items row.
- [X] T034 Run `npm run site:generate` and `npm run gallery:generate`. Gallery thumbnails should be unchanged because the defaults are unchanged; confirm `git diff gallery/` is empty.
- [X] T035 Run `npm run verify` (at most 3 failed attempts) and walk through `specs/026-pixel-mode/quickstart.md` §2 and §5 by hand with the CLI.
- [X] T036 Mark `specs/026-pixel-mode/spec.md` status "Implemented". Commit, push `feature/026-pixel-mode`, and open the PR with "Closes #158, #159". #111 stays open for the user to close or keep for more primitives. In the PR, ask whether to close #111.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T008)** blocks all stories.
- **US1 (T009–T016)**: T011 comes before T012. Other tasks touch the same registry file, so they run in order.
- **US2 (T017–T023)**: depends on Foundational. T019 uses `ringRaster` (T011) for the burst ring, so it runs after T011.
- **US3 (T024–T028)**: depends on Foundational. T025's pixel path uses `ringRaster` (T011).
- **Polish (T029–T036)**: after the stories. T030 needs every new case from T015, T022 and T028.

## Parallel Opportunities

- T017 and T018 change different primitives' draw bodies, so they can be written together (same file; merge carefully).
- T031, T032 and T033 touch separate files.
- The validator checks (T007) and the schema (T005) are independent of the draw changes.

## Implementation Strategy

1. **MVP**: Phases 1–3 (US1). The print programme gets palette-exact `bars` and `rings`. Verify passes with the new US1 cases.
2. **Increment 2**: US2 (pixel-art camera, image, emitter, particles).
3. **Increment 3**: US3 (`tone2` and the vocabulary bump to 17).
4. **Polish**: one constitution amendment, one golden refresh, docs, then the PR.
