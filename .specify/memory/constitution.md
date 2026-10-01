# AnimSpec Core Constitution

## Core Principles

### I. Determinism (NON-NEGOTIABLE)

A frame is a pure function of `(AnimSpec, SignalFrame, seed)`. The same three inputs MUST
produce byte-identical RGBA pixels on every run and every machine.

- Code under `src/` MUST NOT use `Math.random`, `Date`, `performance.now`, or any other
  ambient source of variation.
- The only permitted randomness is `mulberry32` from `src/rng.ts`, seeded from the supplied
  seed (mixed with `mixSeed` where a per-frame or per-element stream is needed).
- Every primitive and every composite case MUST have a committed golden hash in
  `golden/hashes.json`, and those hashes MUST match on every run of `npm run verify`.
- `npm run golden:update` MUST be run only when a rendering change is intended, and the
  change MUST say which hashes moved and why.

Rationale: reproducibility is the product. A spec that renders differently twice cannot be
shared, tested, or trusted by the private product that depends on this package.

### II. The Registry Is the Single Source of Truth

`src/primitives/registry.ts` defines the vocabulary. The LLM vocabulary prompt, the JSON
schema, the validator, and interpreter dispatch MUST all be generated from it.

- Adding a primitive MUST be one registry entry (type, category, description, params, draw).
  No second list may be hand-synchronised with it.
- A new primitive MUST draw something no existing primitive can draw by changing its params.
  Otherwise the change is a new param or enum value on the existing primitive.
- Every param MUST declare its type, bounds, and default so that `sanitizeLayer` can clamp it.

Rationale: the registry has no size cap (100 primitives at v1.0, open-ended after). It stays
governable only if there is one place to look and near-duplicates are refused.

### III. Pure, Palette-Only, CPU-Only Primitives

A primitive's `draw` function renders with what it is handed and nothing else.

- `draw` MUST NOT perform network or file access.
- `draw` MUST colour only with `palette.bg`, `palette.fg`, and `palette.accent`. Output is
  monochrome by default; `accent` differs from `fg` only in creative mode.
- A primitive MUST read correctly in pure black and white.
- Rendering MUST use the `@napi-rs/canvas` software rasteriser. GPU rasterisers and
  `skia-canvas` are not byte-reproducible and MUST NOT be introduced.
- `reducedFlicker` MUST be honoured by any primitive that strobes or flashes.

Rationale: purity is what makes Principle I checkable, and the palette rule is what lets a
downstream quantiser or theme recolour any spec without knowing its primitives.

### IV. Specs Are Untrusted Input

An `AnimSpec` may be written by a person or by a model, and is sanitised before it renders.

- `validateAnimSpec` MUST drop layers whose type is not in the registry, clamp every param to
  its declared bounds, cap the layer count, and accept `accent` only as a hex colour.
- The `image` layer MUST NOT be accepted from a spec; it exists only for callers that supply
  a pre-loaded bitmap.
- Models author specs, never code. A model MUST be shown a deterministic subset from
  `select(kit, breadth, seed)`, about 15 to 20 primitives, however large the registry grows.
- Dropped layer types MUST be reported back to the caller, not silently discarded.

Rationale: the validator is the safety layer between LLM output and the renderer, and the
bounded subset is what keeps spec quality from degrading as the vocabulary grows.

### V. Saved Specs Keep Rendering

A spec that rendered yesterday MUST render the same frames tomorrow.

- A replacement primitive MUST land beside the one it replaces, never over it.
- A replaced primitive moves to the `legacy` tier: still rendered, never offered to a model.
- Each spec MUST record the vocabulary version it was written against.
- A primitive MUST be removed only in a major version, with a migration that rewrites old
  specs to its replacement.

Rationale: an open vocabulary invites replacement. Without this rule every improvement would
silently change someone's saved work.

### VI. One Offline Verify Command

`npm run verify` is the whole quality bar, and it runs anywhere.

- `npm run verify` MUST run `tsc` plus every gate, and MUST pass before a push.
- The suite MUST run with no network, database, or external service.
- The same command MUST run locally (the `pre-push` hook) and in CI. CI MUST NOT have checks
  that cannot be reproduced locally.
- CI MUST stay one workflow with one job, with `concurrency` cancel-in-progress and a
  5-minute timeout, no cron and no matrix. Target cost is 2 billed minutes or less per push.
- A self-hosted runner MUST NOT be used once the repository is public.

