# Plan: Caption Params

## Summary

Add four optional params to the `caption` primitive — `case`, `box`, `position`, `maxLines` —
with defaults that reproduce today's frames byte-for-byte, and fold in the palette fix
(literal `"black"`/`"white"` → `palette.bg`/`palette.fg`). This is a vocabulary change (a param
change on an existing primitive), routed through the Spec Kit flow per `AGENTS.md`.

## Approach

1. Edit the `caption` entry in `src/primitives/registry.ts` (params + draw + palette fix) and
   raise `VOCABULARY_VERSION` 3 → 4.
2. `npm run vocab:record -- "<summary>"` (regenerates `golden/vocabulary.json`, `VOCABULARY.md`).
3. `npm run site:generate` (regenerates `docs/vocabulary.md`, `docs/gallery.md`).
4. `npm run verify` green.

## Gates and golden hashes

- **Touched**: `verify-registry` (version + record + probes), `verify-gates` (probes grow
  177 → 184), `site:check` (two regenerated docs).
- **Golden hashes**: **no movement** — the default caption layer is byte-identical, and the
  palette fix is invisible on the default black background. No `golden:update`, no
  `golden/CHANGES.md` row.

## Constitution Check (Principle VII)

- **Boundary change**: none. Four params on an existing primitive are a vocabulary change, not a
  new responsibility or a new export.
- **Principles**: I (deterministic, defaults preserved), II (registry is the single source of
  truth), III (palette-only), V (pre-release allowance is not needed — hashes don't move).

## Out of scope

Timed caption files and word timing (the caller supplies the label per frame).

## Tasks

See `tasks.md`.
