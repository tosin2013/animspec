# Implementation Plan: Sprite Palette Roles

**Branch**: `feature/020-sprite-palette-roles` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-sprite-palette-roles/spec.md`

## Summary

Principle III is amended from "bg, fg and accent" to **palette roles**, as follows:

- **Spec level**: the spec gains an optional `roles` map of named colours.
- **Render time**: `Palette` carries the map as `roles`, but only in creative mode.
- **Characters**: a built-in sprite character may declare a v2 `palette`. Each letter maps to
  a role and to the legacy grey it falls back to.

A new 16 × 20 `hero` demonstrates the format. Legacy characters keep their exact code path,
so no existing frame moves. One shared `sanitizeRoles` serves the validator and the
interpreter. The palette gate gains bg↔role segments and a `roles` probe mode, and a
character check, proven by fixtures, runs in the registry gate.

Vocabulary unchanged (13; see research.md R8), constitution 4.0.0. See [research.md](research.md) R1–R10.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**:
- Vocabulary record `golden/vocabulary.json` (version 14) and `VOCABULARY.md`.
- 9 new reference cases per set in `golden/arm64/` and `golden/x64/`, recorded by
  `npm run golden:update` (x64 via Docker), with `golden/CHANGES.md` rows.
- Two showcase entries.

**Testing**: The existing gate scripts chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library with an offline verification harness

**Performance Goals**:
- The hero is 16 × 20 = 320 cells at most, so at most 320 `fillRect` calls per frame. That
  is under the per-primitive budget of 3,000 ops; a 32 × 48 v2 maximum is 1,536.
- The new palette-gate mode adds about one mid-level probe per probe layer per background.
- Verify stays inside the 2-minute target, confirmed from the gate timings.

**Constraints**:
- No existing reference hash moves.
- Pure function of spec, signal and seed.
- Verify stays offline.
- No gate threshold or tolerance changes.

**Scale/Scope**:
- 3 `src/` files, 6 script files, 1 new fixture file.
- Constitution, vocabulary record, golden sets, showcase, docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 3.2.0, and against the amended text this feature ships (4.0.0).

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | Pass | Role resolution is a pure lookup. Roles are sanitized in sorted order, so key order cannot matter. No randomness. |
| II. Single source | Pass | Characters and their palettes live in `sprites.ts`, imported by the registry. The schema's `roles` and the `declaredRoles()` probe list derive from code, not a second list. |
| III. Palette-only | **Amended** | Under 3.2.0 this feature violates bullet 2, which is why it ships the amendment (R9) in the same change. Under 4.0.0 it passes: v2 cells colour only with roles or their monochrome greys, and output is monochrome by default. |
| IV. Untrusted input | Pass | Malformed `roles` entries are dropped and reported. A raw spec goes through the same `sanitizeRoles`. |
| V. Saved specs keep rendering | Pass | Without `roles`, or with legacy characters, the old path runs unchanged. No exception is needed. |
| VI. One offline verify | Pass | All checks are in the existing gates. The Docker x64 render is a maintainer refresh step, not part of verify. |
| VII. Boundaries | Pass, with a contract change | The spec format gains `roles`, so "The format" entry is amended in the same change. No scope change and no new dependency. |

**Violation record**: Principle III under 3.2.0. The justification is the spec itself (#103,
the roadmap's "Palette roles" row), and it is resolved by the MAJOR amendment shipped in the
same change. No other violation.

**Gates touched**:
- **Registry**: character checks with fixtures, and the schema `roles` check.
- **Validator**: `roles` cases.
- **Determinism**: hero exact-colour, monochrome-line and reference cases.
- **Vetting**: the palette gate's `roles` mode and bg↔role segments. The hero is probed
  through `character` `example`.
- **Reference sets**: 9 cases added per set.

**Golden hashes**: no existing hash may move.

**Post-design re-check**: unchanged. The only violation is the recorded Principle III one,
resolved by the amendment.

## Project Structure

### Documentation (this feature)

```text
specs/020-sprite-palette-roles/
├── plan.md
├── research.md            # R1–R10
├── data-model.md
├── quickstart.md
├── contracts/
│   └── palette-roles.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── primitives/sprites.ts   # CHANGE: Character.palette (v2), hero, declaredRoles()
├── primitives/registry.ts  # CHANGE: Palette.roles, sanitizeRoles; sprite draw v2 branch,
│                           #   description and character desc/example; schema roles (VOCABULARY_VERSION stays 13)
├── specInterpreter.ts      # CHANGE: AnimSpec.roles; Palette.roles only in creative mode
├── specValidator.ts        # CHANGE: keep/report roles
└── index.ts                # CHANGE: export sanitizeRoles

scripts/
├── lib/vocabularyRules.ts    # CHANGE: characterProblems
├── fixtures/badCharacters.ts # NEW: four broken characters
├── lib/gateKit.ts            # CHANGE: paletteViolation accepts bg↔role segments
├── lib/goldenHashes.ts       # CHANGE: ROLE_CASES
├── lib/showcase.ts           # CHANGE: hero-roles, hero-mono
├── verify-registry.ts        # CHANGE: character checks, schema roles check
├── verify-gates.ts           # CHANGE: palette gate roles mode
├── verify-spec-validator.ts  # CHANGE: roles cases
└── verify-determinism.ts     # CHANGE: hero exact-colour and mono checks

.specify/memory/constitution.md          # 4.0.0: Principle III, The format, Quality Gates rows, amendment note
golden/vocabulary.json, VOCABULARY.md    # vocab:record refreshes the doc (version 13)
golden/arm64, golden/x64                 # 9 new cases; golden/CHANGES.md rows
showcase/, docs/ (site:generate)         # hero entries
docs/user-guide.md, CHANGELOG.md         # roles section; Unreleased entry
specs/ROADMAP.md                         # 020 row; "Palette roles" row updated
```

**Structure Decision**: single project; no new files under `src/`; one new fixture file.

## Design Notes

**Order of work** (verify stays green after each step):
1. `characterProblems` with its fixtures, run against today's characters. This moves
   nothing. If a legacy character fails, stop and report.
2. `Palette.roles`, `sanitizeRoles`, the interpreter and validator wiring, and the schema.
   No primitive reads roles yet, so nothing moves.
3. The sprite v2 branch with `shadeColour` factored out. The legacy `fillStyle` strings are
   unchanged.
4. Author the `hero`, add `declaredRoles()`, and set the `character` example.
5. The palette gate extension and roles mode.
6. Description changes, then `vocab:record` to refresh `VOCABULARY.md` (version stays 13).
7. Determinism checks and `ROLE_CASES`, then `golden:update` (both sets).
8. The constitution amendment.
9. Showcase, docs, roadmap and changelog.
10. `npm run verify` (at most 3 failed attempts), then the PR, and a comment on #103.

**Byte-identity guard**:
- `poses.palette === undefined` takes the existing loop unchanged.
- `Palette.roles` is absent unless creative mode and a non-empty map are both present.

**PR guard**: `scripts/agent-pr-guard.ts` governs agent primitive PRs. This is a
maintainer-directed spec change (like 013–018), so it is outside that path. Confirm the guard
does not run on non-agent PRs before opening.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle III (3.2.0) redefined | #103 needs more than three colours per character | Host-side quantising is fragile and untested (#102/#103), and a per-character hex palette would leave colours a quantiser cannot name |
