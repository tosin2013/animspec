# AnimSpec Core Constitution

## Core Principles

### I. Determinism (NON-NEGOTIABLE)

A frame is a pure function of `(AnimSpec, SignalFrame, seed)`. The same three inputs MUST
produce byte-identical RGBA pixels on every run and on every machine of the same processor
type. Across the supported processor types, no colour channel of any pixel may differ by more
than 8 out of 255. A pixel that is not fully opaque is measured as it is seen: its colour
channels weighted by its alpha, and its alpha itself, each within the same 8 out of 255.

- The supported processor types are arm64 and x64. The operating system is not part of the
  promise. Any other machine is unsupported, and a check on it MUST say so and MUST NOT report
  a pass.
- Code under `src/` MUST NOT use `Math.random`, `Date`, `performance.now`, or any other
  ambient source of variation.
- The only permitted randomness is `mulberry32` from `src/rng.ts`, seeded from the supplied
  seed (mixed with `mixSeed` where a per-frame or per-element stream is needed).
- All text MUST be drawn with a font that ships in the library. A font found on the machine
  MUST NOT be used.
- Every primitive and every composite case MUST have a committed golden hash for each
  supported processor type, in `golden/<type>/hashes.json`. The hashes for the machine's own
  type MUST match on every run of `npm run verify`, and the cross-type tolerance MUST be
  checked on every run.
- `npm run golden:update` MUST be run only when a rendering change is intended or reference
  cases are added, and the change MUST say which hashes moved or were added, and why.

Rationale: reproducibility is the product. A spec that renders differently twice cannot be
shared, tested, or trusted by the private product that depends on this package. The promise
is stated per processor type because that is what measurement shows to be true: arm64 and x64
round soft edges differently by an amount too small to see, and removing that difference
would mean changing how primitives look.

### II. The Registry Is the Single Source of Truth

`src/primitives/registry.ts` defines the vocabulary. The LLM vocabulary prompt, the JSON
schema, the validator, and interpreter dispatch MUST all be generated from it.

- Adding a primitive MUST be one registry entry (type, category, description, params, draw).
  No second list may be hand-synchronised with it.
- A new primitive MUST draw something no existing primitive can draw by changing its params.
  Otherwise the change is a new param or enum value on the existing primitive.
- Every param MUST declare its type, bounds, and default so that `sanitizeLayer` can clamp it.
- A spec-level option that is not a primitive, such as the choice of font, MAY have its own
  list outside the registry. That list MUST be the single source for the schema and validator
  entries generated from it, and MUST NOT be hand-synchronised with another.

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

This principle takes effect with the first published release of the package. Until then,
while the project is private and pre-release, an existing primitive MAY be changed in place,
provided the change is intended, its golden hashes are updated, and it is recorded as
Principle I requires. From the first published release onward:

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

### VII. Explicit Boundaries

Every specification states what the feature is responsible for and what it is not. The
project's responsibility grows only by a recorded decision, never as a side effect.

- Every `spec.md` MUST identify each of the following as its own labelled entry:
  1. the user or system outcome the feature delivers;
  2. in-scope responsibilities;
  3. out-of-scope responsibilities;
  4. external dependencies;
  5. assumptions;
  6. non-negotiable constraints.
- No entry may be omitted. External dependencies or assumptions with nothing to state MUST
  say "None". Out-of-scope responsibilities MUST name the adjacent work a reader could
  reasonably expect the feature to take on, and who or what holds it instead.
- The project's own six entries are the baseline in Scope and Boundaries. A feature's entries
  MUST fit inside that baseline, or say where they do not.
- A feature MUST NOT take on a responsibility the baseline places permanently out of scope.
  Bringing one in scope requires amending this constitution first.
- A responsibility the baseline does not list as in scope (a new kind of output, a new
  promise to callers, a new runtime dependency, a new external service, a new supported
  platform, work the caller holds today) MUST be named in the spec as a boundary change. The
  plan's Constitution Check MUST record it, and the baseline MUST be amended in the same
  change that ships it.
- A plan, task list, or implementation MUST NOT add a responsibility that is absent from the
  spec's in-scope list. If the work reveals one, the spec MUST be amended before the work
  continues.

