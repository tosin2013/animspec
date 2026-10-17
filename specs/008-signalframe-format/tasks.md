# Tasks: SignalFrame Track Format

- [x] T001 Write `contracts/signalframe-format.md`: header, record, sidecar, precision, validation and extension rules.
- [x] T002 Implement `src/signalframe/index.ts`: `encodeSignalTrack`, `decodeSignalTrack`, format constants, and the `SignalTrack` / `EncodedSignalTrack` types, using `DataView` + `JSON` (no I/O, no dependency, no ambient randomness).
- [x] T003 Export the codec and types from `src/index.ts`.
- [x] T004 Write `scripts/verify-signalframe.ts`: bit-identical round-trip, byte-identical render, and corrupt-input rejections.
- [x] T005 Add `verify:signalframe` to `package.json` and to the `verify` chain.
- [x] T006 Write the spec-kit artifacts: `spec.md`, `data-model.md`, `research.md`, `quickstart.md`, `plan.md`, `tasks.md`, `checklists/requirements.md`.
- [x] T007 Amend `.specify/memory/constitution.md`: in-scope list gains the track format and codec; Quality Gates table gains the round-trip test; version bumped (boundary change).
- [x] T008 Update `specs/ROADMAP.md`: add the new spec as a prerequisite of the command-line renderer.
- [x] T009 Run `npm run verify` and confirm it passes end to end, including the new gate.
