# Tasks: Per-layer signal bindings

- [x] T001 Add `sanitizeBind(def, raw)` to `src/primitives/registry.ts`: validate a raw bind map against the primitive's declared numeric params and the from/mapping grammar (amplitude/energy/`band:<n>`/osc; in/out two finite numbers with positive-width `in`; curve linear|smooth; wave pulse|sine; period > 0; duty 0..1) — return `{ bind }` or `{ error }`.
- [x] T002 `sanitizeLayer`: validate and preserve a well-formed `l.bind` via `sanitizeBind`; drop a malformed one (the layer keeps its static params).
- [x] T003 Add `applyBindings(layer, def, frame, seed, layerIndex)` to `src/primitives/registry.ts`: per-frame shallow view with driven values — feature from the current SignalFrame (`band:<n>` past the bands → static fallback), normalise `in`, smoothstep for `curve: "smooth"`, map `out`, clamp to registry bounds; osc pulse/sine with a phase seeded from (seed, layerIndex, paramName).
- [x] T004 `src/specInterpreter.ts`: call `applyBindings` per layer in `drawSpec` before `def.draw` — no mutation of the sanitized spec.
- [x] T005 `src/specValidator.ts`: report dropped binds as errors (via `sanitizeBind`), same voice as today's reports; layers never dropped over binds.
- [x] T006 `buildJsonSchema`: layer items gain the `bind` shape (generic object form; per-key numeric-param enforcement stays in the validator).
- [x] T007 Gates: bind rejection + preservation cases in `scripts/verify-spec-validator.ts`; a bound-render section in `scripts/verify-determinism.ts` (bound `rig` differs quiet vs loud exactly as mapped; chunk-vs-whole byte equality with binds; a malformed bind renders with static params).
- [x] T008 Docs: the bind contract summarized in `docs/user-guide.md` (spec-format section) and a link from `VOCABULARY.md`'s header note if present.
- [x] T009 Write the spec-kit artifacts: `spec.md`, `research.md`, `plan.md`, `data-model.md`, `contracts/bind-shape.md`, `quickstart.md`, `tasks.md`, `checklists/requirements.md`.
- [x] T010 Amend `.specify/memory/constitution.md`: the format entry gains per-layer signal bindings; the gates table gains the bind checks; amendment paragraph; version MINOR (vocabulary version untouched).
- [x] T011 Update `specs/ROADMAP.md` with the new spec row.
- [x] T012 Run `npm run verify` and confirm: validator bind cases, determinism with binds, purity scan green, no golden hash moved, package gate unchanged.
