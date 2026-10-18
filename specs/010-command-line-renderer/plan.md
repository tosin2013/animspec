# Plan: Command-line renderer

## Summary

Ship `animspec render` — one installable command that renders a spec + signal track +
seed to raw RGBA on stdout or a PNG folder, for any half-open frame range, with JSON
reports on stderr and stable exit codes. The command lives in a top-level `cli/` (the
`src/` purity scan is never narrowed), imports only the public surface, and gains one
offline verify step that proves chunk-vs-whole byte equality. Boundary move: image-frame
writing joins this repository's scope, with the baseline amended in the same change.

## Approach

1. **Command** (`cli/animspec.ts`, `cli/render.ts`): argument parsing with Node's
   `util.parseArgs`; spec via `validateAnimSpec`; signal via `readSignalTrackHeader` /
   `indexSignalTrackSidecar` / `readSignalFrame` (per-frame reads, sidecar once); frames
   via `drawSpec` on `@napi-rs/canvas`; PNG via the canvas encoder; JSON lines on stderr;
   exit codes per spec FR-006.
2. **Packaging** (`package.json`): `bin: { animspec: ... }`, `files` gains `cli/`; no new
   dependency, no dependency version change.
3. **Fixture** (`golden/cli/` or `scripts/fixtures/`): a small spec + `.asft` track (built
   by the encoder) the gate renders.
4. **Gate** (`scripts/verify-cli.ts` + one `verify` chain entry): spawns the command as a
   child process; byte-equality with an in-process render; range-vs-whole equality; PNG
   check; drop report; manifest; exit codes.
5. **Governance**: constitution amendment (in-scope gains the command-line renderer —
   a named move of "writing frames to image files" from held-by-the-caller; Quality Gates
   row; version MINOR) and ROADMAP updates in the same change.

## Gates and golden hashes

- **Touched**: `verify` gains one step (`verify:cli`). The purity scan is unchanged and
  still green (the command is outside `src/`). The package gate sees the new `bin`/`files`
  (packaging metadata, no surface change to the library exports).
- **Golden render hashes**: **no movement**. The command renders the same `drawSpec`;
  reference sets, `CHANGES.md` and `golden:update` are untouched. The CLI fixture lives
  beside the gate, not in the golden hash sets.

## Constitution Check (Principle VII)

- **Boundary change**: yes, and named. "Writing frames to image files" moves from
  held-by-the-caller into the in-scope list; the baseline amendment ships in the same
  change (FR-010). The roadmap reserved this spec (010) and anticipated the move.
- **Principles**: I (range equality is the gate's core assertion), III (drawing stays
  pure; the command's I/O is outside `src/`), IV (drops reported on stderr), VI (one
  offline verify, one job; the CLI step is spawned, local, no network), VII (this spec).

## Out of scope

Video muxing (raw stdout is the hand-off), audio decode/FFT, storage and queues,
subcommands beyond `render`.

## Tasks

See `tasks.md`.
