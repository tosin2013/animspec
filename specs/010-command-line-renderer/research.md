# Research: Command-line renderer

## R1. The command lives outside `src/`

`scripts/verify-determinism.ts` statically scans **all of `src/`** for file, network and
process access — the enforcement behind "a primitive draws with what it is handed". A
renderer command must read files and write stdout, so it cannot live under `src/` without
narrowing that scan, which would weaken a gate (forbidden).

**Decision**: a top-level `cli/` directory, shipped through the package manifest
(`bin` + `files`), importing only the public surface (`animspec` exports) and Node
built-ins. The scan is untouched; Principle III's split — drawing pure, caller does I/O —
is preserved with the command as the reference caller.

## R2. stdout is a byte pipe; stderr is the report channel

Motion Studio pipes stdout straight into an encoder it owns. Any header, log line or
trailing newline on stdout corrupts the stream.

**Decision**: `--raw` stdout carries only concatenated RGBA blocks in index order
(maintainer's clarified decision). Progress, drops, errors and the manifest are JSON lines
on stderr. Machine channels stay separate: exit codes carry success/failure class.

## R3. Chunks read per-frame; the sidecar is parsed once

A 90-minute track is ~162k frames (~170 MB decoded). Decoding the whole track to render a
5-minute chunk defeats the per-frame reader added in spec 011.

**Decision**: `readSignalTrackHeader` once, `indexSignalTrackSidecar` once,
`readSignalFrame` per frame in range — the exact Motion Studio pattern, exercised by the
product's own command.

## R4. Exit codes classify failures for a scheduler

A resuming scheduler needs to distinguish "my input is bad" from "the file ended".

**Decision**: 0 success (dropped layers are a report, not a failure — Principle IV says
report, and the remaining layers still render); 2 usage/file errors; 3 corrupt track;
4 range outside the track.

## R5. PNG comes from the pinned canvas; no new dependency

`@napi-rs/canvas` already encodes PNG (the gallery generator uses it). Node's `util.parseArgs`
covers argument parsing.

**Decision**: zero new runtime dependencies; the package manifest gains `bin`/`files`
entries only.

## R6. The gate spawns the real command

Checking the CLI with in-process function calls would test everything except the CLI.

**Decision**: `verify:cli` spawns `animspec render` as a child process on a committed
fixture (spec + small `.asft` track built by the encoder), compares stdout with an
in-process render, checks a range against its enclosing render, and asserts the PNG
output, drop report, manifest and exit codes. Offline, one job, inside `npm run verify`.