This principle applies to every spec created or amended from version 2.1.0 onward. A spec
written earlier MUST gain the six entries the next time it is amended.

Rationale: this repository is the open half of a split with a private product, and the split
holds only while each side's responsibilities are written down. Scope that arrives unstated
cannot be reviewed, and every responsibility accepted here is one the determinism, licence,
and CI-cost promises then have to cover.

## Scope and Boundaries

This section is the project baseline: what this repository is responsible for today, taken
from the repository itself. Principle VII measures every feature against it. It has the same
six entries a spec has.

### 1. Outcome

This repository is the open contract: the `AnimSpec` format, its reference interpreter, the
primitive vocabulary, and the verification harness. It delivers four outcomes:

- A caller holding an `AnimSpec`, a `SignalFrame`, and a seed gets one frame drawn onto a
  canvas they supply, and gets the same frame every time (Principle I).
- A caller holding a spec from a person or a model gets back a sanitised spec and a report of
  what was dropped (Principle IV).
- A caller writing a model prompt gets the vocabulary text, the JSON schema, and a bounded,
  deterministic subset of primitives, all generated from the registry (Principle II).
- A contributor gets one offline command that says whether a change is acceptable
  (Principle VI).

### 2. In scope

The project is responsible for these, and for nothing that is not listed:

- **The format:** the `AnimSpec` and `SignalFrame` contracts and the JSON schema — including the per-layer `bind` map that drives any numeric param from a SignalFrame feature (`amplitude`, `energy`, `band:<n>`, `viseme`, `beat`, or a seeded `osc` oscillator), and the spec-level `camera` with per-layer `depth` (pan/zoom/push/parallax as a closed-form transform, with an optional seeded, closed-form shake, and keyframe points from -1 to 2) — and the on-disk `SignalFrame` track format with its byte-level codec (`encodeSignalTrack` / `decodeSignalTrack`), its per-frame reader (`readSignalTrackHeader` / `readSignalFrame` / `indexSignalTrackSidecar`), the optional viseme/beat extras chunk, and the committed byte-level conformance fixture under `golden/signalframe/`.
- **The reference interpreter:** drawing a single frame of a spec onto a 2D canvas context
  the caller provides.
- **The vocabulary:** the primitive registry, each primitive's params and `draw` function,
  and the vocabulary prompt and schema generated from it.
- **Validation:** `validateAnimSpec` and `sanitizeLayer`.
- **Selection:** the deterministic subset and kit selection shown to a model.
- **Seeded randomness and hashing:** `mulberry32`, `mixSeed`, `hashBytes`.
- **Shipped assets:** the fonts and icon bitmaps inside the library, their licence texts, and
  the generators that produce them.
- **Verification:** the gate scripts, the reference hashes and frames per supported processor
  type, and the log of intended reference changes.
- **Its own governance:** this constitution, the feature specs, and the spec roadmap.
- **Publishing:** building the library into an installable package named `animspec` and
  releasing it to the package registry.
- **The community site:** the VitePress site rooted at `docs/` (the home, gallery and
  contribute pages, the rendered documents), its generators (`site:generate`,
  `site:check`, `loops:generate`), the committed sample loops under `loops/`, and the
  deploy workflow. Site content is generated from the registry wherever it lists
  primitives, never hand-maintained.
- **The command-line renderer:** the `animspec` bin's `render` subcommand — rendering any
  half-open frame range of a spec + signal track to raw RGBA on stdout or a PNG folder,
  with JSON reports on stderr and stable exit codes — its packaging (`bin`/`files`), and
  its verify step.
- **Agent-assisted primitive proposals:** the Copilot cloud agent playbook (`AGENTS.md`,
  the `primitive-proposal` skill, the setup workflow) and the agent pull request guard,
  which let a maintainer turn an accepted proposal into a reviewable pull request inside
  the existing gates, rules and human review.

The public surface is what `src/index.ts` exports. A change that adds an export of a new
kind, or adds an entry to this list, is a boundary change under Principle VII.

### 3. Out of scope

