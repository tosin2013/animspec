# Feature Specification: Community Pages Site

**Feature Branch**: `006-community-pages`

**Created**: 2026-10-09

**Status**: Shipped 2026-10-09: merged as PR #13 and deployed by the Site workflow to https://tosin2013.github.io/animspec/

**Input**: User description: "we may need to create a github page for this repo with the goal of getting community contributors". The repository is public and the package is on npm (005 shipped); this feature gives the project a public website whose job is to convert visitors into contributors.

## User Scenarios & Testing *(mandatory)*

The repository is public, but a visitor who lands on GitHub sees a file listing, not the project. The
determinism promise is buried in the README, the 29 primitives are buried in a folder, and the
contribution path is buried in CONTRIBUTING.md. A GitHub Pages site built with VitePress puts the
promise, the pictures, the path and the documentation itself on reachable pages. The site renders
the repository's own markdown files, and regenerates its gallery from the registry so it cannot
drift.

### User Story 1 - A visitor understands the project in one minute (Priority: P1)

A visitor lands on the site and sees what animspec is, the determinism promise stated as a table,
the one-line install, and a runnable five-line example. Within one minute they know what the
library does and how to try it.

**Why this priority**: Nothing else works if the landing page does not. Every other story links
back to it, and it is the page the README, the npm page and any shared link point at first.

**Independent Test**: The site is published at the repository's Pages URL and the landing page
states the promise, the install command and links to the user guide.

**Acceptance Scenarios**:

1. **Given** the site root, **When** a visitor loads it, **Then** the determinism promise and the `npm install animspec` command are visible without scrolling below two viewport heights.
2. **Given** the landing page, **When** a visitor clicks the quick-start code block's neighbourhood, **Then** they can copy the example and the links to the user guide and the API surface work.
3. **Given** any page on the site, **When** it loads, **Then** it makes no network request outside the site itself: no CDN, no analytics, no external fonts.

---

### User Story 2 - A visitor sees what the library draws, moving (Priority: P2)

A visitor opens the gallery page and sees one card per primitive: the reference thumbnail, the
type name, the category, the tier, and a link to the primitive's source. Each card also plays a
short animated loop, rendered by the library itself, so the page shows the vocabulary in motion
rather than as stills. The page is generated from the registry and the committed gallery
thumbnails and loops, so it always matches what the library renders.

**Why this priority**: The gallery is the proof that the vocabulary is real and varied, and the
loops are the proof that it is alive. A visual library sells itself with motion, and the one
page a hand-written site could not keep honest as the registry grows.

**Independent Test**: `npm run site:generate` emits the gallery page, and every primitive in the
registry appears on it with its thumbnail and its loop.

**Acceptance Scenarios**:

1. **Given** the registry, **When** the gallery page is generated, **Then** it contains one card per primitive, ordered deterministically, each with a thumbnail, an animated loop, and a link to that primitive's entry in the registry source.
2. **Given** a new primitive merged with its gallery thumbnail (already enforced by the registry gate), **When** the loops are regenerated and the site with them, **Then** the new primitive appears, animating, without any hand edit to the site.
3. **Given** the generated gallery output, **When** `npm run site:check` runs against the committed files, **Then** it fails if the committed output is stale.

---

### User Story 3 - A would-be contributor finds the path in (Priority: P2)

A developer who wants to contribute opens the contribute page and finds the whole path: the
new-primitive rule, the four style questions, the gates behind `npm run verify`, the CLA
requirement, the proposal issue template, and the `good first primitive` label. From the landing
page, the proposal template is at most two clicks away.

**Why this priority**: The site exists to get contributors (the M2 milestone is 50 primitives,
mostly from outside). The path already exists in CONTRIBUTING.md; the site's job is to surface it.

**Independent Test**: The contribute page states the rule and rubric and links the template, the
CLA and CONTRIBUTING.md; the click depth from the landing page to the proposal template is two or
fewer.

**Acceptance Scenarios**:

1. **Given** the contribute page, **When** a visitor reads it, **Then** the new-primitive rule and the four style questions are stated and link to CONTRIBUTING.md as the source of truth.
2. **Given** the landing page, **When** a visitor follows nav links, **Then** they reach the primitive-proposal issue template in at most two clicks.
3. **Given** the contribute page, **When** a visitor looks for the licence gate, **Then** the CLA requirement and its link are stated before the pull-request step.

---

### User Story 4 - The site publishes itself (Priority: P1)

A maintainer pushes a change to `main` that touches the site or the gallery. A separate workflow
regenerates the site, checks it, and deploys it to GitHub Pages. The verify workflow is untouched:
still one workflow, one job, offline.

**Why this priority**: A site that needs hand deployment rots, and a site that entangles itself
with verify breaks the constitution's CI-cost promise. Separate, paths-filtered automation is
the publish-workflow pattern this repository already uses.

**Independent Test**: Pushing a gallery-affecting change triggers the deploy workflow and the
Pages URL shows the new thumbnail; pushing an unrelated change triggers no deploy.

**Acceptance Scenarios**:

