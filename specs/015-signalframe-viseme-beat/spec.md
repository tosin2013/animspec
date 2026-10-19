# Feature Specification: SignalFrame viseme and beat

**Feature Branch**: `feature/015-signalframe-viseme-beat`

**Created**: 2026-10-18

**Status**: Draft

**Input**: Issue #72 — optional per-frame `viseme` and `beat` fields on `SignalFrame`,
carried by the ASFT track, so hosts can deliver real lip-sync (a mouth-shape index) and
beat-sync (an onset strength) instead of amplitude thresholds. A spec-level contract
change, deliberately not a primitive proposal; the maintainer directed it through spec
kit.

## User Scenarios & Testing

### User Story 1 - A host delivers a viseme track and a character lips it (Priority: P1)

Motion Studio aligns a transcript or model to the speaker track and produces a per-frame
viseme index plus an onset strength. It writes those into the ASFT track; a renderer reads
them back per frame and drives a character's mouth through the existing binding mechanism
(`rig.mouthOpen` ← `viseme`), with no primitive changes.

**Why this priority**: the data path is the feature; everything downstream consumes it.

**Independent Test**: write a track with `viseme`/`beat` on some frames, read it back —
those fields round-trip; a track without them reads back with no such fields (identical to
today).

**Acceptance Scenarios**:

1. **Given** a track whose frames carry `viseme`/`beat`, **When** encoded and decoded,
   **Then** every frame's `viseme` and `beat` are bit-identical to the originals, and the
   other fields are unchanged.
2. **Given** a track with no `viseme`/`beat`, **When** encoded, **Then** no chunk is
   written and decoding yields frames identical to today's.
3. **Given** a frame read per-frame with the reader, **When** `n` has a `viseme`, **Then**
   the returned frame carries it — and a frame without one carries neither field.

### User Story 2 - A spec binds the new features (Priority: P1)

A spec drives `rig.mouthOpen` from `viseme` and `emitter.burst` from `beat` through the
spec-013 `bind` map — the new features join `amplitude`/`energy`/`band:<n>`/`osc` as
bindable sources, so primitives stay unchanged.

**Why this priority**: without the binding, the data is inert — the whole point is to
drive primitives from it.

**Independent Test**: render a bound spec at a frame with and without a `viseme` — the
driven param changes as the mapping predicts; a frame without the feature falls back to
the static value.

**Acceptance Scenarios**:

1. **Given** `{ type: "rig", bind: { mouthOpen: { from: "viseme", in: [0, 14], out: [0.15, 1] } } }`,
   **When** rendered at a frame with `viseme: 14` and one without, **Then** the first
   mouth is open (mapped) and the second uses the static value.
2. **Given** `{ type: "emitter", bind: { burst: { from: "beat", in: [0, 1], out: [0, 1] } } }`,
   **When** rendered at a frame with `beat: 0.9`, **Then** the emitter crosses its burst
   threshold; a frame without `beat` uses the static threshold.

### User Story 3 - The conformance file pins the new bytes (Priority: P2)

The committed `golden/signalframe/sample.asft` gains the viseme/beat chunk, so a
foreign-language writer can be tested against the extended layout byte-for-byte, and the
gate fails if the encoder's bytes ever drift.

**Why this priority**: the format's byte-level promise now includes the new chunk.

**Independent Test**: the verify gate re-encodes the sample and fails on any byte or hash
drift, and asserts the new fields round-trip.

**Acceptance Scenarios**:

1. **Given** the committed sample, **When** re-encoded, **Then** the bytes equal the
   committed file and its pinned SHA-256 matches.
2. **Given** the sample decoded, **Then** the frames with `viseme`/`beat` carry exactly
   the pinned values, and the rest carry neither.

### Edge Cases

- **`viseme` outside 0..14**: rejected by the encoder (an out-of-range mouth shape is
  meaningless); the caller clamps or omits.
- **A frame with a `beat` but no `viseme`**: the chunk records `beat` with an
  absent-`viseme` sentinel, and vice versa.
- **An empty track** (`frameCount = 0`): no chunk even if a flag would be set.
- **An old track (no chunk)**: reads back with no `viseme`/`beat` — identical to today.
- **A new track read by an old reader**: rejected as a length mismatch (forward
  compatibility is not promised; old *tracks* stay valid).

## Requirements

### Functional Requirements

- **FR-001**: `SignalFrame` gains two optional fields: `viseme?: number` (a mouth-shape
  index, 0..14) and `beat?: number` (onset strength, 0..1). The library treats `viseme`
  as an opaque index and documents the canonical 15-class set
  (`sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, ou`); it never computes it —
  the host does.
