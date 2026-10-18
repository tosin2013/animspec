# Feature Specification: `type-reveal` primitive

**Feature Branch**: `feature/012-type-reveal`

**Created**: 2026-10-18

**Status**: Draft

**Input**: Issue #23 (Primitive: type-reveal, `good first primitive`), handled as a
specification by maintainer decision (the proposal's two open design questions are
settled here rather than by an `ask` round-trip). Kinetic typography: a text block whose
words (or lines) appear sequentially as the frame advances, with an optional emphasis
span in the accent colour.

## User Scenarios & Testing

### User Story 1 - A spec author reveals a sentence word by word (Priority: P1)

A host wants a key sentence to build while narration speaks it: one layer
`{ type: "type-reveal", text: "...", framesPerUnit: 12 }` shows the first words at
`startFrame`, one more word every `framesPerUnit` frames, and holds the full block
afterwards. An emphasis span (`emphasisStart`/`emphasisEnd`) draws the load-bearing
words in the accent colour.

**Why this priority**: the reveal schedule is the primitive's whole point.

**Independent Test**: render the same layer at increasing frame indices — words appear in
order on the declared schedule and the final frame equals the full static block.

**Acceptance Scenarios**:

1. **Given** a `type-reveal` layer with 6 words and `framesPerUnit` 12, **When** frame
   `startFrame + k*12` is rendered, **Then** exactly `k+1` words are visible, in order.
2. **Given** a frame at or after `startFrame + (units-1)*framesPerUnit`, **When** rendered,
   **Then** the full block is visible and identical to every later frame (hold).
3. **Given** `emphasisStart`/`emphasisEnd` naming words 2–3, **When** rendered, **Then**
   words 2 and 3 draw in the accent colour and every other visible word in the foreground.
4. **Given** `mode: "line"`, **When** rendered, **Then** each line of the (newline-split)
   text is one unit on the same schedule.

### User Story 2 - Deterministic and validator-safe (Priority: P1)

A frame is a pure function of `(spec, frame, seed)`: the reveal depends on the frame index
alone, never on render order or history. Every param clamps in `sanitizeLayer`; an empty
`text` draws nothing; a reversed emphasis span (`emphasisEnd < emphasisStart`) means none.

**Why this priority**: the gates and the hosts both rely on this being boring.

**Independent Test**: the determinism and order-independence gates cover the new case set
(defaults and generated non-default params), and the validator test clamps every bound.

**Acceptance Scenarios**:

1. **Given** the same layer and frame, **When** rendered twice, or rendered after other
   frames or in a chunk, **Then** the pixels are byte-identical.
2. **Given** out-of-bounds params (e.g. `fontSize: 9999`, `x: 3`), **When** validated,
   **Then** they clamp to their declared bounds and the layer renders.

### User Story 3 - Model-facing vocabulary membership (Priority: P2)

The primitive joins the registry at tier `contrib`: the vocabulary prompt, the JSON
schema and the deterministic kit selection pick it up from the registry, and every
generated output (gallery, loop, site pages, golden hashes) is regenerated.

**Why this priority**: it is how the primitive reaches models and the site.

**Independent Test**: `npm run verify` — the registry, vocabulary, gallery/site-freshness
and golden gates all pass with the new entry.

**Acceptance Scenarios**:

1. **Given** the updated registry, **When** `npm run verify` runs, **Then** every gate
   passes with `VOCABULARY_VERSION` raised by one.

### Edge Cases

- **Empty or whitespace `text`**: falls back to the active label; when both are empty,
  nothing draws (no crash, no empty box).
- **`emphasisEnd < emphasisStart`**: treated as no emphasis.
- **Emphasis indices past the last unit**: clamped to the words that exist; nothing extra draws.
- **A single long word wider than `maxWidth`**: drawn anyway (overflow is preferable to
  splitting a word); the next word wraps.
- **`startFrame` in the future**: nothing visible yet — zero units, not one.

## Requirements

### Functional Requirements

- **FR-001**: One registry entry in `src/primitives/registry.ts`: `type: "type-reveal"`,
  `category: "text"`, `tier: "contrib"`, with a `draw` that uses the palette only
  (`foreground` body, `accent` emphasis), the context's shipped `font`, and no ambient
  randomness, clock, file or network access.
