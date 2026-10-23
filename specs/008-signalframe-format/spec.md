# Feature Specification: SignalFrame Track Format

**Feature Branch**: `008-signalframe-format`

**Created**: 2026-10-17

**Status**: Shipped in 0.2.0

**Input**: User description: "SignalFrame file format defines the file format for the audio signal data." The constitution puts the `AnimSpec` and `SignalFrame` contracts in scope, and "turning audio, data, or text into `SignalFrame`s" with the caller. What is missing is a serialised form of a whole `SignalFrame` sequence that any caller can write and any renderer can read, so the same file feeds the library, the 008 CLI, Motion Studio's parallel chunk workers, and golden-test fixtures.

## User Scenarios & Testing

### User Story 1 - A caller writes a track once, a renderer reads it identically (Priority: P1)

Motion Studio decodes audio and computes FFT bands itself (in Rust) for a ~47-minute episode —
about 85,000 frames at 30 fps. It writes that once and renders chunks in parallel workers, resumes
crashed renders, and scrubs to arbitrary frames. A documented format means the same file feeds every
renderer, and a golden test has a fixture format.

**Why this priority**: this is the whole point. Without it, each consumer reinvents a private format and
the "same frames everywhere" promise cannot be shared.

**Independent Test**: write a track with the library, read it back, and render both — the decoded track
renders byte-identically to the original `SignalFrame`s.

**Acceptance Scenarios**:

1. **Given** an in-memory `SignalTrack`, **When** it is encoded and decoded, **Then** every field — `fps`, each frame's `values`, `spectrum`, `amplitude`, `energy`, `labels` and `coords` — is bit-identical.
2. **Given** the original frames and the decoded frames, **When** each is drawn through `drawSpec` with the same spec and seed, **Then** the two renders hash identically.
3. **Given** a track with no `labels`/`coords`, **When** it is encoded, **Then** the sidecar is `null` and only the main file is written.

### User Story 2 - `index` and `t` cannot disagree (Priority: P1)

The in-memory `SignalFrame` carries both `index` and `t`, and primitives read both. A stored `t` that
disagrees with `index / fps` would make a round-tripped track render differently from the original.

**Why this priority**: determinism. The format must have one source for each derived value.

**Independent Test**: decode a track and confirm every frame's `index` equals its position and its `t`
equals `index / fps` exactly.

**Acceptance Scenarios**:

1. **Given** a track, **When** decoded, **Then** `index = N` and `t = N / fps` for every frame, with no stored value that could disagree.

### User Story 3 - A corrupt or future file fails loudly (Priority: P2)

A track is untrusted input. A reader that guesses produces wrong-but-plausible frames.

**Why this priority**: a wrong frame that looks right is worse than a clear error.

**Independent Test**: feed a reader bad magic, an unknown version, truncated data, a length mismatch, and
an out-of-range sidecar index — each throws.

**Acceptance Scenarios**:

1. **Given** a file whose magic or length is wrong, **When** decoded, **Then** it throws and renders nothing.
2. **Given** a file with a future `version`, **When** decoded, **Then** it throws rather than guessing.

### Edge Cases

- **An empty track** (`frameCount = 0`): `valuesLen` and `spectrumLen` are 0; decode returns zero frames.
- **`labels`/`coords` on only some frames**: the sidecar is sparse; frames without an entry decode to no `labels`/`coords`.
- **A `coords` value far outside 0..1** (e.g. raw latitude/longitude): stored verbatim; the format does not clamp.
- **A frame count near 2^53**: the reader requires a safe integer; anything larger is rejected.

## Requirements

### Functional Requirements

**Format**

- **FR-001**: The format MUST store a header with magic `ASFT`, a version, `fps`, `frameCount`, `valuesLen` and `spectrumLen`, all little-endian, as specified in `contracts/signalframe-format.md`.
- **FR-002**: Every per-frame record MUST store `amplitude`, `energy`, `values[]` and `spectrum[]` as little-endian **float64**, matching the in-memory `Float64Array` fields, at a fixed stride.
- **FR-003**: `index` and `t` MUST be derived (`index = N`, `t = N / fps`) and MUST NOT be stored.
- **FR-004**: Variable-length fields (`labels`, `coords`) MUST go in a sparse NDJSON sidecar keyed by `index`, present only when a frame has them.
- **FR-005**: The `values` and `spectrum` length MUST be fixed across the whole track.

