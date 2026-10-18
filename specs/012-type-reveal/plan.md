# Plan: type-reveal

## Summary

One new registry entry — `type-reveal`, category `text`, tier `contrib` — that reveals a
text block word by word (or line by line) on a frame-index schedule, with an accent
emphasis span, holding after the last unit. Text travels in the layer (`text` param,
default `""`); "no emphasis" is the −1 sentinel. `VOCABULARY_VERSION` rises 6 → 7 and
every registry-driven output is regenerated.

## Approach

1. **Registry entry** (`src/primitives/registry.ts`): params per spec FR-002, `draw`
   per FR-003–FR-006 — palette colours only, context font, greedy wrap with the context's
   own measurement, pure function of the frame index.
2. **Version**: `VOCABULARY_VERSION` 6 → 7.
3. **Generated outputs**: `vocab:record`, `gallery:generate`, `golden:update` (+ a
   `golden/CHANGES.md` row naming the primitive, its cases, set `both`), `loops:generate`,
   `site:generate` + `site:check`.
4. **Gate**: `npm run verify` — all existing gates, untouched.

## Gates and golden hashes

- **Touched**: every gate sees the new primitive; the registry gate checks the new
  entry's shape, the vocabulary gates its prompt/schema membership, the determinism and
  order gates its hashes (including the generated non-default-param case), the
  gallery/site gate its committed outputs, the package gate the rebuilt surface.
- **Golden hashes**: **new cases added** (`type-reveal` at three levels), existing cases
  **unchanged** — no other primitive's hash moves. `golden:update` records the addition;
  the `CHANGES.md` row states the reason.

## Constitution Check (Principle VII)

- **Boundary change**: none. "The vocabulary" is in the in-scope baseline; a new entry is
  the vetting pipeline working as designed. The spec records the maintainer's decision to
  run this proposal as a specification (settling its two open design questions) rather
  than an `ask` round-trip.
- **Principles**: I (pure function of the frame index), II (one entry, every param
  bounded with a default, version bump), III (palette + shipped fonts only; no strobe so
  `reducedFlicker` is not implicated), IV (clamped params, empty text renders nothing),
  VI (one offline `npm run verify`).

## Out of scope

`quote-card` (issue #26, separate), audio-driven timing, per-word animation beyond
appear/hold, context-label text source for this primitive.

## Tasks

See `tasks.md`.