1. **Given** a push to `main` that changes `docs/`, `gallery/`, `VOCABULARY.md`, the generator, the site config, or the workflow itself, **When** CI runs, **Then** the deploy workflow runs, regenerates the site, runs the check, builds it, and deploys.
2. **Given** a push to `main` that changes none of those paths, **When** CI runs, **Then** the deploy workflow does not run and adds zero billed minutes.
3. **Given** the verify workflow and `npm run verify`, **When** this feature ships, **Then** they are byte-identical to before: no new gate, no new trigger, no new job.

### Edge Cases

- **A contributor adds a primitive but forgets to regenerate the site**: the deploy workflow runs
  `npm run site:check` and fails the deploy until the regeneration is committed, the same pattern
  as `fonts:generate --check` and the icon staleness checks.
- **A primitive without a gallery thumbnail**: impossible to merge; the registry gate already
  fails the pull request before the site is affected.
- **Repository growth from the loops**: the loops add a few megabytes at 29 primitives and grow
  with the vocabulary; the loop generator keeps frames small (low resolution, short cycle) and
  the size is revisited when the registry approaches the v1.0 target of 100 primitives.
- **GitHub Pages is not enabled, or Source is not set to GitHub Actions**: the deploy workflow
  fails with the platform's message; the one-time enablement is documented in quickstart.md and
  held by the maintainer.
- **The registry grows to 100+ primitives**: the gallery page stays a flat grid of cards; one
  page holds the full vocabulary by design (the site is a catalogue, not a gallery app).
- **A site contribution from outside**: it is a code contribution; the CLA gate applies to it the
  same as to any other.
- **A private-product or artist name in site copy**: forbidden by the constitution's naming
  constraint; the copy review catches it, same as anywhere else in the repository.

## Requirements *(mandatory)*

### Functional Requirements

**Publishing**

