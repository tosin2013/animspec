---

description: "Task list for camera shake and a wider camera range"
---

# Tasks: Camera Shake and a Wider Camera Range

**Input**: Design documents from `/specs/016-camera-shake-range/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/camera-shake.md, quickstart.md

**Tests**: No separate test suite. The checks live in the existing validator and determinism
gates and in new reference cases, as for spec 014.

**Organization**: By user story in priority order. The range change (US3) moves no frame and
is independent; the shake (US1) comes first because it is the request in #87.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 shake, US2 shake under parallax, US3 wider range
- Paths are relative to the repository root; run commands from there.

**Standing rule**: no existing key in `golden/arm64/hashes.json` or `golden/x64/hashes.json`
may change value. A changed hash is a defect in the task, never a `golden/CHANGES.md` row.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point: branch `feature/016-camera-shake` is based on `main` at or after `d3d0e7c`, `.specify/feature.json` points at `specs/016-camera-shake-range`, `npm ci` has run, `npm run verify` passes, and `git status --short golden/` is empty

---

## Phase 2: Foundational

**Purpose**: The type every story uses.

- [X] T002 In `src/specInterpreter.ts` add `export interface CameraShake { amp: number; freq: number }` and the optional field `shake?: CameraShake` to `CameraSpec` (around line 34), with a comment: "amp: largest offset as a fraction of the frame (0..0.05); freq: base oscillations per second (above 0, at most 5; default 3). Spec 016." `CameraSpec` is not exported from `src/index.ts`, so leave `index.ts` alone. Run `npm run check`

**Checkpoint**: The type exists; nothing behaves differently.

---

## Phase 3: User Story 1 - A camera can shake, the same way every time (Priority: P1) 🎯 MVP

**Goal**: An optional seeded, closed-form shake on any camera move; absent or `amp: 0` is byte-identical to today.

**Independent Test**: The determinism gate's new shake checks pass: identical twice, chunk equals whole, seeds differ, `amp: 0` equals no shake, a static camera shakes.

### Implementation for User Story 1

- [X] T003 [US1] In `src/specValidator.ts` `sanitizeCamera`, validate `c.shake` per contracts/camera-shake.md: absent → no `shake`; not a plain object → push `camera shake dropped (must be an object)` and omit `shake`; `amp` missing or not a finite number → push `camera shake dropped (amp must be a number)` and omit; `freq` present and (not a finite number or ≤ 0) → push `camera shake dropped (freq must be a positive number)` and omit; otherwise keep `{ amp: clamp(amp, 0, 0.05), freq: Math.min(5, freq ?? 3) }`. A dropped shake MUST keep the rest of the camera. Add `shake` to the returned object only when kept
- [X] T004 [US1] In `src/specInterpreter.ts` add `function shakeOffset(shake: CameraShake, t: number, seed: number): { dx: number; dy: number }` implementing research.md R2 exactly: draw four phases from one `mulberry32(mixSeed(seed, 0x5ea4e))` stream, each times 2π, in the order φ1, φ2, φ3, φ4; `dx = amp * (Math.sin(TAU * freq * t + φ1) + 0.5 * Math.sin(TAU * 2.31 * freq * t + φ2)) / 1.5`; `dy` the same with φ3, φ4. Add `import { mixSeed, mulberry32 } from "./rng.js";` (the file uses `.js` extensions) and a module constant `const TAU = Math.PI * 2;`, as neither exists in `src/specInterpreter.ts` today
- [X] T005 [US1] In `drawSpec` (`src/specInterpreter.ts`), compute the shake once per call, after `cameraState`: `const shake = spec.camera?.shake && spec.camera.shake.amp > 0 ? shakeOffset(spec.camera.shake, frame.t, opts.seed) : null;`. Inside the per-layer camera block, when `shake` is non-null, replace the first `ctx.translate(dims.width / 2, dims.height / 2)` with `ctx.translate(dims.width / 2 + shake.dx * k * dims.width, dims.height / 2 + shake.dy * k * dims.height)` where `k` is `depth` under `parallax` and 1 otherwise; when `shake` is null keep today's exact call. The no-shake path must issue exactly the same canvas calls as before (research.md R3)
- [X] T006 [P] [US1] In `src/primitives/registry.ts` `buildJsonSchema`, add to the camera object's `properties`: `shake: { type: "object", properties: { amp: { type: "number", minimum: 0, maximum: 0.05 }, freq: { type: "number", exclusiveMinimum: 0, maximum: 5 } }, required: ["amp"], additionalProperties: false }`
- [X] T007 [P] [US1] In `scripts/verify-spec-validator.ts`, after the existing camera checks (around line 160), add: a valid shake is kept with its values; `amp: 0.2` clamps to 0.05; `freq: 40` clamps to 5; a shake without `freq` gets `freq: 3`; and the four malformed cases (`shake: 5`, `shake: {}`, `shake: { amp: "x" }`, `shake: { amp: 0.01, freq: 0 }`) are each dropped with their exact message while `camera.move` is still present (SC-006)
- [X] T008 [US1] In `scripts/verify-determinism.ts`, section 7 (camera), add checks using the existing `renderCam` helper and a static camera with `shake: { amp: 0.02, freq: 4 }` on a `grid` layer: "shake moves the frame" (shaken frame 12 differs from unshaken frame 12); "shake renders identically twice"; "shake chunk render equals the whole" (frames 3–5 alone equal the same frames within 0–7); "different seeds shake differently" (add a seed parameter to `renderCam` defaulting to 7, compare seeds 7 and 8); "shake amp 0 equals no shake" (SC-003); "a static camera shakes" (static camera frames 0 and 12 differ); "zoom does not enlarge the shake" (on a layer with one sharp vertical edge, the edge's pixel shift between shaken and unshaken frame 12 is the same at zoom 1 and zoom 2, within 1 pixel); "reduced flicker leaves the shake unchanged" (on a `grid`, which does not read `reducedFlicker`, the shaken frame 12 is byte-identical with it on and off)
- [X] T009 [US1] Run `npm run verify`; confirm it passes and `git diff --stat golden/` is empty

**Checkpoint**: Shake works on every move; no reference frame moved.

---

## Phase 4: User Story 2 - Shake respects depth under parallax (Priority: P2)

**Goal**: Under parallax, each layer's shake is scaled by its depth.

**Independent Test**: The determinism gate shows a depth-0 layer unshaken and a depth-1 layer shaken.

### Implementation for User Story 2

- [X] T010 [US2] In `scripts/verify-determinism.ts` section 7, add with a parallax camera whose `from` and `to` have equal zoom and point (so only the shake moves anything) and `shake: { amp: 0.02, freq: 4 }`: "depth 0 layer does not shake under parallax" (a `grid` at `depth: 0` renders frame 12 byte-identically to the same spec without `shake`, SC-004); "depth 1 layer shakes under parallax" (differs); and "a non-parallax move ignores depth" (a `pan` camera with `shake`, a `grid` at `depth: 0` still differs from no shake). T005 already implements `k`; fix it there if a check fails
- [X] T011 [US2] Run `npm run verify:determinism`; confirm the three checks pass

**Checkpoint**: Shake reads as a camera move in parallax scenes.

---

## Phase 5: User Story 3 - A camera can travel further (Priority: P3)

**Goal**: Keyframe `x`/`y` accept -1..2; specs inside 0..1 are unchanged.

**Independent Test**: The validator keeps `x: 1.5` and clamps beyond -1..2; a pan to 1.5 ends one frame width right of a pan to 0.5.

### Implementation for User Story 3

- [X] T012 [US3] In `src/specValidator.ts` `sanitizeCamera`'s `key()` helper, change the clamp of `x` and `y` from `Math.min(1, Math.max(0, v))` to `Math.min(2, Math.max(-1, v))`, with a comment citing spec 016 FR-010 and FR-012
- [X] T013 [P] [US3] In `src/primitives/registry.ts` `buildJsonSchema`, change `x` and `y` in both `from` and `to` to `minimum: -1, maximum: 2`
- [X] T014 [P] [US3] In `scripts/verify-spec-validator.ts`, add: `x: 1.5` kept; `x: 3` clamps to 2; `y: -2` clamps to -1; `x: 0.7` unchanged
- [X] T015 [US3] In `scripts/verify-determinism.ts` section 7, add "a pan to x 1.5 ends one frame right of x 0.5" (SC-005): render the final frame of a `pan` from x 0.5 to x 1.5 over a `grid`, and compare it with a static camera at x 1.5 (they must be identical), and with a static camera at x 0.5 (they must differ)
- [X] T016 [US3] Run `npm run verify`; confirm it passes and no existing hash moved

**Checkpoint**: All three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 Add a camera case table to `scripts/lib/goldenHashes.ts`, rendered like the other named tables (validated layers, `creative: false`, `reducedFlicker: true`) at the three reference frames (index 0, 12, 47): `camera:shake-static` (static camera at the centre, `shake: { amp: 0.02, freq: 4 }`, layers `grid` and `wave`); `camera:parallax-shake` (parallax, equal keyframes, `shake: { amp: 0.03, freq: 3 }`, layers `gridhorizon` at `depth: 0` and `figure` at `depth: 1`); `camera:pan-wide` (pan from frame 0 x 0.5 to frame 47 x 1.5, layers `grid`, `dots`). Run `npm run golden:update`; confirm 9 cases added per set, 0 changed, cross-type difference within 8; add one `golden/CHANGES.md` row per case
- [X] T018 [P] Update `specs/014-camera/contracts/camera.md`: add `shake` to the shape and rules and change the `x`/`y` range to -1..2, linking `specs/016-camera-shake-range/contracts/camera-shake.md`; update 014 `spec.md`'s edge case "`x`/`y` outside 0..1: clamped" to "outside -1..2: clamped (widened by spec 016)"
- [X] T019 [P] Update the camera section of `docs/user-guide.md` (around line 218): add `shake` with an example, its bounds and default, the depth rule under parallax, and the -1..2 range; regenerate the site with `npm run site:generate`
- [X] T020 Amend `.specify/memory/constitution.md` to 2.16.0 (MINOR): in the baseline's "The format" entry, extend the camera wording with "an optional seeded, closed-form shake, and keyframe points from -1 to 2"; in the Quality Gates table's camera row add "the shake is closed-form and chunk-stable, scaled by depth under parallax"; append an amendment note in the existing style naming spec 016, no scope change, no new export, no golden render hash moves, `VOCABULARY_VERSION` untouched; update the version line and Last Amended date
- [X] T021 Update `specs/ROADMAP.md`: 016 row to "Implemented on branch `feature/016-camera-shake`", and `CHANGELOG.md` gets an "Unreleased" section listing the shake, the range, and the intended change for unvalidated specs with keyframes outside 0..1 (FR-012)
- [X] T022 Run every step of `specs/016-camera-shake-range/quickstart.md`, including step 7 by eye (render frames of `camera:shake-static` and `camera:parallax-shake` and look at them), and record the outcomes in a new `specs/016-camera-shake-range/validation.md`
- [ ] T023 Commit, push the branch, open a pull request into `main` in milestone 0.5.0 that closes #87 and references #111 (pixel mode stays open), and merge only after its Verify check has finished and passed

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002)** → stories.
- **US1 (T003–T009)** needs T002. **US2 (T010–T011)** needs T005. **US3 (T012–T016)** needs only T001 and can go first or in parallel with US1, but shares `specValidator.ts`, `registry.ts` and the two check files.
- **Polish** needs all stories; T017 before T022.

### Tasks that share a file

- `src/specValidator.ts`: T003, T012
- `src/specInterpreter.ts`: T002, T004, T005
- `src/primitives/registry.ts`: T006, T013
- `scripts/verify-spec-validator.ts`: T007, T014
- `scripts/verify-determinism.ts`: T008, T010, T015

### Parallel opportunities

- T006 with T007 (different files), after T003.
- T013 with T014.
- T018 with T019.

## Parallel Example: User Story 1

```text
# After T003:
Task: "T006 camera shake in the JSON schema, src/primitives/registry.ts"
Task: "T007 shake validation cases, scripts/verify-spec-validator.ts"
```

## Implementation Strategy

### MVP (User Story 1)

T001–T009: a deterministic shake on every camera move, with no existing frame moved. It can
merge alone.

### Incremental delivery

1. US1 → shake.
2. US2 → depth scaling proven (the code is in T005).
3. US3 → wider range.
4. Polish → reference cases, documents, constitution 2.16.0, pull request.

### Notes

- Every task ends with `npm run verify` passing.
- `npm run golden:update` runs once, in T017, and must report 0 changed existing cases.