**Codec**

- **FR-006**: The library MUST export `encodeSignalTrack` and `decodeSignalTrack` that operate on bytes (`Uint8Array` and a sidecar string), with file I/O left to the caller, so `src/` stays free of file/network imports.
- **FR-007**: `decodeSignalTrack` MUST reject a bad magic, an unsupported version, an invalid `fps`, an unsafe frame count, a length mismatch, and a malformed sidecar.
- **FR-008**: The codec MUST be deterministic and must use no `Math.random`, `Date`, `performance.now`, file or network access.

**Verification**

- **FR-009**: A round-trip test MUST prove bit-identical fields and byte-identical renders, and MUST exercise the corrupt-input rejections. It runs inside `npm run verify`.

**Governance**

- **FR-010**: The constitution baseline MUST be amended in the same change that ships this feature: the track format and its codec join the public surface and in-scope list, the round-trip test joins the Quality Gates table, version bumped.

### Key Entities

- **SignalTrack**: one `fps` plus its frames in index order — the in-memory whole-track type.
- **EncodedSignalTrack**: the serialised form — the main binary `data` plus an optional `sidecar` string.
- **Header**: the fixed 32-byte preamble carrying the format version and the track-wide fields.
- **Per-frame record**: one fixed-stride record carrying a single frame's floats.
- **Sidecar**: the optional NDJSON file carrying `labels`/`coords` for the frames that have them.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A synthetic track (12 frames, varied signal, some `labels`/`coords`) round-trips bit-identically on every field.
- **SC-002**: Rendering original vs decoded frames with the same spec and seed produces identical hashes for 100% of frames.
- **SC-003**: Every corrupt-input case (bad magic, unknown version, truncated header/body, trailing bytes, out-of-range sidecar index, malformed sidecar) throws.
- **SC-004**: The determinism gate's purity scan still reports no file/network imports in `src/`, and `npm run verify` passes end to end.
- **SC-005**: The format is documented in a contract that a Rust caller (Motion Studio) can implement from.

## Boundaries

### Outcome

- **For a caller**: one documented file they write and a renderer reads, producing frames identical to passing the same `SignalFrame`s in memory.
- **For the project**: a shared, versioned, deterministic fixture format that the 008 CLI, Motion Studio and golden tests all consume.

### In scope

- The format document (`contracts/signalframe-format.md`): header, record, sidecar, precision and validation rules.
- The byte-level codec exported from the public surface: `encodeSignalTrack`, `decodeSignalTrack`, the format constants, and the `SignalTrack` / `EncodedSignalTrack` types.
- A round-trip test wired into `npm run verify`.
- The constitution baseline amendment this feature requires.

**Boundary change**: exporting a codec is a new kind of public export (the public surface is what `src/index.ts` exports). The baseline's in-scope list and the Quality Gates table are amended in the same change.

### Out of scope

- **Producing `SignalFrame`s from audio/data/text**: decoding audio, computing FFT, and every other signal source. Held by: the caller (Motion Studio, the 008 CLI's input stage).
- **File I/O**: reading/writing bytes on disk is the caller's one-liner around the codec, not the library's job. Held by: the caller.
- **Compression**: the format is uncompressed and deterministic. Held by: nobody, for now.
- **Audio/video containers and encoders**: out of scope entirely.
- **The 008 command-line renderer itself**: a later spec that consumes this format.

### External dependencies

- **None.** The codec uses `DataView` and `JSON`; no new runtime dependency.

### Assumptions

- `values` and `spectrum` have a fixed length per track (FR-005).
- Callers set `t = index / fps` in memory with the same `fps` they write, so the derived `t` is bit-identical on a round-trip.
- Tracks are small enough that `frameCount`, `valuesLen` and `spectrumLen` are safe integers (true for Motion Studio's ~85,000 × ~256 × ~256).

### Non-negotiable constraints

- **Principle I (determinism)**: float64 on disk equals the float64 drawn with; the codec is deterministic and pure.
- **Principle III (purity)**: no file or network access in `src/` — the codec is byte-level and the caller does I/O.
- **Principle VI (one verify command)**: the round-trip test runs inside `npm run verify`, offline, no new CI job.
- **Naming**: the magic tag and extension are neutral (`ASFT` / `.asft`), borrowing no private-product or artist name.
