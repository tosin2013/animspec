# Implementation Plan: Fighter Character, Poses and Palette Variants

**Branch**: `feature/029-fighter-poses` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

## Summary

- **`fighter`**: one new v2 entry in `CHARACTERS` (`src/primitives/sprites.ts`), generated from
  shapes by [`fighter-gen.py`](fighter-gen.py), with a 1-px auto outline.
- **Pose lists**: `Character` gains optional `punch`, `hit` and `ko` lists. The character gate
  (`scripts/lib/vocabularyRules.ts`) checks them.
- **`sprite` params**: gains `pose` and `variant`. A held pose replaces the pose cycle and turns
  off bob and hop. `variant: "alt"` looks up `<role>-alt` before the role.
- **Vocabulary** goes 21 → 22. No format change, so the constitution is untouched.

## Constitution Check (6.3.0)

| Principle | Verdict | Notes |
| --- | --- | --- |
| I | Pass | Poses are data chosen by params; no state across frames. |
| II | Pass | Params live in the registry, and the character is data in the registry module. |
| III | Pass | Roles only; `-alt` names are ordinary roles. |
| IV | Pass | Enum params reset unknown values. |
| V | Pass | Defaults are unchanged. `character: "fighter"` previously drew `mascot` (recorded, as with `hero` in spec 020). |
| VI | Pass | Existing gates plus checks. |
| VII | Pass | No boundary change. |

## Checks and cases

- **Determinism**:
  - four distinct poses;
  - a missing pose equals `auto`;
  - a held pose ignores the signal;
  - `alt` recolours only the `-alt` parts, and changes nothing without `-alt` roles or in monochrome;
  - the fighter stays in DMG greens under `gameboy-dmg`, and on the grid under `genesis`.
- **Reference cases**: `sprite:fighter`, `-punch`, `-hit`, `-ko`, `-versus` (alt, facing left) and `-mono`.