- **FR-001**: The site MUST be published at the repository's GitHub Pages URL by a custom Actions workflow, with the Pages publishing source set to GitHub Actions.
- **FR-002**: The deploy workflow MUST be separate from the verify workflow, triggered only by pushes to `main` that change site-affecting paths (`docs/`, `gallery/`, `VOCABULARY.md`, the generator, the site config, the workflow itself, and the build's `package.json` and lockfile) plus manual dispatch.
- **FR-003**: The deploy workflow MUST regenerate the site, run the site check, and run the site build before uploading, and MUST deploy only the built output.
- **FR-004**: This feature MUST NOT change `npm run verify`, the verify workflow, or any gate: no new gate, no new trigger, no new job.

**Content**

- **FR-005**: The home page MUST state the determinism promise, the `npm install animspec` command, a runnable quick-start example, and links to the user guide, the software design document and the contribute page.
- **FR-006**: The gallery page MUST contain one card per primitive in the registry, generated from the registry and the committed gallery thumbnails: image, type, category, tier, and a link to the registry source. No hand-maintained primitive list.
- **FR-007**: The contribute page MUST state the new-primitive rule and the four style questions, and link CONTRIBUTING.md, the primitive-proposal template, the CLA and `good first primitive`. CONTRIBUTING.md remains the source of truth; the page summarises and links, never restates differently.
- **FR-008**: Every page MUST be self-contained: no external network requests. Search MUST be local and bundled. Fonts MUST be the theme's system stack or the repository's own shipped font files (with their licence texts), never an external origin.
- **FR-013**: The site MUST render the repository's existing documentation as pages: the user guide, the deployment runbook, the software design document, VOCABULARY.md and CONTRIBUTING.md. The markdown files MUST be the same committed files, not copies: the site reads one source with the repository.

**Generation and integrity**

- **FR-009**: `npm run site:generate` MUST regenerate every generated site file (the gallery page and the copied public assets) from the registry and `gallery/`, deterministically: no clock, no randomness, stable ordering.
- **FR-010**: `npm run site:check` MUST fail when the committed generated files differ from what regeneration would produce.
- **FR-011**: The deploy workflow MUST run `npm run site:check` and `npm run site:build` and fail the deploy on either failing.
- **FR-014**: `npm run loops:generate` MUST render one animated GIF loop per primitive (committed under `loops/`): the library draws every frame, deterministically, with a fixed seed and a synthetic signal; encoding uses the `GifEncoder` of the existing `@napi-rs/canvas` dependency, and no new dependency is added. The site MUST show a loop on the gallery page for every primitive and at least one on the home page.
- **FR-015**: `README.md` MUST link the site and at least one sample loop.

**Governance**

- **FR-012**: The constitution baseline MUST be amended in the same change that ships the site: the community site added to in-scope, VitePress added as a development dependency and GitHub Pages added to external dependencies, version bumped.

### Key Entities

- **SitePage**: one page at a fixed path; handwritten markdown (`index`, `contribute`), generated markdown (`gallery`), or a rendered document page (the existing docs).
- **DocPage**: a site page rendered from a committed repository document; the file is the source, the site adds only a reading experience over it.
- **PrimitiveCard**: the gallery unit; derived from one registry entry plus its committed thumbnail and animated loop; exactly one per primitive, by generation rather than by maintenance.
- **AnimationLoop**: a short GIF, one per primitive, drawn frame by frame by the library with a fixed seed and a synthetic signal; a generated asset committed under `loops/`, never hand-edited.
- **ContributeStep**: one ordered step of the contribution path; content links to CONTRIBUTING.md, never duplicates it as a second source.
- **SiteAsset**: a file served by the site (theme assets, fonts with licence texts, copied thumbnails); all stored in the repository or built from it, none fetched externally.
- **DeployRun**: one execution of the deploy workflow; input is a site-affecting push, output is a Pages deployment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Pages URL serves the site, and a site-affecting push deploys in at most 3 minutes.
- **SC-002**: The primitive-proposal issue template is reachable from the landing page in at most 2 clicks.
- **SC-003**: 100% of registry primitives appear on the gallery page (29 of 29 at v1), each with a thumbnail.
- **SC-004**: Page load makes 0 external network requests (verify by opening dev-tools network tab on the offline-loaded site).
- **SC-005**: `npm run site:check` passes on `main` at all times; no generated site file is hand-edited.
- **SC-006**: The verify workflow file and `npm run verify` are unchanged by this feature (diff is empty).
- **SC-007**: Every primitive animates on the gallery page (29 loops at v1), each rendered by the library with a fixed seed.
- **SC-008**: `README.md` links the site and at least one sample loop, and the site links back to the repository.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a visitor**: they understand the project in one minute, see what it draws, and reach the contribution path in two clicks.
- **For a contributor**: the site hands them the rule, the rubric, the gates and the CLA before they open a pull request.
- **For the project**: a public front door that stays in sync with the registry because it is generated, not maintained.

### In scope

- A VitePress site rooted at `docs/`: the VitePress config and theme under `docs/.vitepress/`, a handwritten home page and contribute page, one generated gallery page, and the existing documentation rendered as pages.
- Animated GIF loops, one per primitive, rendered by the library (`npm run loops:generate`), committed under `loops/`, and shown on the site; the README links the site.
- `npm run site:generate`, `npm run site:check`, `npm run site:dev`, `npm run site:build` and `npm run loops:generate`, two generator scripts, VitePress as a devDependency.
- One deploy workflow (`.github/workflows/site.yml`), separate automation, paths-filtered.
- The one-time GitHub Pages enablement (a settings flip, documented in quickstart.md).
- The constitution baseline amendment that this feature requires.

### Out of scope

- An in-browser renderer or interactive playground: the library renders through a native CPU rasteriser; a browser port would be a new renderer with its own determinism story. Held by: no one today; it would need its own spec and a recorded decision.
- A custom domain, analytics, SEO work and a CMS: not needed to get contributors. Held by: the maintainer, by decision not to.
- **Build AnimSpec Live**, the conversational demo application (chat, a Node render service streaming frames, vocabulary-gap issue filing): a real application with a server, held by its own repository, which consumes `animspec` from npm. This project only links to it when it exists. AI authoring and streaming are permanently outside this repository's baseline (constitution, out of scope).
- Editing the rendered documents' content: the site is a reading experience over the committed markdown; content changes keep going through the documents themselves. Held by: the normal documentation review.
- The command-line renderer (roadmap 007) and primitive batches (roadmap 008+): adjacent roadmap work, untouched here.
- Changing how anything draws, the registry, or the gates: untouched.

### External dependencies

- **GitHub Pages**: the hosting service, including its Actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`). A new external service for this project, named here as a boundary change.
- **VitePress and its Vue peer** (both MIT): new devDependencies, chosen by the owner over a hand-rolled site. They never enter the library's runtime or its published package; their generated assets ship only in the site artifact.
- **GitHub Actions minutes** for the deploy workflow: GitHub-hosted, paths-filtered, no self-hosted runner.
- Nothing else new: the generator uses what is already installed, and the site loads nothing from any external origin.

### Assumptions

- The maintainer enables GitHub Pages with source "GitHub Actions" once; the feature documents the steps but cannot flip the setting.
- The Pages URL stays the default `https://tosin2013.github.io/animspec/` (no custom domain), so internal links are relative.
- The gallery thumbnails committed by `gallery:generate` are the images the site shows; the site adds no rendering of its own.
- Site contributions are code contributions: the CLA gate, secret scan and CI apply to them unchanged.
- The private product remains unnamed everywhere on the site (constitution naming constraint).

### Non-negotiable constraints

- **Constitution Principle VI**: verify stays one workflow, one job, offline; the deploy workflow is separate automation, never part of verify, paths-filtered so typical pushes add zero billed minutes.
- **Constitution Principle II**: the gallery page is generated from the registry; no second, hand-synchronised primitive list.
- **Constitution Principle VII**: the site is a new kind of output and GitHub Pages is a new external service; the baseline is amended in the same change that ships it.
- **Licence and naming**: Apache-2.0; the public name stays `animspec`; no private-product or artist name in any site copy.
- **CLA**: outside site contributions merge only with a signed CLA, enforced by the existing gate.