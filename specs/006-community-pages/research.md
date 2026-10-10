# Research: Community Pages Site

Phase 0 output for [spec.md](spec.md). Each entry names the decision, the rationale, and the
alternatives considered. No entry below is a NEEDS CLARIFICATION; all are resolved.

## R1: Hosting service

**Decision**: GitHub Pages, with the publishing source set to a custom Actions workflow.

**Rationale**: The repository already lives on GitHub, and Pages is included for public
repositories with no new account, no new bill and no new vendor. Deploying through Actions
(`actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`) is
GitHub's documented first-party path and needs only `permissions: pages: write,
id-token: write` and the `github-pages` environment.

**Alternatives considered**:
- Netlify or Vercel: a second vendor account and token for no benefit at this scale. Rejected.
- A branch-based deploy (commit output to `gh-pages`): keeps the site in sync only by manual
  discipline or a second script; the Actions path regenerates on every site-affecting push.
  Rejected as the primary mechanism; remains the fallback if Actions deploy is ever blocked.
- Self-hosting: a server to operate, for a static site. Rejected.

## R2: Site generator

**Decision**: VitePress, as a devDependency of the repository. The site root is `docs/` itself:
`docs/.vitepress/` holds the config and theme tweak, the landing and contribute pages are
markdown files beside the existing three documents, and VitePress consumes every markdown file in
`docs/` directly. The gallery page remains generated (R4).

**Rationale**: The user chose a known documentation theme over a hand-rolled stylesheet
(direction recorded 2026-10-09). Among the SSGs, VitePress fits this repository best: it is
markdown-first (the existing docs are already markdown), its config is a TypeScript file (the
repository is TypeScript strict ESM), it builds static output with all assets local, its built-in
search is bundled (self-containment holds), and it is the tool used by Vite, Vitest and Rollup
for exactly this shape of library documentation. Making `docs/` the site root means the site
renders the repository's real documentation files, not copies: one source, zero drift, and the
old out-of-scope line ("rendering the markdown docs") comes into scope.

**Costs, accepted**: new devDependencies (`vitepress` and its peer `vue`, both MIT,
Apache-2.0-compatible) and a Node build in the deploy workflow. The constitution's default answer
to a new dependency is no; this decision overrides it by the owner's choice, and is recorded
here, in the spec's external dependencies, and in the baseline amendment (R8). Nothing enters
the library's runtime: `vitepress` is a devDependency, its generated assets ship only in the
site artifact, and the library package's `files` list does not change.

**Alternatives considered**:
- Handwritten HTML (the previous plan): no dependency, but the owner chose known-theme polish;
  a hand-rolled stylesheet is ours to maintain and ages alone. Superseded.
- Jekyll with a GitHub-supported theme: server-built, but our markdown is not front-mattered for
  it, the gallery fights the theme, and Jekyll is a Ruby toolchain in a TypeScript repository.
  Rejected.
- Starlight (Astro): strong, but its content collections want documents moved under its own
  tree, which re-introduces copying or symlinks. Rejected for shape, kept as the fallback if
  VitePress ever blocks us.
- Docusaurus: its strengths (versioning, i18n, MDX) are not needed for three content pages and
  five documents. Rejected as too heavy.

## R3: Deployment automation and CI-cost posture

**Decision**: A separate workflow, `.github/workflows/site.yml`, triggered by pushes to `main`
filtered to site-affecting paths (`docs/**`, `gallery/**`, `VOCABULARY.md`,
`scripts/generate-site.ts`, the workflow itself, and `package.json`/`package-lock.json` because
the build depends on them) plus `workflow_dispatch`. One job on `ubuntu-latest`: checkout,
Node 22, `npm ci`, `npm run site:generate`, `npm run site:check`, `npm run site:build`, then
configure, upload the built output, deploy. It never runs on pull requests.

**Rationale**: Verify stays one workflow with one job (constitution Principle VI); the deploy
workflow is separate automation, the pattern the repository already records for `publish.yml`
in RELEASING.md. The paths filter holds the cost promise: a typical push (a primitive, a gate)
triggers nothing. Running the regeneration and the build inside the deploy means the published
gallery can never be stale, even when a contributor forgets. The Node build adds about a minute
to site-affecting pushes only; public-repository Actions minutes are free, and the filter keeps
typical pushes at zero anyway.

**Alternatives considered**:
- Extending verify.yml with a deploy job: violates one-workflow-one-job and entangles the
  offline guarantee with a network deployment. Rejected.
- Deploying on every push without a paths filter: adds billed minutes proportional to
  contribution volume, which Principle VI exists to prevent. Rejected.
- Manual dispatch only: the site rots behind human memory. Rejected.
- GitHub's server-side Jekyll build (no workflow of ours): only available to the Jekyll path
  this repository no longer takes (R2). Mooted.

## R4: Gallery page generation

**Decision**: `scripts/generate-site.ts` reads `PRIMITIVES` from
`src/primitives/registry.ts` and the committed `gallery/*.png` thumbnails, and emits the gallery
page as markdown (`docs/gallery.md`) plus copied thumbnails under `docs/public/gallery/`, which
VitePress serves as static assets. Ordering is stable (registry order), output is deterministic
(no clock, no randomness), and `--check` mode fails when the committed files are stale.
`npm run site:generate` and `npm run site:check` are the two npm aliases, following
`gallery:generate` and the `--check` precedents of `fonts:generate` and `icons:generate`.

**Rationale**: Constitution Principle II forbids a second, hand-synchronised primitive list; the
gallery page is that list if anyone types it by hand. Generation from the registry reuses the
single source of truth. Emitting markdown lets VitePress theme the gallery with zero custom
components: the generator writes a page of card blocks and the theme styles it.

**Alternatives considered**:
- A hand-maintained gallery page: forbidden by Principle II as soon as the registry grows.
  Rejected.
- A Vue component fed a JSON data file: more moving parts for one grid; the markdown page plus
  theme CSS is enough. Deferred unless the cards grow interactive.
- Rendering thumbnails in the browser from specs: no browser rasteriser exists, and the library's
  determinism promise belongs to its own native renderer. Rejected.

## R5: Self-containment and fonts

**Decision**: Every page loads only same-origin files. VitePress's default theme ships all its
CSS, JS, icons and the local search index inside the built output, so the self-containment rule
holds with the stock theme. Typography uses the theme's system font stack; the repository's
shipped fonts are added as an optional `@font-face` layer (committed under `docs/public/fonts/`
with their licence texts) so the site can echo the library's "shipped fonts only" story. No CDN,
no analytics, no external requests of any kind.

**Rationale**: The library's promise is that text comes from shipped fonts, never the machine;
the site can tell that story with the same files. A page with zero external requests loads fast,
works offline once fetched, and never breaks when a third-party CDN moves. VitePress's local
search (the default) is bundled, keeping the rule intact; remote search (Algolia-style) would
violate it and is not configured.

**Alternatives considered**:
- Google Fonts or another font CDN: a network dependency and a privacy cost. Rejected.
- Making the shipped fonts mandatory: an extra build consideration for chrome that the system
  stack already renders well; shipped fonts become an opt-in layer instead. Rejected as
  mandatory, kept as optional.

## R6: Site content at v1

**Decision**: VitePress with its default theme, site root `docs/`. Content: a home page
(`docs/index.md`, the landing with the promise and the install), the generated gallery
(`docs/gallery.md`), a contribute page (`docs/contribute.md`), and the existing documentation
rendered as pages: the user guide, the deployment runbook, the software design document,
VOCABULARY.md, CONTRIBUTING.md. The markdown files are the same committed files, not copies; the
theme adds a sidebar and a nav, and CONTRIBUTING.md stays the source of truth for the rules the
contribute page summarises.

**Rationale**: The site's only job is to get contributors (spec outcome). The SSG choice brings
the documentation rendering into scope at no duplication cost: one markdown home, and the site
is the reading experience over it. The home page, gallery and contribute page cover understand,
see, act.

**Alternatives considered**:
- Handwritten pages linking to GitHub for docs (the previous plan): superseded by the SSG
  decision; the docs render in the site now.
- A blog or news page: nobody to feed it yet. Rejected.
- An interactive spec playground: needs a browser renderer that does not exist. Rejected, named
  in the spec's out-of-scope with its holder.

## R7: Integrity checking

**Decision**: Two layers, both outside `npm run verify`. The generator's `--check` mode
(`npm run site:check`) fails when committed generated output is stale or hand-edited, and runs in
the deploy workflow before the build. The VitePress build itself is the second layer: a broken
link in the nav or a malformed page fails `npm run site:build`, which the deploy workflow runs
before uploading. Manual checks in quickstart.md cover self-containment (dev-tools network tab
empty) and click depth.

**Rationale**: The repository's quality bar is `npm run verify`, which this feature must not
change (FR-004, SC-006). A staleness check plus a compile step in the deploy path gives the site
two cheap gates without touching the gates that guard the library.

**Alternatives considered**:
- Adding site checks to `npm run verify`: changes the constitution's quality bar for a static
  site. Rejected; verify stays untouched.
- An HTML link crawler over the built output: VitePress's build plus the small page count makes
  this redundant at v1. Deferred.

## R8: Governance: the boundary change

**Decision**: The spec names the site (new output kind) and GitHub Pages (new external service)
under Principle VII, and the implementing change amends the constitution baseline in the same
change: add the community site to in-scope, add GitHub Pages to external dependencies, bump the
constitution version 2.3.0 to 2.4.0.

**Rationale**: Principle VII requires the baseline to move in the same change that ships the
responsibility, and the governance section sets MINOR for materially expanding a section.

**Alternatives considered**:
- Treating the site as "not really a responsibility": exactly the unstated scope creep Principle
  VII exists to stop. Rejected.
- Amending the baseline now, before the implementation exists: the constitution says the
  amendment ships in the same change as the feature, not the plan. Deferred to the tasks.

## R10: Showing the library working: sample loops

**Decision**: `npm run loops:generate` renders one animated GIF loop per primitive into a new
top-level `loops/` directory: each loop is a short cycle of frames drawn by the library with a
fixed seed and a synthetic signal, encoded with the `GifEncoder` of the existing
`@napi-rs/canvas` dependency. The site generator copies the loops into `docs/public/loops/`,
the gallery page plays one on every card, and the home page shows at least one. The README links
the site and a sample loop.

**Rationale**: The owner wants examples a visitor can see working, even in the README. The
renderer cannot run in a browser (native CPU rasteriser) and GitHub Pages serves static files,
so the only way to show motion on the site is to render it offline and commit it, exactly the
pattern the repository already uses for gallery thumbnails and golden frames. The loops are
rendered by the committed library, deterministically, which is the stronger claim: every moving
pixel on the site was drawn by this code, and any machine can regenerate it byte for byte.
Encoding needs no new dependency: `GifEncoder` ships inside `@napi-rs/canvas`.

**Alternatives considered**:
- A live in-browser playground: impossible without a browser port of the renderer, which would
  be a second renderer with its own determinism story. Rejected, recorded in the spec.
- Hosted video files: more moving parts for the same effect, and video encoders are new
  dependencies. Rejected for v1.
- An interactive signal scrubber on the site: superseded by the owner's direction (R11); the
  interactive experience lives in the demo application, and the site carries the generated
  loops. Deferred.

## R11: The live demo application, and why it is not in this repository

**Decision**: Build AnimSpec Live, the conversational demo (chat, a Node render service
streaming frames, vocabulary-gap issue filing), is built in its own repository with its own
hosting (Firebase plus a Cloud Run render service) and consumes `animspec` from npm. This
repository's site links to it when it exists. Nothing about it lands in specs or code here
beyond that link.

**Rationale**: The constitution's baseline permanently reserves AI authoring, serving and
streaming for a separate project; a chat application with a server is exactly that. Keeping the
demo in its own repository preserves this repository's promises (offline verify, one workflow,
no services) while giving the demo room to use whatever it needs. The demo doubles as the
flagship consumer: a live reference for `select` through `validateAnimSpec` to `drawSpec`, and
its vocabulary-gap issues become `good first primitive` candidates that feed the M2 milestone.

**Alternatives considered**:
- Building the demo inside this repository: brings a server, streaming and AI authoring inside
  the baseline the constitution forbids them to enter. Rejected.
- A scrubber on the Pages site as the only interactive demo: weaker than the owner's vision,
  and unnecessary once the demo application exists. Rejected as the primary, kept in mind as a
  fallback.