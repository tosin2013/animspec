# Tasks: SignalFrame viseme and beat

- [x] T001 `src/types.ts`: add `viseme?: number` and `beat?: number` to `SignalFrame`.
- [x] T002 `src/signalframe/index.ts`: the header's reserved u16 becomes a flags field (bit 0 = extras chunk); `encodeSignalTrack` writes the trailing `frameCount × (u8 viseme + f32 beat)` chunk when any frame carries them (reject out-of-range `viseme`, non-finite `beat`); `parseHeader`/`SignalTrackHeader` account for the chunk length and expose the flag; `decodeSignalTrack` and `readSignalFrame` read the fields back.
- [x] T003 `src/primitives/registry.ts`: `viseme` and `beat` join the binding `from` grammar and `applyBindings` (numeric features; absent → static fallback).
- [x] T004 `scripts/verify-signalframe.ts`: add a `viseme`/`beat` frame to the sample track, regenerate `golden/signalframe/sample.asft` via `--write-fixture`, re-pin the SHA-256, and assert the round-trip + chunk presence/absence + absent-identical.
- [x] T005 Gates: bind `from: "viseme"`/`from: "beat"` acceptance in `scripts/verify-spec-validator.ts`; a bound `rig.mouthOpen ← viseme` render in `scripts/verify-determinism.ts`.
- [x] T006 Docs: note the fields in `docs/user-guide.md` (SignalFrame section) and the contract.
- [x] T007 Write the spec-kit artifacts: `spec.md`, `research.md`, `plan.md`, `data-model.md`, `contracts/viseme-beat.md`, `quickstart.md`, `tasks.md`, `checklists/requirements.md`.
- [x] T008 Amend `.specify/memory/constitution.md`: format entry gains the fields + chunk; gates table row; amendment; version MINOR.
- [x] T009 Update `specs/ROADMAP.md` with the 015 row.
- [x] T010 Run `npm run verify`: chunk round-trip, bound render, purity scan clean, no golden render hash moved.
