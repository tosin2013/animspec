# Implementation Plan: Stickman Spin, Bow and Off-Frame Position

**Branch**: `feature/031-stickman-spin-bow` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

## Summary

- **`bow`**: a new entry in `POSES` (`src/primitives/stickman.ts`). The lean eases to 70° and
  back with a hold, and the arms follow the lean so they hang straight down.
- **`spin`**:
  - `StickPose` gains an optional `scaleX`.
  - `stickBones` scales every point horizontally about the figure's `x`, but only when a pose
    sets it, so other actions take the same code path as before.
  - `spin` sets `scaleX = sign(cos 2πu) · max(0.12, |cos 2πu|)`, raises one arm (which shows
    the direction as it sweeps across the body), and hops at the half-turn.
- **`x`**:
  - `stickman.x` bounds become -0.5..1.5, with a description that names the centre and the
    walk-in.
  - `stickPlace` clamps coords `x` to the same range.
- **Vocabulary**: 23 → 24.

## Constitution Check (6.3.0)

| Principle | Verdict | Notes |
| --- | --- | --- |
| I | Pass | Closed-form poses; `scaleX` is arithmetic on the bones. |
| II–IV | Pass | Registry params; palette unchanged; enum and bound clamping by the validator. |
| V | Recorded exception | Only `x` outside 0..1 (previously clamped) renders differently; no reference case used it. |
| VI–VII | Pass | Existing gates; no boundary change. |

## Checks and cases

- **Determinism**:
  - bow and spin animate, and differ from the other 15 actions;
  - the bow lowers the figure;
  - the spin narrows at the quarter turn, and left/right facings differ;
  - render twice and in any order;
  - `x: -0.3` draws nothing, and `x: -0.02` partly;
  - a sine bind walks the figure in;
  - coords `x: -0.2` stays off-frame.
- **Reference cases**: `stickman:bow`, `stickman:spin` (joints, creative) and
  `stickman:walk-in` (`x` bound -0.2 → 0.5 by a sine).
