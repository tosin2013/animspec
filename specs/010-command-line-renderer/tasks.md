# Tasks: Command-line renderer

- [x] T001 Create `cli/animspec.ts` (bin entry: `render` subcommand dispatch) and `cli/render.ts` (argument parsing with `util.parseArgs`, file reads, validation, per-frame track reads, `drawSpec` renders, `--raw` stdout bytes, `--png` output, stderr JSON lines, exit codes per spec FR-006). Imports only the public surface and Node built-ins.
- [x] T002 Wire the fixture: a small spec + `.asft` track (+ sidecar) built by `encodeSignalTrack` in the gate, so no binary fixture needs hand-authoring.
- [x] T003 Write `scripts/verify-cli.ts`: spawn `cli/animspec.ts` as a child process on the fixture; assert raw stdout equals the in-process render byte-for-byte; assert a half-range equals the same frames of the full render; assert PNG files decode to the same pixels; assert the drop report for an unknown layer type; assert the manifest fields; assert exit codes 0/2/3/4.
- [x] T004 Add `"verify:cli"` to `package.json` and to the `verify` chain; add `"bin"` and extend `"files"` for the CLI.
- [x] T005 Write the spec-kit artifacts: `spec.md`, `research.md`, `plan.md`, `tasks.md`, `checklists/requirements.md`.
- [x] T006 Amend `.specify/memory/constitution.md`: in-scope list gains the command-line renderer (moving image-frame writing from held-by-the-caller — a named boundary move); Quality Gates table gains the CLI step; amendment paragraph; version MINOR.
- [x] T007 Update `specs/ROADMAP.md`: row 010 becomes this spec (directory `010-command-line-renderer`), and the open-decisions table's renderer row is resolved.
- [x] T008 Run `npm run verify` and confirm every gate passes: the new CLI step, the purity scan untouched, no golden hash moved, package gate green with the new bin/files.
