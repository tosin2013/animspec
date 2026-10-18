# Feature Specification: SignalFrame Per-Frame Reader and Conformance Fixture

**Feature Branch**: `feature/011-signalframe-reader`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description (issue #54): the SignalFrame track format (spec 008) has one whole-track API, `decodeSignalTrack`, which builds every frame up front — about 85,000 frames (~88 MB) for a 47-minute episode — the cost of reading one frame for a scrubbing or chunk-rendering worker. Add a per-frame reader that works on any byte view, a committed byte-level conformance file a foreign-language writer can be tested against, and a plain statement of the sidecar's unknown-field rule. The on-disk format, version 1 and the precision rule are unchanged.

## User Scenarios & Testing

### User Story 1 - A worker reads one frame without decoding the whole track (Priority: P1)

Motion Studio renders 5-minute contiguous chunks in parallel Node workers, resumes crashed
renders mid-file, and scrubs the preview to arbitrary frames of a ~47-minute episode — about
85,000 frames. Today each such read pays a whole-track decode (every frame built up front) to
obtain one frame. A per-frame reader gives a worker frame *N* directly: read the header once,
then read only the bytes of the frames in its range.

**Why this priority**: random access is the reason the format has a fixed stride; without the
reader, the stride buys nothing and every host pays the whole-file cost.

**Independent Test**: read the header of a track, then frame *N* with the per-frame reader for
every *N*; each result is identical to the frame at position *N* from the whole-track decoder.

**Acceptance Scenarios**:

1. **Given** an encoded track and its header, **When** frame *N* is read, **Then** the result
   equals `decodeSignalTrack(...).frames[N]` on every field — `index = N`, `t = N / fps`,
   `amplitude`, `energy`, every `values` and `spectrum` float, and any `labels`/`coords` from
   the sidecar entry for *N*.
2. **Given** an encoded track, **When** the header is read, **Then** it reports the stored
   `version`, `fps`, `frameCount`, `valuesLen`, `spectrumLen` and the derived `stride`, with no
   decoding of frame bytes.
3. **Given** a track held as a view into a larger buffer (a memory-mapped file), **When** a
   frame is read, **Then** only that frame's `stride` bytes are consulted and the result is
   unaffected by the view's offset in the larger buffer.

### User Story 2 - A writer in another language conforms against committed bytes (Priority: P1)

The Motion Studio writer is Rust. The TypeScript round-trip test proves the codec agrees with
itself, but no committed byte sequence exists for a foreign writer to be tested against — a
header mix-up or a float-width mistake produces a file the reference reader rejects, or worse,
accepts silently.

**Why this priority**: cross-language conformance is the format's second promise; without a
pinned file, "byte-level" is untested outside the one implementation.

**Independent Test**: the verify gate re-encodes the fixed sample track and fails unless the
bytes equal the committed file and the file's SHA-256 equals a pinned value; it also decodes
the committed file and asserts its expected header fields and per-frame values.

**Acceptance Scenarios**:

1. **Given** the committed `sample.asft`, **When** the sample track is encoded again, **Then**
   the bytes are identical and the pinned SHA-256 matches; any drift fails `npm run verify`.
2. **Given** the committed sample track, **When** it is decoded (whole-track and per-frame),
   **Then** the header fields and each frame's floats and `labels`/`coords` equal the values
   pinned in the gate.

### User Story 3 - A reader implementer knows exactly what an unknown sidecar field means (Priority: P2)

The contract currently says "A reader ignores no fields; unknown fields on a line are rejected
in a future version", which reads both ways, and a later section implies old readers never see
newly added fields. A Rust implementer cannot tell whether to fail on an unrecognised key.

**Why this priority**: it is a wording defect, but it sits on a compatibility promise, and the
per-frame reader adds a second implementation that must match.

**Independent Test**: the contract states one plain rule; the codec's behaviour and a gate
assertion agree with it.

**Acceptance Scenarios**:

1. **Given** a sidecar line carrying an unrecognised field, **When** a v1 reader processes it,
   **Then** the line is accepted and the unknown field is ignored — matching the stated rule.
2. **Given** a sidecar line whose recognised field has the wrong shape, **When** a v1 reader
   processes it, **Then** it throws — the rule names which rejections still apply.

### Edge Cases

- **`n` negative or `>= frameCount`**: the per-frame reader throws; it never returns a guessed frame.
- **Truncated file**: a header read on fewer than 32 bytes, or a length that is not exactly
  `32 + frameCount * stride`, throws — the same rejections as the whole-track decoder.
- **Empty track** (`frameCount = 0`): the header reads fine; any per-frame read throws.
- **A view with a non-zero offset**: the reader honours the view's `byteOffset`/`byteLength`,
  never the start of the underlying buffer.
- **Sidecar without an entry for `n`**: the frame decodes without `labels`/`coords`, exactly as
  the whole-track decoder does for sparse sidecars.
- **Unknown field vs wrong shape**: an unrecognised field on a line is ignored by a v1 reader;
  a recognised field (`labels`, `coords`, `index`) with the wrong shape throws.

## Requirements

### Functional Requirements

**Per-frame reader**

- **FR-001**: The library MUST export `readSignalTrackHeader(bytes)` returning the stored
  `version`, `fps`, `frameCount`, `valuesLen`, `spectrumLen` and the derived `stride`, applying
  the decoder's header-stage validation: fewer than 32 bytes, bad magic, a version other than 1,
  an invalid `fps`, an unsafe `frameCount`, or a length that is not exactly
  `32 + frameCount * stride` MUST throw.
- **FR-002**: The library MUST export `readSignalFrame(bytes, header, n, sidecar?)` returning
  one `SignalFrame` — `index = n`, `t = n / fps`, the record's `amplitude`, `energy`, `values`
  and `spectrum`, plus `labels`/`coords` from the sidecar entry for `n` under the decoder's
  validation. It MUST read only the record at byte offset `32 + n * stride … + stride`, and
  MUST throw when `n` is outside `[0, frameCount)`.
- **FR-003**: The library MUST export a sidecar index helper that parses the NDJSON sidecar
  once into a per-frame lookup, so a worker applies `labels`/`coords` to many frames without
  re-parsing; its validation MUST be the decoder's, byte for byte.
- **FR-004**: The readers MUST operate on any `Uint8Array` view — honouring `byteOffset` and
  `byteLength`, so a view into a memory-mapped file works — and MUST NOT copy the whole track.
  `src/` MUST gain no file or network access (the library still sees bytes only).
- **FR-005**: The whole-track codec's behaviour, the on-disk layout, `version` 1 and the
  precision rule MUST be unchanged by this feature.

**Conformance fixture**

- **FR-006**: A small sample track — 4 frames, `valuesLen = spectrumLen = 4`, varied levels,
  at least one frame with `labels` and `coords` (so a sidecar exists) — MUST be committed as
  `golden/signalframe/sample.asft` and `golden/signalframe/sample.asft.ndjson`. The bytes MUST
  be produced by the encoder itself and committed once; they are never hand-written.
- **FR-007**: The verify gate MUST re-encode the sample track and fail unless the bytes equal
  the committed file and the committed file's SHA-256 equals a pinned value; it MUST also
  decode the committed file — whole-track and per-frame — and assert the pinned header fields
  and per-frame values.

**Contract wording**

- **FR-008**: The contract's sidecar section MUST state the v1 rule in one plain sentence —
  a v1 reader ignores unknown sidecar fields (the rule the codec implements today), while a
  recognised field with the wrong shape is still rejected — and the "Extending the format"
  section MUST say how a later version may tighten the rule (a validation tightening changes
  what a reader accepts, so it bumps `version`). The wording MUST match the codec's behaviour,
  and the gate MUST assert that behaviour both ways (unknown field accepted, wrong shape thrown).

**Governance**

- **FR-009**: The constitution baseline MUST be amended in the same change that ships this
  feature: "The format" gains the per-frame reader and the committed conformance fixture, the
  Quality Gates table gains the committed-file check, version bumped.
- **FR-010**: The new functions MUST join the public surface (`src/index.ts`), and the package
  gate MUST stay green.

### Key Entities

- **Track header**: the fixed 32-byte preamble; the reader exposes its stored fields plus the
  derived `stride` — everything a caller needs to locate any frame.
- **Frame index (`n`)**: a frame's position in `[0, frameCount)`; the only key needed for
  random access, since records are fixed-stride.
- **Sidecar index**: the parsed per-frame `labels`/`coords` lookup, built once and shared by
  the frames a worker renders.
- **Conformance fixture**: the committed sample track plus its pinned SHA-256 and pinned
  decoded values — the byte-level target for every writer, in any language.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For the committed sample track and a synthetic multi-frame track,
  `readSignalFrame` output equals the whole-track decode for 100% of frames, on every field.
- **SC-002**: A single frame read's cost does not grow with the track's frame count — the
  reader never scans or allocates other frames' bytes.
- **SC-003**: Any drift between the committed fixture and the encoder's output — or a tampered
  hash or decoded value — fails `npm run verify`.
- **SC-004**: The contract states the sidecar unknown-field rule in one sentence that matches
  the codec's behaviour, and the gate covers that behaviour in both directions.
- **SC-005**: `npm run verify` passes end to end: purity scan clean, no golden render hash
  moved, no new dependency, no new CI job.

## Boundaries

### Outcome

- **For a caller**: random access to any frame of a track without paying the whole-track
  decode, from any byte view including a memory-mapped file; and committed bytes their
  foreign-language writer can be tested against byte for byte.
- **For the project**: the fixed-stride format becomes cheap to consume at episode scale, and
  the format's byte-level promise is pinned by a committed fixture the gate enforces.

### In scope

- The per-frame reader API on the public surface: `readSignalTrackHeader`,
  `readSignalFrame`, and a sidecar index helper, with the decoder's validation.
- The committed conformance fixture (`golden/signalframe/sample.asft` + sidecar), its pinned
  SHA-256 and pinned decoded values, and the verify-gate checks that enforce them.
- The contract's sidecar wording fix and the versioning sentence that follows from it.
- The constitution baseline amendment this feature requires.

**Boundary change**: a random-access reader is a new kind of public export (the public surface
is what `src/index.ts` exports) and a new promise to callers — that one frame can be read from
a view without decoding the track. The baseline's "The format" entry names only the whole-track
codec today, so the in-scope list and the Quality Gates table are amended in the same change
that ships it.

### Out of scope

- **File I/O and memory-mapping**: opening files, mapping them, choosing buffer sizes. Held
  by: the caller — the library still sees bytes only.
- **Producing `SignalFrame`s from audio/data/text**: decoding audio, computing FFT. Held by:
  the caller (unchanged from the 008 baseline).
- **Format, layout, version or precision changes**: none — the bytes on disk are untouched.
  Held by: nobody, for now.
- **A command-line track inspector**: a possible later spec; this feature ships library API
  and gate checks only.

### External dependencies

- **None.** The reader uses `DataView` and `JSON` on the caller's bytes; no new runtime or
  build-time dependency.

### Assumptions

- Fixed-stride records make byte-offset random access exact; a caller holds the whole file's
  bytes (or a mapping of them) in one `Uint8Array` view.
- Frame counts, `valuesLen` and `spectrumLen` stay within safe-integer range (true for
  Motion Studio's ~85,000 × 256 × 256).
- The sidecar is small enough to parse whole (it is sparse NDJSON); a worker parses it once
  per file, not once per frame.

### Non-negotiable constraints

- **Principle I (determinism)**: a frame read per-frame is bit-identical to the same frame
  read whole-track; floats stay float64; nothing is quantised.
- **Principle III (purity)**: no file or network access in `src/` — the reader is byte-level;
  the caller does I/O and mapping.
- **Principle VI (one verify command)**: the fixture and per-frame checks run inside the one
  offline `npm run verify`; no new CI job, no new dependency.
- **Principle VII (explicit boundaries)**: this spec names the boundary change; the baseline
  is amended in the same change that ships it.
- **Provenance/naming**: the fixture is generated bytes from this repository's own encoder,
  never copied data; the `.asft` naming stays neutral.
