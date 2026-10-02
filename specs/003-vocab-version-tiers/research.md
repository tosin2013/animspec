# Research: Vocabulary Version and Tiers

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-01

Decisions taken while planning. Each was checked against the code as it stands on
`002-cross-machine-frames` on 2026-10-01.

## R1. Where the version lives and what it looks like

**Decision**: The current vocabulary version is a constant, `VOCABULARY_VERSION`, declared in
`src/primitives/registry.ts` beside the primitives it describes, and exported from the public
surface. It is a whole number, starting at 1. A spec records it in an optional `vocabulary`
field.

**Rationale**: The registry is the vocabulary, so its version belongs in the same file
(Principle II). A whole number needs no parsing or comparison rules beyond "is it an integer
between 1 and the current version".

**Alternatives considered**:

- Reuse the package version: it rises for reasons that have nothing to do with the
  vocabulary, and it does not exist as a published number yet.
- A dotted version (major.minor): the only use for a major part is removal, which the spec
  leaves to the feature that first removes a primitive and ties to the package's major
  release.
- A hash of the vocabulary as the version: cannot be ordered, so "newer than this library"
  cannot be answered.

## R2. How validation treats the version

**Decision**: `validateAnimSpec` always writes `vocabulary` on the spec it returns.

| Input `vocabulary` | Output `vocabulary` | Message |
| --- | --- | --- |
| absent | current | none |
| integer from 1 to current | unchanged | none |
| integer above current | current | `vocabulary N is newer than this library (M); recorded as M` |
| anything else | current | `vocabulary dropped (not a valid version)` |

Messages go in the existing `errors` list, as the font and accent messages do. The spec stays
valid in every row.

**Rationale**: This is the existing pattern for `font` and `accent`: repair, report, keep the
spec. A spec from a newer vocabulary is still worth rendering, because unknown layers are
already dropped and reported.

**Alternatives considered**:

- Reject a spec from a newer vocabulary outright: stricter than the rest of the validator,
  and it would refuse specs whose layers all still exist.
- Leave `vocabulary` off when the input had none (as `font` does): then FR-003 fails, and
  specs keep being saved without a version.

## R3. The version is not in the model-facing schema

**Decision**: `buildJsonSchema` does not list `vocabulary`. `drawSpec` ignores the field.

**Rationale**: A model cannot know the right value, and the validator stamps it (FR-007).
Leaving it out of the schema means structured output cannot be made to invent one. If a
model supplies one anyway, R2 handles it. The interpreter ignoring the field is what makes
FR-009 and FR-027 true by construction.

**Alternative considered**: list it as optional. It would add a field a model can fill with
a wrong but valid number, which the validator would then keep.

## R4. Where tiers live

**Decision**: `tier` is a required field on every registry entry, typed
`"core" | "extended" | "contrib" | "legacy"`. A legacy entry also carries `replacedBy`, the
type name of its replacement. Kit membership stays where it is, in the kit lists in
`src/primitives/selector.ts`.

**Rationale**: Adding a primitive stays one registry entry (Principle II). The compiler
rejects an entry with no tier, and the registry gate rejects one with an unknown tier. Kits
are already a single list of type names; an extended primitive "belongs to a kit" when that
kit lists it, so no second membership list is needed.

**Alternatives considered**:

- A separate map of type to tier: a second list to keep in step by hand, which Principle II
  forbids.
- Put kit names on the registry entry: moves kit design into the registry and makes the
  roadmap's later kit re-tuning touch every primitive.

## R5. Initial tiers

**Decision**:

| Tier | Primitives | Count |
| --- | --- | --- |
| extended | `sprite`, `tetris`, `plasma`, `gridhorizon`, `tunnel` | 5 |
| core | the other 24 | 24 |
| contrib | none | 0 |
| legacy | none | 0 |

**Rationale**: The PRD names `sprite`, `tetris` and `plasma` as extended. `gridhorizon` and
`tunnel` appear only in the `retro` kit, like `plasma`. Checked against the kit lists: every
one of the five is listed by a kit (`arcade` or `retro`), `caption` is core, and no kit lists
a type that does not exist. `mesh3d` stays core: two kits list it and the PRD treats 3D
projection as a geometry target, not a style.

**Effect**: with no kit chosen, the `sprite` category is no longer represented, because its
only primitive is extended. The spec lists this as an edge case and accepts it.

**Confirmed by the maintainer on 2026-10-01.** The list is one field per entry; after the
feature ships, a tier change raises the version.

## R6. How selection applies tiers and reports refusals

**Decision**: A new function, `selectDetailed`, takes a fourth, optional input: a list of
primitives the caller names. It returns the selection and a list of refused names with
reasons. `select` keeps its current three inputs and returns only the selection.

| Step | Rule |
| --- | --- |
| no kit, or `auto` | sample from core only: one per category that has a core primitive, then fill to the target |
| a kit | the kit's list, then extras from core not already in it |
| named: core | added |
| named: contrib | added |
| named: extended | kept if the chosen kit lists it; otherwise refused |
| named: legacy | refused: `legacy, replaced by <type>` |
| named: unknown | refused: `not a primitive` |
| always | `caption` is added if missing; duplicates removed; order is deterministic |

The core of the algorithm takes the primitives and kits as inputs, so the checks can run it
against fixtures that contain contrib and legacy primitives. The exported functions bind the
real registry and kits.

