---

description: "Task list for clip sequences"
---

# Tasks: Clip Sequences

**Input**: Design documents from `/specs/025-clip-sequences/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/clip-sequences.md, quickstart.md

**Tests**: No separate suite. The checks go in the existing gates, plus new reference cases.

**Organization**:
- US1: declare a sequence of shots.
- US2: join shots with transitions.
- US3: shot lists from models and hosts (validation, schema, CLI).

**Standing rules**:
- No existing key in `golden/*/hashes.json` may change value.
- The two extractions (T002, T003) must leave every gate verdict, validator message and hash
  identical.
- No gate or threshold edits. At most 3 failed `npm run verify` attempts.
- Showcase output is checked from real pixels.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point:
  - Branch `feature/025-clip-sequences` is based on `main` at `5d3c843`.
  - `.specify/feature.json` points at `specs/025-clip-sequences`.
  - `npm run verify` passes. Save its output as `<scratchpad>/v25-baseline.log`.

---

## Phase 2: Foundational (pure refactors, no behaviour change)

- [X] T002 In `src/specInterpreter.ts`, extract `drawSpec`'s body after palette resolution into a private `renderShot(ctx, dims, frame, layers, camera, palette, dctxBase, opts, seed)`. It fills the background and runs the existing layer loop, unchanged:
  - camera transform and shake;
  - legacy `_bitmap`;
  - `applyBindings` with `seed`;
  - `layerSeed = mixSeed(seed, layerIndex)`;
  - plugin isolation.

  The shake takes `seed` too. `drawSpec` calls `renderShot(ctx, dims, frame, spec.layers ?? [], spec.camera, palette, dctx, opts, opts.seed)` and then the existing lift. Run `npm run verify:determinism`: every hash must be unchanged.
- [X] T003 In `src/specValidator.ts`, extract the top-level layer loop (the `ext:` plugin rules, `sanitizeLayer`, the bind, pattern and dither reporting) and the image-asset pass after it into `sanitizeLayerList(rawLayers: unknown[], ctx: { plugins?, assets? }, errors: string[], dropped: string[], prefix = ""): Record<string, unknown>[]`. With an empty prefix, messages are exactly today's. `validateAnimSpec` uses it for top-level layers. Run `npm run verify:validator` and `npm run verify:determinism`: identical output.

**Checkpoint**: The refactors leave verify identical against the T001 baseline.

---

## Phase 3: User Story 1 - Declare a sequence of shots (Priority: P1) 🎯 MVP

**Goal**: A sequence spec renders the clip owning each frame, with clip-relative time, a per-clip camera and per-clip seeds.

**Independent Test**: In a three-clip sequence, each sampled frame shows only its clip, a gap is background only, and frames rendered alone equal the same frames rendered in sequence.

- [X] T004 [US1] In `src/specValidator.ts`, add `sanitizeSequence(raw, ctx, errors, dropped)`, with messages exactly per contracts/clip-sequences.md:
  - an array, of which the first 64 are used;
  - each clip an object with integer `from ≥ 0`, `to > from`, `layers` via `sanitizeLayerList` with prefix `sequence[i]: ` (dropped when empty), optional `camera` via the existing `sanitizeCamera`, and optional `transition` (validated in T009);
  - order kept; a clip with `from` less than the previous kept clip's `to` is dropped.

  In `validateAnimSpec`, when `obj.sequence` is present:
  - Sanitize it, ignore and report top-level `layers` and `camera`.
  - The spec is valid when at least one clip remains.
  - Return `{ ..., layers: [], sequence }`.
  - Add `sequence?: Clip[]` to `AnimSpec` and export the `Clip` and `Transition` types in `src/specInterpreter.ts`.
- [X] T005 [US1] In `src/specInterpreter.ts` `drawSpec`, when `spec.sequence` is non-empty:
  - Find the active clip `c` with `from ≤ index < to`.
  - With no clip: fill the background only, then lift.
  - Otherwise build `clipFrame = { ...frame, index: index − c.from, t: index > 0 ? frame.t * (index − c.from) / index : 0 }` and `clipSeed = mixSeed(opts.seed, 0x51 + clipIndex)`, call `renderShot(ctx, dims, clipFrame, c.layers, c.camera, palette, dctx, opts, clipSeed)`, then lift.

  Transitions come in US2.
- [X] T006 [US1] In `src/primitives/registry.ts` `buildJsonSchema`, add `sequence`: an array (maxItems 64) of objects with `from` (integer ≥ 0), `to` (integer ≥ 1), `layers` (the same item schema as top-level `layers`, maxItems 12), `camera` (the same schema as top-level `camera`), and `transition` (`{ type: enum cut|wipe|iris|fade, frames: integer 1..600, direction: enum left|right|up|down }`).
- [X] T007 [P] [US1] In `scripts/verify-spec-validator.ts`, add the US1 messages:
  - overlap or out of order;
  - a bad range;
  - no valid layers;
  - more than 64 clips;
  - layers and camera ignored beside a sequence;
  - a clean three-clip spec (0 errors);
  - clip layers getting plugin and asset rules (an undeclared image in a clip is dropped with the `sequence[1]: ` prefix).
- [X] T008 [US1] In `scripts/verify-determinism.ts`, add a "Clip sequences (spec 025)" block. Check:
  - (a) Three clips [0,20), [20,40), [45,60) with distinct solid grids: frames 5, 25 and 50 each equal that clip's shot rendered alone as a single-shot spec at the clip-relative frame, with a matching seed setup. Compare the clip pixels against a spec of just that clip, rendered at the clip-relative index.
  - (b) Frame 42 (the gap) is background only.
  - (c) Frames 18–24 rendered alone equal the same frames in a 0–60 sequence.
  - (d) A per-clip camera zooms relative to the clip start: frame `from` equals zoom 1.
  - (e) Identical layers in two clips differ in seeded output (`emitter`).
  - (f) A spec without `sequence` is unchanged; this is covered by the hashes.

**Checkpoint**: Sequences render.

---

## Phase 4: User Story 2 - Transitions (Priority: P2)

**Goal**: cut, wipe, iris and fade between consecutive clips.

**Independent Test**: Wipe and iris pixels are wholly one clip's, fade pixels lie between the two clips', and frames rendered alone equal frames in sequence inside each transition.

- [X] T009 [US2] In `sanitizeSequence`, validate `transition`:
  - `type` must be one of `cut`, `wipe`, `iris`, `fade`; otherwise the transition is dropped and reported.
  - `frames` is an integer 1..600, required for non-cut, and clamped to `to − from` (reported).
  - `direction` is one of `left`, `right`, `up`, `down`, defaulting to `right` for wipe.
  - On the first kept clip, it is ignored and reported.
- [X] T010 [US2] In `src/specInterpreter.ts`, when the active clip B has a non-cut transition and `index − B.from < frames`, implement research.md R4:
  - The outgoing shot A is the previous clip when one exists before B, rendered with clip frame `index − A.from` and A's seed. When there is no previous clip, A is the background alone.
  - Render A and B with `renderShot` into two off-screen canvases (`createCanvas` from `@napi-rs/canvas` is already a dependency; the interpreter receives a ctx, so make the canvas via `ctx.canvas.constructor`, or import `createCanvas` into `specInterpreter.ts`, as `registry.ts` does).
  - Read both `ImageData`s, combine per pixel with `p = (index − B.from + 1)/(frames + 1)`, and `putImageData` onto `ctx`:
    - **wipe right**: B when `x < round(p·W)`; left, up and down are the mirrors;
    - **iris**: B when `(x+0.5−W/2)² + (y+0.5−H/2)² < (p·R)²`, with `R = hypot(W, H)/2`;
    - **fade**: `round(a·(1−p) + b·p)` on all four channels.
  - Then lift once. A cut needs nothing beyond the clip switch.
- [X] T011 [US2] In `scripts/verify-determinism.ts`, check:
  - For wipe, iris and fade (20 frames into clip B at 20): at frames 22, 29 and 38, every wipe and iris pixel equals A's or B's pixel at that frame, and every fade pixel lies between them per channel. A and B are rendered as the single-clip equivalents.
  - Frames rendered alone equal frames in sequence across 18–42 for each type.
  - A cut switches exactly at `from`.
  - A transition after a gap fades from the background.
  - A fade over a transparent background gives the alpha a steady mix.
  - Add the validator messages for a transition on the first clip, an over-long transition and a bad type to `scripts/verify-spec-validator.ts`.

---

## Phase 5: User Story 3 - Shot lists from hosts (Priority: P3)

**Goal**: The CLI renders sequences identically, and the manifest records the clip count.

**Independent Test**: CLI frames equal in-process frames for a sequence spec over a range crossing a transition, and the manifest has `clips`.

- [X] T012 [US3] In `cli/render.ts`, add `...(spec.sequence?.length ? { clips: spec.sequence.length } : {})` to the manifest.
- [X] T013 [US3] In `scripts/verify-cli.ts`, write the contract example (with a short signal track) and render frames 85–100 with `--raw`. Assert they are byte-identical to an in-process `drawSpec` render of the same frames, and that the manifest has `clips: 4`.

---

## Phase 6: Budget, references, showcase

- [X] T014 In `scripts/verify-gates.ts`, add a whole-composition case to the composition-budget cases: "sequence fade, 12 + 12 layers". It is a two-clip sequence of `composite:layers12-dark`'s layers with a 30-frame fade, measured at a frame inside the fade. Make `measureCompositionBudget` take the frame (add an optional `frame` argument) so it can measure inside a transition. If over 200 ms or 12,000 operations, stop and cap the layers per clip during transitions per the spec's edge case. Never raise the limit.
- [X] T015 In `scripts/lib/goldenHashes.ts`, add `SEQUENCE_CASES` per research.md R6:
  - `sequence:cut`;
  - `sequence:wipe` (direction left);
  - `sequence:iris`;
  - `sequence:fade`;
  - `sequence:gap`;
  - `sequence:camera`.

  They are designed so the quiet, mid and loud frame indices 0, 12 and 47 fall in clip 1, inside the transition, and in clip 2 respectively. Run `npm run golden:update`. Confirm key by key against `main`: 0 changed, 18 added. Add `golden/CHANGES.md` rows (2026-10-24, spec 025, both).
- [X] T016 In `scripts/lib/showcase.ts`, add `shot-list` (since `0.8.0`, a loop of 30 frames, creative), with clips over 30 frames:
  - [0,8) a `chapter-card` title, using a `label`;
  - [8,16) a `dither` night scene, with a 4-frame wipe-left in;
  - [16,24) `sprite hero` walking, with a 4-frame iris in;
  - [24,30) a `text` end card, with a 4-frame fade in.

  Run `npm run showcase:generate` and `npm run site:generate`. Render a strip of frames 4, 10, 18 and 26 from real pixels and confirm each shows its shot. Also check frames 9, 17 and 25 show the transitions.

---

## Phase 7: Polish

- [X] T017 Amend `.specify/memory/constitution.md` to 6.1.0 per research.md R7: "The format" gains `sequence`, and an amendment note says transitions are composition, not post-process, so #90 stands (MINOR).
- [X] T018 [P] Docs:
  - `docs/user-guide.md`: a "Sequences" section (clips, clip time, cameras, transitions, gaps, validation messages) and a `sequence` row in the spec fields table.
  - `CHANGELOG.md` Unreleased: a bullet.
  - `specs/ROADMAP.md`: a 025 row, and the "Clip sequences" row updated.
- [X] T019 Run `npm run verify`, at most 3 failed attempts. Also confirm a clean build, with `dist/` and `dist-verify/` removed first, passes `npm run check`.
- [X] T020 Commit, push, and open the PR ("feat: clip sequences with transitions (spec 025)"). Comment on #91.

---

## Dependencies & Execution Order

- T001 → T002 → T003. These are pure refactors and must be identical before anything else.
- **US1**: T004 → T005 → T006. T007 can run in parallel with T005. T008 comes after T005.
- **US2**: T009 → T010 → T011.
- **US3**: T012 → T013, after T005.
- **Phase 6**: needs US1 and US2. T014, then T015, then T016.
- **Polish**: last.

## Parallel Examples

- T007 (validator checks) alongside T005 (renderer).
- T018 (docs) alongside T017 (constitution).

## Implementation Strategy

- **MVP**: Phases 1–3. Sequences render with clip time, cameras and seeds.
- **Then**: transitions, the CLI, budget, references, showcase and docs.
- One PR. The amendment is MINOR and ships with it.