- **FR-002**: Params (every one with a declared type, bounds and default, so
  `sanitizeLayer` clamps it): `text` string `maxLen` 500 default `""`; `mode` enum
  `word|line` default `word`; `startFrame` number 0–1,000,000 default 0; `framesPerUnit`
  number 1–600 default 12; `fontSize` number 12–160 default 48; `emphasisStart`/
  `emphasisEnd` number −1–10,000 default −1 (−1 = none); `x`, `y` number 0–1 default
  0.5 / 0.45; `align` enum `left|center|right` default `center`; `maxWidth` number 0–1
  default 0.8. (The bounds the proposal left open — `startFrame` "≥ 0",
  `framesPerUnit` "≥ 1", emphasis "≥ 0" — receive the concrete maxima stated here; the
  −1 sentinel for "no emphasis" is the maintainer's clarified decision.)
- **FR-003**: The text comes from the **layer param `text`**, falling back to the active
  label when empty (the `chapter-card` pattern — the maintainer's clarified decision was
  the layer param; the fallback gives the default layer real content and satisfies the
  reactivity gate, which no gate may be weakened for). A spec that sets `text` carries its
  own words. When both are empty, nothing draws.
- **FR-004**: Reveal schedule: unit `k` (0-based) first appears at frame
  `startFrame + k * framesPerUnit`; the number of visible units is
  `clamp(floor((index − startFrame) / framesPerUnit) + 1, 0, units)` — a pure function of
  the frame index. Units are whitespace-separated words (`mode: "word"`) or
  newline-separated lines (`mode: "line"`).
- **FR-005**: Word mode wraps visible words greedily to `maxWidth * width` using the
  context's own text measurement, honouring `align` within that width; line mode draws
  each unit as its own row. The block is positioned at `(x, y)` normalised to the frame.
- **FR-006**: Emphasis: visible units whose index lies in `[emphasisStart, emphasisEnd]`
  (inclusive, when `emphasisEnd ≥ emphasisStart ≥ 0`) draw in `palette.accent`; all other
  visible units draw in `palette.fg`.
- **FR-007**: `VOCABULARY_VERSION` rises 6 → 7, and every generated output the registry
  drives is regenerated: vocabulary prompt and JSON schema, gallery thumbnail, loop, site
  pages, and the golden hash set (both processor types) with a `golden/CHANGES.md` row.
- **FR-008**: The change passes every existing gate unchanged — no gate, threshold or
  reference is edited.

### Key Entities

- **Reveal unit**: one word (word mode) or one line (line mode) — the atomic thing that
  appears.
- **Reveal schedule**: the frame index → visible-unit count function; deterministic and
  order-independent by construction.
- **Emphasis span**: the inclusive unit-index range drawn in the accent colour; −1/−1 or a
  reversed span means none.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The new case set has committed golden hashes for arm64 and x64 and a
  `golden/CHANGES.md` row naming the primitive and the reason.
- **SC-002**: Frames of the reveal render identically forwards, backwards, chunked and in
  fresh processes (covered by the order gates with default and non-default params).
- **SC-003**: Every param clamps in the validator; unknown layers still drop with a report.
- **SC-004**: `npm run verify` passes end to end with `VOCABULARY_VERSION` 7, fresh
  gallery/loop/site outputs, and no other primitive's hash moved.
- **SC-005**: Style review passes: negative space (text on an empty field), frame count as
  the one signal, every word is content, legible in pure black and white.

## Boundaries

### Outcome

- **For a spec author**: kinetic text reveal as one deterministic layer, with an accent
  emphasis span, that holds after its last unit and replays byte-identically forever.
- **For the project**: one more vocabulary unit that no existing primitive duplicates, at
  tier `contrib`.

### In scope

- The single registry entry (params and `draw`) and its generated outputs: vocabulary
  prompt/schema, gallery, loop, site pages, golden hashes, `CHANGES.md` row.
- The vocabulary version bump (6 → 7).
- The two clarified design decisions, recorded here: layer-param text source; −1
  emphasis sentinel.

**Boundary change**: none. The registry and its generated outputs are already in the
in-scope baseline ("The vocabulary"); a new entry is the pipeline working as designed.

### Out of scope

- **`quote-card`** (issue #26): its own proposal, handled separately after this one — it
  reuses the reveal rhythm but is a different composition. Held by: its own spec or
  pipeline run.
- **Audio-driven reveal timing**: the frame count alone drives the reveal, per the
  proposal. Signal reactivity stays with the reactive primitives. Held by: nobody, for now.
- **Per-word animation beyond appear/hold** (fades, slides): not proposed; the reveal is
  binary per unit. Held by: nobody, for now.
- **A context-label-only text source**: considered and rejected — the layer param is
  primary; the active label remains as the fallback when `text` is empty (FR-003).

### External dependencies

- **None.** Drawing uses the already-shipped fonts and the canvas 2D context.

### Assumptions

- Text in the layer param is the right default for new text primitives whose content is
  the spec's own (decided in clarification); the older context-label pattern remains for
  the primitives that already use it.
- Canvas text measurement is deterministic per processor type, exactly like text drawing
  (the fonts gate already pins font behaviour).
- Unit counts stay modest (a sentence, a few lines); `maxLen` 500 keeps the wrap loop small.

### Non-negotiable constraints

- **Principle I**: the reveal is a pure function of the frame index; no clock, no history.
- **Principle II**: one registry entry; every param declares type, bounds, default; the
  vocabulary version rises with the change.
- **Principle III**: palette colours only; shipped fonts only; no reducedFlicker hazard
  (the reveal never strobes — units only ever appear).
- **Principle IV**: untrusted specs clamp; an empty `text` layer renders nothing.
- **Principle VI**: all checks run inside the one offline `npm run verify`.
- **Naming**: `type-reveal` is neutral.
