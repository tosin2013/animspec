---

description: "Task list for VGA dither scenes"
---

# Tasks: VGA Dither Scenes

**Input**: Design documents from `/specs/021-vga-dither/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dither-and-aspect.md, quickstart.md

**Tests**: No separate suite. The checks go in the existing gates, plus new reference cases.

**Organization**:
- US1: the `dither` primitive.
- US2: `caption.margin`.
- US3: `pixelAspect`.
- US4: the DOS showcase.

The vocabulary bump (T013) covers both US1 and US2. Until it lands, `verify:registry` reports
the vocabulary change, and that is expected.

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- No gate or threshold edits.
- At most 3 failed `npm run verify` attempts.
- No code copied from issue #107.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point:
  - Branch `feature/021-vga-dither` is based on `main` at `e1e21bb`.
  - `.specify/feature.json` points at `specs/021-vga-dither`.
  - `npm run verify` passes.
  - `docker info` works.

---

## Phase 2: Foundational

- [X] T002 In `src/primitives/registry.ts`, add the module helpers the dither needs, near `parsePattern`:
  - `BAYER4` and `BAYER8` (standard recursive Bayer matrices, values 0..N²−1).
  - `rgbOfColour(c: string): [number, number, number]`, accepting `black`, `white`, `#rgb` and `#rrggbb`.
  - `parseDitherColors(s: string): { names: string[]; problems: string[] }`:
    - Split on `,`, trim, and drop empties.
    - Keep the first 6, reporting `colors: only the first 6 are used` when there are more.
    - Report an empty list as `colors: empty; nothing drawn`.
    - Report each name that is not `bg`/`fg`/`accent` and fails `ROLE_NAME` as `colors: "<name>" is not a role name; drawn as its grey`.

  Pure functions. Nothing renders yet.

---

## Phase 3: User Story 1 - Draw dithered bands (Priority: P1) 🎯 MVP

**Goal**: A `dither` layer fills its region with an exact-colour ordered-dither gradient through its roles.

**Independent Test**: A creative three-role band has 0 pixels outside its stop colours and 0 changed pixels outside its region. In monochrome, all its pixels are on the bg–fg grey line.

- [X] T003 [US1] Add the `dither` entry to `PRIMITIVES` in `src/primitives/registry.ts`, after `checker`.
  - Header: `tier: "contrib"`, `category: "structure"`, and the description "an ordered (Bayer) dither gradient through up to six palette roles in a rectangular region — dithered skies, ground, props and UI bars for DOS/VGA-style scenes; exact colours, no blending".
  - Params, exactly per data-model.md:
    - `colors`: string, default `"bg,fg"`, maxLen 120, example `"bg,fg2,accent,fg"`, desc "comma-separated role names (bg, fg, accent or a `roles` name), 1–6 stops".
    - `x0`, `y0`, `x1`, `y1`: number 0..1, defaults 0, 0, 1, 1.
    - `matrix`: enum `["8","4"]`, default `"8"`.
    - `direction`: enum `["vertical","horizontal"]`, default `"vertical"`.
    - `chunk`: number 1..8, default 1.
    - `drive`: enum `["level","none"]`, default `"level"`, desc "level: stop boundaries shimmer with the signal (≤ ¼ stop); none: static scenery".
- [X] T004 [US1] Implement the `dither` draw in `src/primitives/registry.ts`, per research.md R1–R4.
  - **Region**: in pixels, `rx0 = round(min(x0,x1)·W)`, `rx1 = round(max(x0,x1)·W)`, and the same for y. Return when the area is zero. Read `chunk` as `round(chunk)`.
  - **Stops**: resolve each stop to RGB.
    - A built-in uses `p[name]`.
    - A named role uses `p.roles?.[name]`, else the grey `g = round(255·i/(n−1))`, which is `g` on black and `255−g` on white.
    - When `n === 1`, an undeclared named stop resolves to `p.bg`.
  - **Shift**: `(drive === "level" ? (f.amplitude − 0.5)·0.5 : 0)`.
  - **Fill**: create an off-screen canvas of the region size and fill its `ImageData` cell by cell.
    - A cell's matrix index comes from frame-origin cell coordinates, `floor(x/chunk) % N` and `floor(y/chunk) % N`.
    - Its position is `u` across the region along `direction`, sampled at the cell's start. Then `t = u·(n−1) + shift`, `i = clamp(floor(t), 0, n−2)`, `f = t − i`, and the cell takes stop `i+1` when `f > (m+0.5)/N²`, else stop `i`. A single stop is solid.
    - Alpha is 255.
  - **Draw**: `putImageData` on the off-screen canvas, then `ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, rx0, ry0); ctx.restore();`.
