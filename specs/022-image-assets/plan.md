# Implementation Plan: Image Assets

**Branch**: `feature/022-image-assets` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-image-assets/spec.md`

## Summary

Art enters a spec as **declared, digest-pinned assets**. A new registry primitive, `image`,
places, crops, flips, fades and scroll-tiles it, in the art's own colours (in creative mode)
or mapped to the palette.

- **Hosts** pass decoded bitmaps via `SpecOpts.assets`.
- **The CLI** loads `<id>.png` next to the spec and checks the sha256 (exit 5 on a mismatch).
  `draw` never touches files.
- **Gates** get a deterministic in-code probe asset under the id `main`.
- **Constitution 5.0.0** amends Principles III and IV.
- **The vocabulary rises.**

See [research.md](research.md) R1–R9.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (`Image`, `loadImage`, `drawImage`) and `node:crypto` (sha256). No dependency added.

**Storage**:
- 33 new reference cases per set, from in-code asset canvases (no binary fixtures), with
  `golden/CHANGES.md` rows.
- Gallery and loop for `image`, the `parallax-forest` showcase, and site files.

**Testing**: The existing gates chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library + CLI with an offline verification harness

**Performance Goals**:
- Asset path: at most 64 `drawImage` calls per layer.
- Palette path: memoised mapping; the first frame is within 50 ms at 1080p for assets up to
  1920 × 1080 (confirmed in the budget output).

**Constraints**:
- No existing hash moves.
- The legacy `_bitmap` path is unchanged.
- No gate assertion is weakened (probe assets are added, R6).
- Verify stays offline.

**Scale/Scope**:
- `src/primitives/registry.ts` (`DrawContext`, the `image` entry, schema).
- `src/specInterpreter.ts` (`SpecOpts.assets`, the dispatch rule).
- `src/specValidator.ts` (`assets`, the cross-layer check).
- A new `src/assets.ts` (`checkAssets`, `AssetImage`), and `src/index.ts`.
- `cli/render.ts`.
- Gates: `gateKit`, `goldenHashes`, `showcase`, and `verify-*`.
- The constitution and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 4.2.0, and against the amended 5.0.0 text this feature ships.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Frames are a pure function of (spec, assets, signal, seed). Scrolling is closed-form. The memo cache is keyed purely (R5). |
| II. Single source | Pass | `image` and its params live in the registry. The schema and prompt follow. |
| III. Palette roles | **Amended** | Violated under 4.2.0 by `colour: asset`. 5.0.0 exempts declared-asset pixels in `asset` mode in creative mode only. `palette` mode and everything outside creative mode stay role-only. |
| IV. Untrusted input | **Amended** | Violated under 4.2.0: "The `image` layer MUST NOT be accepted from a spec". 5.0.0 accepts it only when it names a declared, digest-pinned asset. Malformed assets and undeclared ids are reported. |
| V. Saved specs keep rendering | Pass | Additions only. The legacy `_bitmap` path is unchanged (R7). |
| VI. One offline verify | Pass | In-code fixtures. The CLI test writes its PNG to a temp folder. |
| VII. Boundaries | Pass, with a boundary change | The format gains `assets`. The CLI begins loading asset files (moved from held-by-the-caller). New exports `checkAssets` and `AssetImage`. All are named in the amendment. |

**Violation record**: Principles III and IV under 4.2.0. They are justified by #108, #109 and
the maintainer decisions of 2026-10-24, and resolved by the MAJOR amendment in the same
change.

**Post-design re-check**: unchanged.

## Project Structure

```text
specs/022-image-assets/  plan.md, research.md, data-model.md, quickstart.md,
                         contracts/image-assets.md, checklists/requirements.md, tasks.md

src/assets.ts                 # NEW: AssetImage type, checkAssets (sha256)
src/primitives/registry.ts    # DrawContext.assets/creative; image entry; schema assets
src/specInterpreter.ts        # AnimSpec.assets; SpecOpts.assets; _bitmap-only legacy dispatch
src/specValidator.ts          # assets sanitizing; undeclared-asset layer drop
src/index.ts                  # export checkAssets, AssetImage
cli/render.ts                 # --assets, sha256 check, EXIT_ASSET 5, loadImage, manifest assets
scripts/lib/gateKit.ts        # probeAssets(); creative + assets in draw contexts; palette skip rule
scripts/lib/goldenHashes.ts   # goldenAssets(); GoldenApi.assets; IMAGE_CASES
scripts/lib/showcase.ts       # assets factory; parallax-forest
scripts/verify-*.ts           # validator, determinism, cli, gates updates
.specify/memory/constitution.md (5.0.0), golden/*, gallery/, loops/, showcase/, docs/*, CHANGELOG.md, specs/ROADMAP.md
```

**Structure Decision**: one new source file (`src/assets.ts`) keeps the digest logic out of
the registry.

## Design Notes

**Order of work**:
1. `DrawContext.creative` and `assets`, plus the gate harness supplying probe assets.
   Nothing moves.
2. `src/assets.ts` and `checkAssets`.
3. The `assets` format and validator, and the schema.
4. The `image` primitive (asset path).
5. Palette mapping and the memo.
6. Interpreter dispatch (the legacy rule).
7. The CLI.
8. The vocabulary bump.
9. Checks.
10. Goldens (`golden:update`).
11. Gallery, loops and showcase.
12. The constitution 5.0.0 amendment and docs.
13. Verify, at most 3 failed attempts.
14. The PR.

**Risk**: smooth scaling and opacity differ slightly between processor types. The
cross-type tolerance (8/255) covers this. If `image:smooth` exceeds it, record it the way
#126 recorded `emitter` (a known issue), and keep `nearest` as the default. Never widen the
tolerance.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principles III and IV redefined | Art must enter specs (#108), in its own colours on request | Palette-only images lose the art's colour; path-named assets aren't reproducible across machines |
| New file `src/assets.ts` | sha256 checking is shared by the library and the CLI, and is not a primitive concern | Putting it in the registry mixes I/O-adjacent hashing into the vocabulary module |