**Rationale**: `select(kit, breadth, seed)` is named in the constitution and is the shape the
private product calls. Keeping it avoids a breaking change for one new report. The report
needs somewhere to go, since FR-014 requires the caller be told, and an array cannot carry it.

**Alternatives considered**:

- Change `select` to return an object: breaks the one existing caller pattern,
  `buildVocabPrompt(select(...))`, for every caller whether or not they name primitives.
- Throw on a refused name: turns a recoverable request into a crash, unlike the rest of the
  library, which repairs and reports.
- Silently drop refused names: fails FR-014.

**Selection output changes** for the same kit, breadth and seed, because the pools change.
This is intended and recorded in the spec's assumptions. No reference frame depends on it.

## R7. Detecting a vocabulary change without a version rise

**Decision**: A committed record, `golden/vocabulary.json`, holds one entry per version (the
version, a hash of the vocabulary at that version, and a one-line summary) plus the full
snapshot for the current version. The registry gate derives the snapshot from the registry,
hashes it, and compares it with the entry for `VOCABULARY_VERSION`.

The snapshot is everything a spec can observe: for each primitive its type, tier,
`replacedBy`, and every param's declaration (type, bounds, default, allowed values). It
leaves out descriptions, categories and draw functions.

| Situation | Result |
| --- | --- |
| snapshot hash equals the entry for the current version | pass |
| snapshot differs, version unchanged | fail: `vocabulary differs from version N; raise VOCABULARY_VERSION and run npm run vocab:record` |
| version raised, no entry for it | fail: `no record for version N; run npm run vocab:record` |
| entries not numbered 1 to current without gaps | fail |

`npm run vocab:record -- "<summary>"` appends the entry for a new version. It refuses to
overwrite an existing version's entry, refuses a raised version when the snapshot has not
changed, and otherwise adds no entry and only refreshes `VOCABULARY.md`.

**Rationale**: A check needs something to compare against, and the only durable thing is a
committed record. Keeping one hash per version, never rewritten, means the dishonest path
(changing the vocabulary and re-recording under the same number) needs a hand edit to a
committed file, which shows in review. The full current snapshot makes the diff readable.

**Alternatives considered**:

- Only the current snapshot, no history: re-recording under the same version would pass.
- Compare against git history: verify must run without git and without network, and CI
  checks out a single commit.
- Rely on review alone: this is the drift FR-024 exists to prevent.

**What the record does not cover**: how a primitive draws. That is the reference frames' job
(Principle I). A drawing change with no change to the declaration does not raise the version.

## R8. Where the checks run and how they are proven

**Decision**: The tier and version rules are pure functions in a new
`scripts/lib/vocabularyRules.ts`. Each takes the primitives, the kits, the record and the
version, and returns a list of problems naming the primitive or kit. `verify-registry.ts`
runs them on the real registry, then on fixtures in a new `scripts/fixtures/tierFixtures.ts`,
one per violation, and fails if any rule does not fire. It also runs the selection sweeps
for SC-004 and SC-005.

**Rationale**: This is the pattern the vetting gates use (`badPrimitives.ts`): a gate is
trusted only if it is shown rejecting a rule-breaker. No new gate script and no change to
the `verify` chain, so Principle VI holds without edits to `package.json` beyond one new
script for recording.

**Replacement is proven with a fixture** (US3): a test primitive is rendered as core and
again as legacy with a replacement, and the frames are compared byte for byte; it is then
run through the selection core across the sweep and must never be offered.

**Known limit**: `validateAnimSpec` and `drawSpec` look primitives up in the real registry,
which ships no contrib or legacy primitive, so FR-017 cannot be exercised end to end through
them. It is covered two ways: the fixture is sanitised and drawn through the same
per-primitive code paths, and a static check fails if `src/specValidator.ts` or
`src/specInterpreter.ts` mentions `tier`.

## R9. Making tiers and the version visible to people

**Decision**: `npm run vocab:record` also writes `VOCABULARY.md` at the repository root: the
current version, the version history with summaries, and a table of every primitive with its
category, tier, replacement and description. The registry gate fails if the file is stale.
The README links to it.

**Rationale**: A hand-written table of 29 (later 100) primitives is a second list kept in
step by hand. The icon and font generators already use "generate, commit, check freshness";
this follows it.

**Alternative considered**: document tiers only in code. FR-018 and SC-010 ask for
documentation a reader can find in under a minute.

## R10. Full-vocabulary defaults

**Decision**: `buildVocabPrompt()` and `buildJsonSchema()` keep defaulting to the whole
registry, and `ANIMSPEC_JSON_SCHEMA` stays the full-vocabulary schema. The contract states
that anything shown to a model must be built from a selection.

**Rationale**: The full forms describe what the validator accepts, which includes every
tier (FR-017). Changing the default would change what the validator's published schema
means. FR-016 is about descriptions generated for a selection, and those already contain
exactly the subset they are given.

**Risk noted**: a caller can still pass nothing and show a model everything. The contract
says not to. Removing the default is a breaking change better made with the package work
(roadmap 004).

## R11. Order relative to spec 002

**Decision**: Implementation starts after `002-cross-machine-frames` is merged.

**Rationale**: 002 has open tasks and uncommitted work, and both features edit
`registry.ts`, `specValidator.ts`, `specInterpreter.ts`, `index.ts` and
`verify-registry.ts`. 003 moves no reference frame, so there is no attribution problem as
there was between 001 and 002; the reason is only to avoid conflicting edits.
