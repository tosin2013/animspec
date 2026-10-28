# Implementation Plan: Palette Profiles

**Branch**: `feature/028-palette-profiles` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

## Summary

`profile` is resolved once in `drawSpec`, in creative mode, into the palette primitives already
receive:
- **`gameboy-dmg`** replaces bg, fg and accent with DMG hex tones, and adds `fg2` plus the hero's
  roles under `roles`.
- **`genesis`** snaps the accent and roles to the 9-bit grid, and sets `DrawContext.profile`, so
  that `image` snaps asset colours through a cached, per-pixel map (the `paletteMapped`
  pattern).

Fixed greys go through one helper, `shade(p, onBlack, onWhite, t)`. It returns the literal when
bg is `"black"` or `"white"`, and otherwise the bg–fg mix at `t`, snapped to the nearest palette
colour. That keeps every existing frame byte-identical. `dither` gains `BAYER2`. See
[research.md](research.md).

## Technical Context

- **Language**: TypeScript in strict mode, ES modules; Node.js 22 or later. Dependencies: `@napi-rs/canvas`, unchanged.
- **Storage**: new reference cases (both sets, x64 via Docker), vocabulary record 21, two showcase loops, and a gallery demo for `line-chart`.
- **Testing**: the existing gates via `npm run verify`, plus new determinism checks.
- **Constraints**: no existing hash moves, and no threshold changes.

## Constitution Check (6.2.0)

| Principle | Verdict | Notes |
| --- | --- | --- |
| I | Pass | The profile resolves to constants; snapping is pure arithmetic with a cache that never changes a frame. |
| II | Pass | Profiles live in one registry table, and the schema is generated from it. |
| III | Pass | A profile is a palette, honoured only in creative mode. Derived greys are palette mixes snapped to palette colours. |
| IV | Pass | An unknown `profile` is dropped and reported. |
| V | Pass | Every new path needs creative mode plus a profile, or `matrix: "2"`. |
| VI | Pass | Existing gates, plus checks. |
| VII | Recorded | "The format" gains `profile`: MINOR, 6.3.0, in this change. |

## Project Structure

```text
src/primitives/registry.ts  # PROFILES table, snap9, shade(), BAYER2, dither enum, schema,
                            #   grid/rain/led/sprite/tetris/dither greys via shade(),
                            #   image genesis snapping, VOCABULARY_VERSION 21
src/specInterpreter.ts      # AnimSpec.profile; palette resolution; dctx.profile
src/specValidator.ts        # profile kept or dropped and reported
scripts/lib/goldenHashes.ts, scripts/verify-determinism.ts, scripts/verify-spec-validator.ts
scripts/lib/showcase.ts, scripts/lib/demos.ts (line-chart demo)
.specify/memory/constitution.md, docs/user-guide.md, specs/ROADMAP.md
```

## Complexity Tracking

None.