- [X] T005 [P] [US1] In `src/specValidator.ts`, after the spec 018 pattern reporting, for each `dither` layer push `dither ${msg}` for each problem from `parseDitherColors(layer.colors)`. Import it from the registry.
- [X] T006 [US1] In `scripts/verify-determinism.ts`, add a "Dither (spec 021)" block. Check:
  - (a) A creative band (`roles: { s0:"#000014", s1:"#281444", s2:"#6c3468" }`, `colors: "s0,s1,s2"`, region y0 0.1, y1 0.6, `drive: none`) has only s0, s1 and s2 inside the region, and only bg outside it.
  - (b) Monochrome: every pixel has r = g = b.
  - (c) In the blend between s0 and s1, the share of s1 rises from the first row band to the last.
  - (d) A single stop gives a solid region.
  - (e) `chunk: 4` makes every 4×4 cell uniform.
  - (f) `drive: none` gives the same output at quiet and loud levels, and `drive: level` differs.
  - (g) Chunked frames equal the whole render.
  - (h) Two adjacent bands that share the matrix origin join seamlessly, so the row pattern is continuous across the boundary.
- [X] T007 [P] [US1] In `scripts/verify-spec-validator.ts`, add the three `colors` messages from the contract and a clean case (no errors).

**Checkpoint**: The dither draws exactly. The registry gate reports the pending vocabulary bump until T013.

---

## Phase 4: User Story 2 - UI bar text (Priority: P2)

**Goal**: `caption.margin` places text inside a bar.

**Independent Test**: The default caption is byte-identical, and `margin: 0` with two lines sits flush at the bottom.

- [X] T008 [US2] In `src/primitives/registry.ts`, the `caption` entry:
  - Add `margin: { type: "number", min: 0, max: 4, default: 1, desc: "distance of the text from the top or bottom edge, in font-heights (no effect at center)" }`.
  - In draw, set `const margin = num(l, "margin", 1);` and change `blockTop` to `position === "top" ? fs * margin : position === "center" ? (d.height - blockH) / 2 : d.height - fs * margin - blockH`.
- [X] T009 [P] [US2] In `scripts/verify-determinism.ts`, add two checks:
  - A caption with `margin: 1` hashes the same as one without margin.
  - `margin: 0` moves the text down by exactly `fs` pixels (`fs = max(18, round(H/26))`), compared by the bounding rows of non-bg pixels.

---

## Phase 5: User Story 3 - Pixel aspect (Priority: P3)

**Goal**: `pixelAspect` is validated metadata, recorded in the CLI manifest.

**Independent Test**: The same pixels with and without it, and the manifest carries the value.

- [X] T010 [US3] Add `pixelAspect` across the spec format:
  - **`src/specInterpreter.ts`**: add `pixelAspect?: number` to `AnimSpec`, with the comment "Spec 021: intended pixel shape (height / width), metadata only; never changes a pixel".
  - **`src/specValidator.ts`**: keep a finite number from 0.5 to 2. Otherwise push `pixelAspect dropped (must be a number from 0.5 to 2)`. Add it to the returned spec after `roles`.
  - **`buildJsonSchema`**: add `pixelAspect: { type: "number", minimum: 0.5, maximum: 2 }`.
- [X] T011 [US3] In `cli/render.ts`, add `...(spec.pixelAspect !== undefined ? { pixelAspect: spec.pixelAspect } : {})` to the manifest object (line ~162), using the validated spec variable in scope.
- [X] T012 [P] [US3] Add the checks:
  - **`scripts/verify-spec-validator.ts`**: 1.2 is kept, while 3 and `"x"` are dropped with the message.
  - **`scripts/verify-determinism.ts`**: identical hashes with and without `pixelAspect: 1.2`.
  - **`scripts/verify-cli.ts`**: render one frame of a spec with `pixelAspect: 1.2` and assert `"pixelAspect":1.2` in the manifest line, and its absence without it (follow the existing manifest assertions).

---

## Phase 6: Vocabulary and references (US1 + US2)

- [X] T013 [US1] In `src/primitives/registry.ts`, raise `VOCABULARY_VERSION` from 13 to 14. Then run `npm run vocab:record -- "spec 021: dither primitive (ordered Bayer gradient through palette roles); caption margin"`.
- [X] T014 [US1] In `scripts/lib/goldenHashes.ts`, add `DITHER_CASES`, rendered like `PATTERN_CASES`:
  - `dither:sky-roles`: creative, the roles from T006, `colors "s0,s1,s2"`, `drive "none"`.
  - `dither:horizontal-mono`: `colors "bg,a1,a2,fg"`, `direction "horizontal"`.
  - `dither:solid-band`: creative, `roles { bar: "#0000a8" }`, `colors "bar"`, y0 0.7.
  - `dither:chunk4`: `matrix "4"`, `chunk 4`.
  - `caption:margin-0`: `{ layers: [{ type: "caption", box: "none", margin: 0, maxLines: 2 }] }`.
