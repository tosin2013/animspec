# Feature Specification: Caption Params

**Feature Branch**: `009-caption-params`

**Created**: 2026-10-17

**Status**: Implemented

**Input**: User description: "caption: optional params for letter case, box style and position (defaults keep today's frames)." Long-form podcast videos want sentence case and a lighter treatment over audio-reactive visuals, instead of today's uppercase text on a solid box.

## User Scenarios & Testing

### User Story 1 - Authors choose caption case, box and position (Priority: P1)

An author writing a spec can set sentence case, drop or outline the box, and move the caption,
while the default (`case: upper`, `box: solid`, `position: bottom`, `maxLines: 3`) reproduces
today's frames byte-for-byte.

**Why this priority**: this is the whole point — burned-in captions that read well over
`radial`/`rings` layers.

**Independent Test**: render `caption` with the default layer and with each non-default param,
and confirm the default is byte-identical to the pre-change caption and the others differ.

**Acceptance Scenarios**:

1. **Given** a caption layer with no params, **When** rendered, **Then** the frame is byte-identical to the pre-change caption.
2. **Given** `case: "asis"`, **When** rendered, **Then** the label is shown as-is (not upper-cased).
3. **Given** `box: "none"` or `"outline"`, **When** rendered, **Then** the box is dropped or outlined, and the text is still legible.

### User Story 2 - The caption stays palette-pure (Priority: P1)

All four params colour only with `palette.bg`/`palette.fg` — no free colour, no accent — so
the caption stays legible in pure black and white and passes the palette gate.

**Why this priority**: Principle III.

**Independent Test**: the palette gate exercises every enum value on both backgrounds and passes.

**Acceptance Scenarios**:

1. **Given** any combination of the four params, **When** rendered on black and on white backgrounds, **Then** every pixel is `bg`/`fg`.

### User Story 3 - The vocabulary version records the change (Priority: P2)

Adding params is a vocabulary change; the version rises and is recorded, so saved specs carry
the right version.

**Why this priority**: spec 003 — the vocabulary version is how saved specs stay reproducible.

**Independent Test**: `npm run verify` passes, including `verify-registry` (version + record) and `site:check`.

**Acceptance Scenarios**:

1. **Given** the registry change, **When** `npm run vocab:record` runs, **Then** `VOCABULARY_VERSION` rises and `VOCABULARY.md` / `docs/vocabulary.md` are regenerated.

## Requirements

### Functional Requirements

- **FR-001**: `caption` MUST gain four optional params — `case` (enum `upper`/`asis`, default `upper`), `box` (enum `solid`/`none`/`outline`, default `solid`), `position` (enum `bottom`/`top`/`center`, default `bottom`), `maxLines` (number 1–3, default 3).
- **FR-002**: The default layer (`case: upper`, `box: solid`, `position: bottom`, `maxLines: 3`) MUST render byte-identically to the pre-change caption, so no golden hash moves.
- **FR-003**: `caption.draw` MUST colour only with `palette.bg` and `palette.fg` (the literal `"black"`/`"white"` fills become `palette.bg`/`palette.fg`).
- **FR-004**: `VOCABULARY_VERSION` MUST rise (3 → 4) and be recorded with `vocab:record`.
- **FR-005**: The generated outputs (`VOCABULARY.md`, `docs/vocabulary.md`, `docs/gallery.md`) MUST be regenerated.

### Key Entities

- **caption** — the core `text` primitive; the active label (from `SignalFrame.labels[0]` or the caller's caption) drives it.
- **box style** — `solid` (filled `bg` box), `none` (no box), `outline` (unfilled `fg` border).

## Success Criteria

### Measurable Outcomes

- **SC-001**: `npm run verify` passes with `VOCABULARY_VERSION` 4 recorded and all 31 primitives passing every gate (probes grow from 177 to 184).
- **SC-002**: The default caption layer's golden hash is unchanged (no `golden/CHANGES.md` entry needed).
- **SC-003**: Every new enum value passes the palette, reactivity and budget gates on both backgrounds.

## Boundaries

### Outcome

- Authors can choose caption case, box style, position and line count, with today's frames preserved by default.

### In scope

- Four optional params on the existing `caption` primitive, plus the vocabulary-version record and regenerated outputs.

### Out of scope

- Timed caption files and word timing — the caller supplies the active label per frame via `SignalFrame.labels`. Held by: the caller.
- Any other primitive, and any new caption colour (no free-colour param).

### External dependencies

- None.

### Assumptions

- The shipped fonts cover sentence case (they do for Latin).

### Non-negotiable constraints

- Principles I–III: deterministic output, the registry as the single source of truth, palette-only rendering.
- Defaults reproduce today's frames byte-for-byte; no golden hash moves.

**Boundary change**: none — params on an existing primitive are a vocabulary change, not a new responsibility.
