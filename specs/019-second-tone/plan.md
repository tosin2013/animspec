# Implementation Plan: Second Tone

**Branch**: `feature/019-second-tone` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-second-tone/spec.md`

## Summary

The pattern letter `b`, reserved by spec 018, becomes the second tone on `grid` and `checker`.
It draws the reserved role `fg2` (spec 020's roles contract, so only in creative mode) and
otherwise `#808080`.

The change is small:
- One helper, `secondTone(p)`.
- One letter added to `parsePattern`.
- Two `paint` branches, one each in `grid` and `checker`.
- Check, example and reference updates.

There is no format change and no new param, and the vocabulary stays 13. During implementation the palette gate's role rule was widened to match the accent's (constitution 4.1.0, R5). See
[research.md](research.md) R1–R5.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**:
- 9 new reference cases per set in `golden/arm64/` and `golden/x64/` (x64 via Docker), with
  `golden/CHANGES.md` rows.
- One showcase still.
- Refreshed `VOCABULARY.md` and site files.

**Testing**: The existing gate scripts chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with an offline verification harness

**Performance Goals**: A `b` cell costs one fill, the same as `#`, so the budget is
unchanged.

**Constraints**:
- No existing reference hash moves.
- Pure function of spec, signal and seed.
- Verify stays offline.
- No gate threshold changes.

**Scale/Scope**:
- `src/primitives/registry.ts` only, under `src/`.
- 5 script files.
- Docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 4.0.0.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | A pure lookup. Chunk and twice-render checks added. |
| II. Single source | Pass | `FG2_ROLE`, `FG2_MONO` and `PRIMITIVE_ROLES` live in the registry. The gates read them. |
| III. Palette roles | Pass | `b` colours only with the role `fg2` or its fixed bg–fg grey, and stays monochrome by default. |
| IV. Untrusted input | Pass | A bad `fg2` is dropped and reported by spec 020's `sanitizeRoles`. |
| V. Saved specs keep rendering | Pass | No recorded frame contains `b`. The `b` behaviour change was announced by spec 018 when it reserved the letter. |
| VI. One offline verify | Pass | Existing gates. |
| VII. Boundaries | Pass | No boundary or format change. A MINOR amendment (4.1.0) restates the Quality Gates palette row, decided during implementation (R5). |

**Post-design re-check**: unchanged, no violations. Implementation added the 4.1.0 gate-row amendment (R5), decided by the maintainer.

## Project Structure

```text
specs/019-second-tone/  plan.md, research.md, data-model.md, quickstart.md,
                        contracts/second-tone.md, checklists/requirements.md, tasks.md

src/primitives/registry.ts     # FG2_ROLE/FG2_MONO/PRIMITIVE_ROLES, secondTone; parsePattern
                               #   accepts b; grid/checker paint; pattern desc + example
scripts/verify-gates.ts        # rolesProbe includes PRIMITIVE_ROLES
scripts/verify-registry.ts     # role-name check includes PRIMITIVE_ROLES
scripts/verify-spec-validator.ts  # reserved-b check → b reports nothing
scripts/verify-determinism.ts  # two-tone checks
scripts/lib/goldenHashes.ts    # three PATTERN_CASES
scripts/lib/showcase.ts        # two-tone-quilt
golden/*, showcase/, docs/ (site:generate), docs/user-guide.md, CHANGELOG.md, specs/ROADMAP.md
```

**Structure Decision**: single project; no new files under `src/` or `scripts/`.

## Design Notes

**Order of work**:
1. Registry constants and helper. This moves nothing.
2. `parsePattern` and the two `paint` branches. Patterns without `b` stay byte-identical.
3. Descriptions and examples. Run `vocab:record` to refresh the doc.
4. Gate updates.
5. Determinism checks and reference cases, then `golden:update`.
6. Showcase, docs, roadmap and changelog.
7. `npm run verify` (at most 3 failed attempts), then the PR.

## Complexity Tracking

No violations.