Rationale: a contributor adding a primitive needs one command that tells them whether it is
acceptable, and CI cost must not scale with contribution volume.

## Scope and Boundaries

This repository is the open contract: the `AnimSpec` format, its reference interpreter, the
primitive vocabulary, and the verification harness.

- **Out of scope, permanently:** the hosted product. Routes, storage, auth, billing, the video
  queue, streaming, AI authoring, data sources, ASR, and post-process effects stay in the
  private repository and MUST NOT be added here.
- **Provenance:** code is copied in as files with fresh history. A branch from the private
  repository MUST NOT be forked or pushed here. A secret scan MUST pass before the first
  public push.
- **Naming:** the public project name and npm package name MUST be neutral. They MUST NOT
  borrow the private product's name or any artist's name, and neither name may appear in
  code, docs, or commit messages here.
  TODO(PUBLIC_NAME): the neutral name is not yet chosen; "AnimSpec Core" is the working name.
- **Dependencies:** runtime dependencies are `@napi-rs/canvas`, `@resvg/resvg-js`, and
  `pixelarticons`. Adding a runtime dependency MUST be justified in the plan, including its
  licence and its effect on determinism, and MUST be added to `NOTICE`.
- **Platform:** Node.js 22 or later, TypeScript in `strict` mode, ES modules.
- **Licence:** Apache-2.0 (`LICENSE`, `NOTICE`). A dependency whose licence is incompatible
  with Apache-2.0 distribution MUST NOT be added.
- **Contributions:** outside contributions require a signed Contributor License Agreement.
  An outside contribution MUST NOT be merged until the CLA text and sign-up bot are in place.
- **Before going public:** a legal review of the licence and CLA MUST be complete.

## Development Workflow and Quality Gates

Every primitive, new or changed, passes the same pipeline.

**Automated gates** (run by `npm run verify`):

| Gate | Status |
| --- | --- |
| Well-formed, unique type, params within bounds | Enforced (`verify-registry.ts`) |
| Renders without throwing | Enforced |
| Listed in vocab prompt and JSON schema | Enforced |
| Validator drops unknown types and clamps params | Enforced (`verify-spec-validator.ts`) |
| Two independent renders hash identically | Enforced (`verify-determinism.ts`) |
| Hash matches the committed golden file | Enforced |
| No `Math.random` / `Date` / `performance.now` in `src/` | Enforced (static scan) |
| No network or file access in `draw` | Planned |
| Reacts to the signal: quiet and loud frames differ | Reported, not yet failing |
| Uses palette colours only | Planned |
| Under the speed budget per 1080p frame, fewer than ~3k draw calls | Planned |

A gate marked Planned or Reported is still a rule under the Core Principles. New work MUST
meet it; existing deviations are tracked debt, not precedent.

**Style review** (human, per proposal, with a GIF on the reference signal):

1. Does it use negative space rather than fill the frame?
2. Does one signal drive what you see?
3. Does every element carry information?
4. Does it work in pure black and white?

**Tiers** decide what a model is offered:

| Tier | Bar | Offered to a model |
| --- | --- | --- |
| core | Strict review | In `auto` mode |
| extended | Approved, more stylistic | Only when its kit is chosen |
| contrib | Passes the automated gates; look not guaranteed | Only when named explicitly |
| legacy | Replaced; kept so old specs render identically | Never |

**Feature work** follows the Spec Kit flow: specify, plan, tasks, implement, converge. A plan
MUST state which gates the change touches and whether golden hashes are expected to move.

## Governance

This constitution supersedes other practice in this repository. Where it conflicts with the
README or a plan, the constitution wins until it is amended.

- **Product intent** lives in the "AnimSpec Core — PRD". If the PRD and this constitution
  disagree, the disagreement is resolved by amending one of them, not by ignoring either.
- **Amendments** are made by editing this file in a reviewed change that states what changed
  and why, and that updates the version line below.
- **Versioning** follows semantic versioning: MAJOR for removing or redefining a principle,
  MINOR for adding a principle or section or materially expanding one, PATCH for wording.
- **Compliance** is checked at planning time (the Constitution Check in each plan) and again
  at analysis. A plan that violates a principle MUST record the violation and its
  justification, or be changed.
- **Complexity** MUST be justified. The default answer to a new abstraction, dependency, or
  primitive is no.
- **Runtime guidance** for day-to-day development is `README.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: 2026-09-30
