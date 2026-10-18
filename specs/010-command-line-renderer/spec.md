# Feature Specification: Command-line renderer

**Feature Branch**: `feature/010-command-line-renderer`

**Created**: 2026-10-18

**Status**: Draft

**Input**: Issue #30 ("Spec 008: command-line renderer with frame ranges and raw-frame
output"), which carries a draft of the six boundary entries and names Motion Studio as the
downstream consumer. The ROADMAP reserves spec number 010 for this feature, and its open
decision ("whether the command-line renderer ships in v1") is settled by the maintainer
directing this work. The feature number in the directory is the reserved 010.

## User Scenarios & Testing

### User Story 1 - A worker renders its chunk and the bytes match the whole (Priority: P1)

Motion Studio renders a 90-minute spec as 5-minute chunks in parallel processes, resuming
after crashes. One command renders any half-open frame range `[start, end)`: the bytes of
frames 9000–17999 are identical to those frames inside a 0–26999 render — the purity the
frame-order gates already guarantee, now delivered end to end. Frames go to stdout as raw
RGBA (piped into the caller's encoder) or to a PNG folder.

**Why this priority**: chunked range rendering is the reason hosts want the command.

**Independent Test**: render a range and the enclosing full render; the range's frames are
byte-identical to the same frames of the whole.

**Acceptance Scenarios**:

1. **Given** a spec, a signal track and a seed, **When** `[start, end)` is rendered with
   `--raw`, **Then** stdout carries exactly `(end − start)` frames of `width × height × 4`
   RGBA bytes in index order and nothing else.
2. **Given** the same inputs rendered as `[0, N)` and as two half-ranges, **Then** the
   concatenation of the halves is byte-identical to the whole.
3. **Given** `--png <dir>`, **When** the range renders, **Then** the folder holds one PNG
   per frame named by its absolute index (`000900.png`), decodable to the same pixels.

### User Story 2 - A host can schedule, resume and record renders (Priority: P1)

A host needs machine-readable truth about what happened: a per-frame progress line and a
final manifest (package version, `VOCABULARY_VERSION`, canvas version, processor type,
range) on stderr as JSON; dropped layers reported per Principle IV; stable exit codes so a
scheduler can tell a crash from a bad input.

**Why this priority**: parallel scheduling and resume are Motion Studio's operating mode.

**Independent Test**: run the command on a spec with an unknown layer type — stderr
carries a `dropped` report, stdout still carries the remaining layers' frames, exit is 0;
run it with a corrupt track — exit is non-zero with an error line.

**Acceptance Scenarios**:

1. **Given** a spec with an unknown layer type, **When** rendered, **Then** stderr carries
   a JSON line naming the dropped type, the remaining layers render, and the exit code is 0.
2. **Given** any successful render, **When** it finishes, **Then** stderr ends with a JSON
   manifest carrying the package version, `VOCABULARY_VERSION`, the canvas version, the
   processor type and the rendered range.
3. **Given** a missing file, a malformed spec or a corrupt track, **When** rendered, **Then**
   the process exits non-zero with a JSON error line on stderr and no stdout bytes.

### User Story 3 - One offline gate keeps the command honest (Priority: P2)

`npm run verify` gains one step that exercises the command: it renders a fixture spec and
track, compares stdout bytes with an in-process `drawSpec` render, checks the PNG output,
the drop report and the manifest, and checks that a range matches its enclosing render.

**Why this priority**: Principle VI — the command must be checked by the same offline bar
as everything else, or its promises are prose.

**Independent Test**: `npm run verify` passes with the new step; breaking the command's
byte equality fails the suite.

**Acceptance Scenarios**:

1. **Given** the fixture spec and track, **When** the gate runs, **Then** CLI bytes equal
   the in-process render, the manifest versions are correct, and a rendered range equals
   the same frames of the full render.

### Edge Cases

- **Empty range** (`start = end`): zero frames, exit 0, manifest still printed.
- **Range outside the track** (`end > frameCount`): error, exit 4, no stdout bytes.
- **Track shorter than the spec needs** or a frame index missing from the track: the track
  is the signal source of record; frames beyond it are an error (exit 4).
- **No sidecar file**: frames decode without `labels`/`coords`.
- **Spec with zero layers**: valid, renders `background`-coloured frames.
- **`--raw` and `--png` together, or neither**: a usage error (exit 2).

## Requirements

### Functional Requirements

- **FR-001**: The package ships an `animspec` bin with a `render` subcommand:
  `animspec render <spec.json> --signal <track.asft> [--seed <n>] [--start <n>] [--end <n>]
  [--width <n>] [--height <n>] (--raw | --png <dir>)`. Defaults: seed 0, `start` 0,
  `end` = track frame count, 1920×1080. Exactly one output mode is required.
- **FR-002**: In `--raw` mode stdout carries **only** concatenated RGBA bytes — one
  `width × height × 4` block per frame, in index order (maintainer's clarified decision).
  Every message, report and the manifest go to stderr as JSON lines.
- **FR-003**: In `--png` mode the command writes one PNG per frame, named by absolute
  frame index as six digits (`000000.png`), creating the directory when needed, using the
  canvas library's PNG encoder. No new dependency.
- **FR-004**: The spec is read through `validateAnimSpec` and the signal through the
  track format's reader: header once, each frame in range via the per-frame reader, and
  the sidecar parsed once — so a chunk render never decodes the whole track. The sidecar
  is `<track>.ndjson` when present.
- **FR-005**: stderr JSON lines: `{"dropped": [...]}` when the validator drops anything
  (Principle IV); `{"frame": n}` per rendered frame; and a final `manifest` line with the
  package version, `VOCABULARY_VERSION`, canvas version, processor type, dimensions,
  range, seed and frame count.
- **FR-006**: Exit codes: 0 success (including renders with dropped layers, which are
  reported, not fatal); 2 usage or file errors; 3 corrupt signal track; 4 range outside
  the track. Never a silent non-zero.
- **FR-007**: The command lives **outside `src/`** (a top-level `cli/`), imports only the
  public surface plus Node built-ins, and ships through the package manifest (`bin`,
  `files`). The `src/` purity scan is unchanged — drawing stays pure; the command does the
  I/O, exactly as the constitution splits it.
- **FR-008**: Frames are drawn by `drawSpec` with the seeded, deterministic options and
  the canvas software rasteriser; a range's frames are byte-identical to the same frames
  of any larger render.
- **FR-009**: `npm run verify` gains one step (`verify:cli`) that renders a fixture spec +
  track through the command (spawned as a child process) and checks byte equality with an
  in-process render, range-vs-whole equality, PNG output, the drop report, the manifest
  and the exit codes. It runs offline in the same job.
- **FR-010**: The constitution baseline is amended in the same change that ships this
  feature: the command-line renderer joins the in-scope list (moving "writing frames to
  image files" from held-by-the-caller — a named boundary move), the Quality Gates table
  gains the CLI step, version bumped.

### Key Entities

- **Render request**: spec file + signal track + seed + range + dimensions + output mode.
- **Frame bytes**: one frame's raw RGBA block; the unit of chunk equality.
- **Manifest**: the final stderr JSON record that makes a render reproducible and
  auditable (versions, range, seed, count).
- **Drop report**: the validator's dropped-layer report on stderr, never silent.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A rendered range is byte-identical to the same frames of the enclosing full
  render — proven by the new gate on every run.
- **SC-002**: `--raw` stdout is exactly the frame bytes: no header, no footer, no logs.
- **SC-003**: PNG output decodes to the same pixels as the raw bytes for the same frames.
- **SC-004**: Dropped layers, progress and the manifest appear on stderr as JSON; exit
  codes follow FR-006 in every failure case in the gate.
- **SC-005**: `npm run verify` passes end to end, offline, in one job; the purity scan is
  untouched and green; no new runtime dependency.

## Boundaries

### Outcome

- **For a caller**: one installable command that renders any frame range of a spec +
  signal track to raw RGBA or PNG, with machine-readable reports and stable exit codes —
  identical to what `npm run verify` checks.
- **For the project**: the canonical frame loop lives next to the golden hashes, so every
  host renders what the gates verify.

### In scope

- The `animspec render` command: argument handling, frame ranges, raw stdout, PNG output,
  validation drop report, progress and manifest lines, exit codes.
- Packaging the command (`bin`/`files`) and the new `verify:cli` gate step.
- The constitution baseline amendment this feature requires.

**Boundary change**: yes, and it is the point of the feature. "Writing frames to image or
video files" is held by the caller today; this moves image-frame writing into this
repository's scope through the door Principle VII provides: named here, recorded in the
plan's Constitution Check, and the baseline amended in the same change that ships it. The
roadmap's publishable-package note anticipated exactly this move.

### Out of scope

- **Video muxing/encoding**: raw stdout is the encoder hand-off; the caller owns codecs.
  Held by: the caller (unchanged).
- **Audio decoding and signal generation**: the track file is the input; making tracks
  from audio stays with the caller. Held by: the caller (constitution baseline).
- **A long-running service, queue or storage**: one process, one range, one exit.
  Held by: the caller.
- **Anything beyond `render`** (validate, signal-tooling subcommands): later work if asked
  for; the subcommand shape leaves room without promising it.

### External dependencies

- **None new.** PNG encoding comes from the pinned `@napi-rs/canvas`; argument parsing
  and process machinery from Node built-ins (≥ 22). `package.json` gains no dependency.

### Assumptions

- Hosts own the encoder and the scheduling; the command is a pure batch step per range.
- Node ≥ 22 on arm64 or x64, as the package's engines already state.
- The signal track's `fps` and the spec are consistent; the command derives `t` from the
  track exactly as the codec does.
- Per-frame JSON progress on stderr is acceptable volume for hosts (they parse machine
  lines; stdout stays byte-clean regardless).

### Non-negotiable constraints

- **Principle I**: a frame from the command is byte-identical to the same frame from any
  other render of the same inputs — the gate proves it every run.
- **Principle III**: `src/` stays pure — the command's I/O lives outside `src/`, and the
  scan is not narrowed.
- **Principle IV**: dropped layers are reported on stderr, never silently discarded.
- **Principle VI**: one offline `npm run verify`, one CI job; the CLI step runs in it.
- **Principle VII**: this spec names the boundary move; the baseline is amended in the
  same change that ships it.
- **Naming**: the bin takes the neutral package name `animspec`; nothing borrows the
  private product's name.