- **FR-002**: The ASFT track gains an optional trailing chunk: the header's reserved u16
  (offset 6) becomes a flags field (bit 0 = chunk present), and the chunk is
  `frameCount × 5` bytes — a `u8` viseme (255 = absent) and a `f32` beat (NaN = absent)
  per frame — after the records. The version stays 1; a track with no viseme/beat writes
  no chunk and is byte-identical to today.
- **FR-003**: `encodeSignalTrack` writes the chunk when any frame carries `viseme`/`beat`,
  rejecting an out-of-range `viseme` or non-finite `beat`. `decodeSignalTrack` and
  `readSignalFrame` read the fields back when the flag is set; `readSignalTrackHeader`
  exposes the flag so callers know the chunk exists.
- **FR-004**: `viseme` and `beat` join the spec-013 binding sources: `from: "viseme"`
  maps the integer index as a numeric feature; `from: "beat"` maps the 0..1 strength. A
  frame without the feature falls back to the static value.
- **FR-005**: The committed conformance fixture gains the chunk (a sample frame with a
  pinned `viseme`/`beat`), its pinned SHA-256 and decoded values are updated, and the
  gate asserts the round-trip and the byte/hash pins.
- **FR-006**: Determinism: the fields are pure data; absent fields ⇒ identical frames;
  no state crosses frames.
- **FR-007**: The verify suite gains coverage: round-trip of `viseme`/`beat`, chunk
  presence/absence, the bound `viseme`/`beat` render, and the updated fixture.
- **FR-008**: The constitution baseline is amended in the same change: the SignalFrame
  contract and the track format gain the fields, the gates table gains the checks, version
  bumped (vocabulary version untouched — a format change).

### Key Entities

- **Viseme**: an integer 0..14 naming one of the documented mouth shapes.
- **Beat**: a 0..1 onset strength for a frame.
- **Extras chunk**: the trailing `frameCount × (u8 + f32)` block, gated by the header
  flags bit.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A track with `viseme`/`beat` round-trips bit-identically on every field.
- **SC-002**: A track without them encodes byte-identically to today (no chunk, no hash
  movement).
- **SC-003**: A bound `rig.mouthOpen` follows `viseme` and an `emitter.burst` follows
  `beat` through the mapping.
- **SC-004**: The committed fixture's bytes, SHA-256 and decoded values match the gate's
  pins; `npm run verify` passes end to end.

## Boundaries

### Outcome

- **For a host**: a documented way to deliver real lip-sync and beat-sync data in the
  track, driving any primitive through bindings.
- **For the project**: the SignalFrame contract and track format gain their first
  optional per-frame semantic fields, with the same byte-level, validate-and-report
  discipline.

### In scope

- The `viseme`/`beat` fields on `SignalFrame`, the ASFT chunk (header flag + layout), the
  codec and reader support, the conformance fixture update, and the `viseme`/`beat`
  binding sources.
- Verify coverage and the constitution amendment.

**Boundary change**: yes — the SignalFrame contract and the on-disk track format gain
optional fields. The baseline's "The format" entry and the Quality Gates table are amended
in the same change that ships it.

### Out of scope

- **Computing visemes or beats**: transcript alignment and onset detection stay with the
  host (and its models). Held by: the caller.
- **Mouth-shape rendering in primitives**: primitives consume `viseme` via bindings, not
  by changing their draws; a viseme → mouth-shape table inside `rig` is a future change.
  Held by: nobody, for now.
- **A typed viseme union**: the index stays an opaque number; the documented set is prose.
- **Forward compatibility** (old readers reading new tracks): not promised.

### External dependencies

- **None.** The chunk is `DataView`/`Float32` math on existing bytes.

### Assumptions

- Hosts produce `viseme` in 0..14 and `beat` in 0..1 and let the validator/encoder reject
  anything else.
- The documented set is Preston Blair/Oculus-style, 15 classes; the library only carries
  the integer.

### Non-negotiable constraints

- **Principle I**: the fields are pure per-frame data; absent ⇒ identical frames; chunk
  reads are byte-identical.
- **Principle II**: the codec is the single source of the chunk layout; no second list.
- **Principle IV**: out-of-range or non-finite values are rejected by the encoder, never
  guessed.
- **Principle VI**: all checks run inside the one offline `npm run verify`.
- **Principle VII**: this spec names the contract change; the baseline is amended in the
  same change that ships it.
