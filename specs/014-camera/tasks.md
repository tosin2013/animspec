# Tasks: Camera moves and layer parallax

- [x] T001 Add the `camera` type and `cameraState(camera, n)` to `src/specInterpreter.ts`: a closed-form eased interpolation of `{ zoom, x, y }` between `from` and `to` (`pan` varies x/y, `zoom` varies zoom, `push`/`parallax` vary both; `static` holds `from`; `linear` or `smooth` ease).
- [x] T002 Wrap each layer's draw (image included) in the camera transform in `drawSpec`: `save → translate(centre) → scale(s) → translate(−lx·W, −ly·H) → draw → restore`; `s`/`(lx,ly)` scaled by the layer's `depth` only under `move: "parallax"`.
- [x] T003 `src/specValidator.ts`: validate `camera` (move/from/to/ease grammar, `zoom > 0`, finite frames, `to` required unless static, `to.frame > from.frame`) and report drops; clamp `depth` 0..1 (non-number → 1) on layers.
- [x] T004 `src/primitives/registry.ts`: `sanitizeLayer` preserves a clamped `depth`; `buildJsonSchema` gains `camera` (spec level) and `depth` (layer level).
- [x] T005 Gates: camera rejection cases in `scripts/verify-spec-validator.ts`; a camera/parallax/chunk section in `scripts/verify-determinism.ts` (push zooms the `to` frame, depth-0 fixed while depth-1 moves, chunk equality, un-camera'd == static).
- [x] T006 Docs: a "Camera" subsection in `docs/user-guide.md`.
- [x] T007 Write the spec-kit artifacts: `spec.md`, `research.md`, `plan.md`, `data-model.md`, `contracts/camera.md`, `quickstart.md`, `tasks.md`, `checklists/requirements.md`.
- [x] T008 Amend `.specify/memory/constitution.md`: format entry gains camera + depth; gates table row; amendment; version MINOR.
- [x] T009 Update `specs/ROADMAP.md` with the 014 row.
- [x] T010 Run `npm run verify`: camera cases green, purity scan clean, no golden hash moved, package gate unchanged.