- **Permanently, held by the private product:** routes, storage, auth, billing, the video
  queue, streaming, AI authoring, data sources, ASR, and post-process effects. These MUST NOT
  be added here.
- **Held by the caller today:**
  - creating the canvas and choosing its size;
  - turning audio, data, or text into `SignalFrame`s;
  - choosing the seed, the frame rate, and the order frames are drawn in;
  - encoding video from raw frames, and playing them back;
  - calling a model, and deciding what to do with the spec it returns;
  - storing specs.
- **Not promised:** output on processor types other than arm64 and x64, on a GPU rasteriser,
  or on a runtime other than the one named under constraints.
- **Held by the private project, not specified here:** recording the open-source decision,
  the evaluation of model spec quality as the vocabulary grows, and switching the private
  product to the published package.
- **Decisions, not features:** the public name, the CLA wording, and the legal review.

An item under "held by the caller today" MAY move in scope, but only through a spec that
names the move as a boundary change and an amendment to this section in the same change. The
roadmap's publishable package and command-line renderer are such moves; listing them on the
roadmap does not bring them in scope.

### 4. External dependencies

- **Runtime:** `@napi-rs/canvas` is the only runtime dependency, pinned to an exact version.
- **Build time:** `@resvg/resvg-js` and `pixelarticons` are dependencies of the icon
  generator; bitmaps derived from `pixelarticons` ship in the library.
- **Development:** `typescript`, `tsx`, and `@types/node`.
- **Shipped third-party assets:** three fonts, each with its licence text in `assets/fonts/`:
  DejaVu Sans Mono (Bitstream Vera licence), JetBrains Mono (SIL OFL 1.1), and IBM Plex Mono
  (SIL OFL 1.1).
- **Services:** none at run time and none during `npm run verify`. GitHub Actions runs the
  same verify command and nothing else; the publish workflow and the site deploy workflow
  are separate automation, never part of verify.
- **Community site (build time):** `vitepress` and its `vue` peer, devDependencies used only
  to build the site under `docs/`; they never enter the library runtime or its published
  package. The site's Mermaid diagrams render with `vitepress-plugin-mermaid` and `mermaid`,
  likewise devDependencies local to the site build. **Community site (hosting):** GitHub Pages, reached only by the site deploy
  workflow, never during `npm run verify`.