- [X] T015 [US1] Run `npm run golden:update`. Confirm key by key against `main` that 0 values changed, and that the additions are only `dither@*`, `dither:*@*` and `caption:margin-0@*`. Add `golden/CHANGES.md` rows (date 2026-10-24, spec 021, set both) for the new `dither` primitive's default cases and for each named case.
- [X] T016 [P] [US1] Run `npm run gallery:generate` and `npm run loops:generate` for `gallery/dither.png` and `loops/dither.gif`.

---

## Phase 7: User Story 4 - DOS showcase (Priority: P4)

**Goal**: A looping DOS point-and-click scene matching the approved prototype.

**Independent Test**: `showcase/dos-adventure.gif` validates cleanly and stays fresh under verify.

- [X] T017 [US4] In `scripts/lib/showcase.ts`:
  - Add `label?: string` to `ShowcaseCase`, with the comment "the active caption text, for caption layers".
  - In `renderShowcase`, use `labels: c.label ? [c.label] : undefined`.
  - Add `dos-adventure` (since `0.7.0`, a loop, creative) with `pixelAspect: 1.2` and roles for the sky (5), sand (3), bar, monolith (2), terminal (2), screen glow, and the hero's roles.
  - Layers, all bands with `drive: "none"`:
    - The sky, `y1` 0.56.
    - The sand, `y0` 0.56, `y1` 0.7.
    - The bar, `y0` 0.7.
    - The monolith: faces at x 0.694–0.763, y 0.24–0.61, and an edge at 0.694–0.713.
    - The terminal: body, screen, and three glow-line bands.
  - Then the hero, with `motion: "bounce"`, `speed: π`, `scale: 3`, `y: 0.5` and `reactive: false`.
  - Then a caption with `box: "none"`, `margin: 0` and `maxLines: 2`.
  - Label: `"look   take   use   talk   walk  > survey the monolith"`.
  - Caption: "Ordered Bayer `dither` bands for the sky, sand, props and the UI bar; the hero walks; the verb and parser line sit in the bar with `caption.margin`. `pixelAspect: 1.2` records the Mode 13h pixel shape."
- [X] T018 [US4] Run `npm run showcase:generate` and `npm run site:generate`. Render a frame strip of `dos-adventure` with the scratchpad strip script and compare it with the approved prototype.

---

## Phase 8: Polish

- [X] T019 Amend `.specify/memory/constitution.md` to 4.2.0:
  - "The format" entry gains "the optional `pixelAspect` (intended pixel shape, metadata only)".
  - Add an amendment note: spec 021, MINOR, a format entry change; no golden hash moves; vocabulary 14 for `dither` and `caption.margin`; post-process effects remain out of scope, because a layer draws only its own region.
- [X] T020 [P] Docs:
  - **`docs/user-guide.md`**: add a "Dithered scenes" section (the `dither` params, roles, monochrome greys, `drive`), and add `margin` to the caption description.
  - **Spec fields table**: add `pixelAspect`.
  - **`CHANGELOG.md`** Unreleased: add bullets, and change the vocabulary note to 14.
  - **`specs/ROADMAP.md`**: add a 021 row, and update the "Retro style profiles" row to note that #107 is covered natively, with the finish chain still #90.
- [X] T021 Run `npm run verify`, at most 3 failed attempts.
- [X] T022 Commit, push, and open the PR ("feat: dither primitive, caption margin and pixelAspect (spec 021)"). Comment on #107.

---

## Dependencies & Execution Order

- T001 → T002.
- **US1**: T003 → T004. T005 and T007 can run in parallel after T002. T006 comes after T004.
- **US2**: T008, then T009. Independent of US1.
- **US3**: T010 → T011 → T012. Independent of US1 and US2.
- **Phase 6**: needs T004 and T008. T013 → T014 → T015, and T016 in parallel with T015.
- **US4**: needs T004, T008, T010 and T015.
- **Polish**: last.

## Parallel Examples

- After T002: T005 and T007 (validator files) alongside T003 and T004 (registry).
- US2 and US3 can run alongside US1 (different code regions). Coordinate edits to `registry.ts`.
- T016 alongside T015. T020 alongside T019.

## Implementation Strategy

- **MVP**: Phases 1–3 plus Phase 6, so `dither` ships with its references.
- **Then**: the caption margin, `pixelAspect`, the showcase, and polish.
- One PR.