- **Agent-assisted proposals:** the GitHub Copilot cloud agent (the product this
  repository's spec 007 calls the coding agent), including its ephemeral environment,
  its firewall and its quota; and `docker/setup-qemu-action`, used only in the agent's
  setup steps to register arm64 emulation. The agent holds no credentials beyond its
  platform-issued ones: it cannot run arbitrary git commands, pushes to a single
  `copilot/` branch, and its pull requests cannot be readied, approved or merged by it.
  The agent pull request guard runs inside the verify job for agent-authored pull
  requests only, and reads the repository with `contents`, `issues` and `pull-requests`
  read permissions.
- **Package registry:** the npm registry, reached only at release time, never during
  `npm run verify`; and an npm access token held by the maintainer.
- **Documents:** the "AnimSpec Core — PRD" holds product intent (see Governance).
- **Consumers:** the private product is the first consumer. It depends on this repository;
  this repository MUST NOT depend on it.

Adding a runtime dependency MUST be justified in the plan, including its licence and its
effect on determinism, and MUST be added to `NOTICE`. A new build-time dependency, shipped
asset, or external service MUST be added to this list in the same change.

### 5. Assumptions

- The caller runs on arm64 or x64 and draws with the `@napi-rs/canvas` software rasteriser.
  The determinism promise holds only under both.
- The caller runs untrusted specs through `validateAnimSpec` before drawing them. The
  interpreter draws what it is given.
- The recorded reference frames belong to the pinned `@napi-rs/canvas` version. A version
  change is assumed to move hashes until `npm run verify` shows otherwise.
- The repository is private and pre-release. Nothing is published, and the pre-release
  allowance in Principle V applies.
- Consumers use only the public surface. Anything else under `src/` may change without
  notice.
- The gate scripts are run from the repository root.

An assumption that stops being true MUST be corrected here in the change that makes it
untrue.

### 6. Non-negotiable constraints

The Core Principles are constraints on every feature. In addition:

- **Provenance:** code is copied in as files with fresh history. A branch from the private
  repository MUST NOT be forked or pushed here. A secret scan MUST pass before the first
  public push.
- **Naming:** the public project name and npm package name MUST be neutral. They MUST NOT
  borrow the private product's name or any artist's name, and neither name may appear in
  code, docs, or commit messages here.
  TODO(PUBLIC_NAME): the neutral name is not yet chosen; "AnimSpec Core" is the working name.
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
| Frames are order-independent (forward / backward / interleaved and contiguous chunks, fresh child processes, non-default params) | Enforced (`verify-determinism.ts`) |
| SignalFrame track round-trips and renders identically | Enforced (`verify-signalframe.ts`) |
| The committed `.asft` conformance fixture matches the encoder's bytes, its pinned hash and pinned values, and per-frame reads equal whole-track reads | Enforced (`verify-signalframe.ts`) |
| Hash matches the committed golden file | Enforced |
| Hashes match the reference set for this machine's processor type | Enforced (`verify-determinism.ts`) |
| Within the cross-type tolerance of the other processor type | Enforced (`verify-determinism.ts`) |
| Text uses only fonts shipped in the library | Enforced (`verify-determinism.ts`) |
| Font data is up to date | Enforced (`verify-determinism.ts`) |
| Every primitive has a valid tier; kits offer only core and extended primitives; a legacy primitive names its replacement | Enforced (`verify-registry.ts`) |
| The vocabulary version rises when the vocabulary changes | Enforced (`verify-registry.ts`) |
| No `Math.random` / `Date` / `performance.now` in `src/` | Enforced (static scan) |
| No network or file access in `draw` | Enforced (`verify-gates.ts`, and a static scan) |
| Reacts to the signal at a fixed moment: level or text changes the output | Enforced (`verify-gates.ts`) |
| Uses palette colours only | Enforced (`verify-gates.ts`) |
| At most 3,000 drawing operations and 50 ms per 1080p frame | Enforced (`verify-gates.ts`) |
| A whole composition at the 12-layer cap, with a camera, costs at most 12,000 drawing operations and 200 ms per 1080p frame | Enforced (`verify-gates.ts`) |
| The command renders a range byte-identically to the in-process render, with drop reports, a manifest and stable exit codes | Enforced (`verify-cli.ts`) |
| Per-layer signal binds drive numeric params from the frame deterministically; malformed binds drop and report; bound chunks equal the whole render | Enforced (`verify-spec-validator.ts`, `verify-determinism.ts`) |
| The camera is a closed-form transform; parallax `depth` separates layers; malformed cameras drop and report; camera chunks equal the whole render; the shake is closed-form and chunk-stable, scaled by depth under parallax | Enforced (`verify-spec-validator.ts`, `verify-determinism.ts`) |
| The track's optional viseme/beat extras chunk round-trips bit-identically, and `viseme`/`beat` bind sources drive params from those fields | Enforced (`verify-signalframe.ts`, `verify-spec-validator.ts`, `verify-determinism.ts`) |
| Every primitive has its committed thumbnail, loop and site copies, and the generated site files are fresh | Enforced (`site:check`) |

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

**Feature work** follows the Spec Kit flow: specify, plan, tasks, implement, converge. A spec
MUST carry the six boundary entries of Principle VII before planning starts. A plan MUST
state which gates the change touches, whether golden hashes are expected to move, and
whether the change alters the project's boundary.

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
  justification, or be changed. Analysis MUST also confirm that the plan and tasks stay
  inside the spec's in-scope list.
- **Complexity** MUST be justified. The default answer to a new abstraction, dependency, or
  primitive is no.
- **Runtime guidance** for day-to-day development is `README.md`.

**Version**: 3.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: 2026-10-23

Amended in spec 006 (community pages site): the community site joined the in-scope baseline,
and GitHub Pages plus the VitePress devDependencies joined the external dependencies. The
library's runtime surface, `npm run verify` and the gates are unchanged. Amended again the same
day, PATCH: the site's Mermaid rendering added `vitepress-plugin-mermaid` and `mermaid` to the
community-site build-time dependency entry. Amended in spec 007 (Copilot primitive agent): the
agent-assisted proposal path joined the in-scope baseline, and the GitHub Copilot cloud agent
with its setup action joined the external dependencies. `npm run verify` and the gates keep
their behavior for every pull request that is not agent-authored; the verify workflow gains
only a step that runs for agent-authored pull requests, enforcing the allowed change set and
the signer-of-record licence rule. Amended 2026-10-11 (maintainer gate fix, no spec): the
gates table gains the site check, so `npm run verify` now fails unless every primitive has
its committed thumbnail under `gallery/`, its loop under `loops/` and its copies under
`docs/public/`, with the generated site files fresh. No principle, no runtime dependency and
no CI job changed; Principle VI already required verify to run every gate, and this closes the
gap where those outputs were allowed but not required. Version MINOR: the Quality Gates
section materially expands. Amended 2026-10-17 (issue #32 frame-order independence, no spec):
the gates table gains the frame-order-independence check in `verify-determinism.ts`, which
renders a short sequence forwards, backwards and as interleaved chunks and fails any primitive
whose frame hash depends on render order. No principle, no runtime dependency and no CI job
changed; the check states and enforces a corollary of Principle I already implied by "a frame is
a pure function of `(AnimSpec, SignalFrame, seed)`". Version MINOR: the Quality Gates section
materially expands. Amended 2026-10-17 (spec 008 SignalFrame track format): the on-disk
`SignalFrame` track format and its byte-level codec (`encodeSignalTrack` / `decodeSignalTrack`)
join the in-scope baseline and the public surface — a new kind of export, so a boundary change
under Principle VII — and the Quality Gates table gains the round-trip gate
(`verify-signalframe.ts`). No principle, no runtime dependency and no CI job changed; the codec
is byte-level so `src/` keeps no file or network import, and the gate runs inside the one
offline `npm run verify`. Version MINOR: the Scope and Boundaries and Quality Gates sections
materially expand. Amended 2026-10-18 (issue #55 fresh-process order checks, no spec): the
frame-order-independence gate extends from forward / backward / interleaved chunk orderings
to also cover reversed contiguous chunks, generated non-default params (built mechanically
from the registry's param declarations, so no second list is hand-synchronised), and fresh
child processes — each contiguous half of the sequence is rendered by its own `node --import
tsx` child and compared with the in-process render — with self-checks for both the
stateful-renderer rejection and the warm-up-state rejection. Verification only: no principle
changed, no runtime dependency, no rendering change, no golden hashes moved and no CI job
changed; the children render locally with no network inside the one offline `npm run verify`
(measured cost of the new checks: about 1.5 s against the 2-billed-minute target). Version
MINOR: the Quality Gates section materially expands. Amended 2026-10-18 (spec 011
SignalFrame per-frame reader): the per-frame reader API (`readSignalTrackHeader` /
`readSignalFrame` / `indexSignalTrackSidecar`) and the committed byte-level conformance
fixture under `golden/signalframe/` join "The format" in the in-scope baseline and the
public surface — a new kind of export, so a boundary change under Principle VII — and the
Quality Gates table gains the committed-fixture check in `verify-signalframe.ts`. The
on-disk format, version 1 and the precision rule are unchanged; no rendering change, so no
golden render hash moves; `npm run verify` stays the one offline command, and `src/` keeps
no file or network import. Version MINOR: the Scope and Boundaries section materially
expands. Amended 2026-10-18 (spec 010 command-line renderer): the `animspec render`
command joins the in-scope baseline and the package surface (`bin`/`files`) — writing
image frames moves from held-by-the-caller into this repository's scope, a boundary move
Principle VII names in the spec and this amendment ships in the same change — and the
Quality Gates table gains the CLI step (`verify-cli.ts`), which spawns the built command
and proves a range byte-identical to the in-process render. The command lives outside
`src/`, so the purity scan and the library's runtime surface are unchanged; video encoding
and playback remain held by the caller; no new runtime dependency; `npm run verify` stays
the one offline command in one job. Version MINOR: the Scope and Boundaries section
materially expands. Amended 2026-10-18 (spec 013 per-layer signal bindings): the AnimSpec
contract gains the optional per-layer `bind` map — any numeric param can be driven each
frame from a SignalFrame feature (`amplitude`, `energy`, `band:<n>` or a seeded `osc`
oscillator), evaluated in the interpreter and clamped to the registry bounds; malformed
binds are dropped and reported by the validator, and specs without `bind` render
byte-identically. A contract change under Principle VII, so the baseline's "The format"
entry and the Quality Gates table are amended in the same change that ships it. No new
export, no new runtime dependency, no rendering change and no golden render hash moves;
`VOCABULARY_VERSION` is untouched (a format change, not a vocabulary change). Version
MINOR: the Scope and Boundaries section materially expands. Amended 2026-10-18 (spec 014
camera and parallax): the AnimSpec contract gains a spec-level `camera` (two keyframes,
`static`/`pan`/`zoom`/`push`/`parallax`, `linear`/`smooth` ease) and a per-layer `depth`
(0..1) that scales the camera under parallax — a closed-form transform applied around each
layer's draw, so any frame or chunk renders alone and specs without `camera` render
byte-identically. A contract change under Principle VII: the baseline's "The format" entry
and the Quality Gates table are amended in the same change that ships it. No new export,
no new runtime dependency, no rendering change and no golden render hash moves;
`VOCABULARY_VERSION` is untouched. Version MINOR: the Scope and Boundaries section
materially expands. Amended 2026-10-18 (spec 015 SignalFrame viseme and beat): the
`SignalFrame` contract gains optional `viseme` (mouth-shape index 0..14) and `beat` (onset
strength 0..1) fields, carried by an optional ASFT extras chunk gated by the header's
former reserved u16 (now a flags field) — the version stays 1, a track without them is
byte-identical to today, and the committed conformance fixture gains the chunk. The fields
join the spec-013 binding sources, so primitives stay unchanged. A contract change under
Principle VII: the baseline's "The format" entry and the Quality Gates table are amended
in the same change that ships it. No new export, no new runtime dependency, no rendering
change and no golden render hash moves; `VOCABULARY_VERSION` is untouched. Version MINOR:
the Scope and Boundaries section materially expands. Amended 2026-10-23 (issue #93): the Quality Gates
table gains the whole-composition budget gate, which draws specs at the validator's 12-layer
cap (the two 12-layer reference composites, one under a parallax camera, and the twelve
primitives with the most drawing operations) through the interpreter and bounds each at
12,000 drawing operations and 200 ms per 1080p frame. No scope change, no new export, no
rendering change and no golden render hash moves; `VOCABULARY_VERSION` is untouched. Version
MINOR: a quality gate is added. Amended 2026-10-23 (spec 016 camera shake and range): the
spec-level camera gains an optional `shake` (`amp` 0..0.05 of the frame, `freq` above 0 to
5 per second), two seeded sines per axis evaluated at the frame's time, applied in frame
pixels and scaled by `depth` under parallax, so any frame or chunk renders alone and a
camera without a shake renders byte-identically; keyframe `x`/`y` widen from 0..1 to -1..2.
A malformed shake is dropped and reported while the camera is kept. No scope change (the
camera is already in the format), no new export, no new runtime dependency and no golden
render hash moves (nine camera reference cases are added per set); `VOCABULARY_VERSION` is
untouched. One recorded exception to Principle V, justified in the spec 016 plan: a spec
stored unvalidated with a keyframe outside 0..1 now renders at its stated position once
validated. Version MINOR: the format entry and the camera gate row are amended. Amended 2026-10-23 (spec 017
analysis, Principle I): the cross-type tolerance now says how a pixel that is not fully
opaque is measured: its colour channels weighted by its alpha, and its alpha itself, each
within 8 out of 255. Fully opaque pixels are measured exactly as before, so every existing
reference case and its result is unchanged. Why: a transparent frame (spec 017) gives a
pixel at 1/255 opacity a full-strength colour, and the processor types round such a pixel to
different colours (pure red against white in the accent case) although what a viewer sees
differs by about 2. The raw colour of a nearly invisible pixel carries no visible meaning.
Version MAJOR: a principle's measurement is redefined.
