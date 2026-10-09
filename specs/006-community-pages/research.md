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

## R2: Site generator, or none

**Decision**: No site generator. Handwritten HTML and CSS for the landing and contribute pages;
one generated page (the gallery) emitted by a repository script.

**Rationale**: The constitution's complexity rule says the default answer to a new abstraction or
dependency is no. Three pages do not earn a toolchain. Handwritten HTML keeps the site auditable
by the same code review as everything else, and the only part that could drift, the primitive
list, is generated anyway (R4).

**Alternatives considered**:
- Jekyll (GitHub's built-in): makes every markdown file in the source folder a page, needs
  front-matter conventions our docs do not have, and silently constrains plugins. Rejected.
- Astro, VitePress, Eleventy: a Node build chain, new devDependencies, lockfile churn, and build
  minutes, to produce three pages. Rejected; revisit only if the site outgrows hand authorship.
- A full React SPA: an application to test and bundle, for a document. Rejected.

## R3: Deployment automation and CI-cost posture

**Decision**: A separate workflow, `.github/workflows/site.yml`, triggered by pushes to `main`
filtered to site-affecting paths (`site/**`, `gallery/**`, `VOCABULARY.md`,
`scripts/generate-site.ts`, the workflow itself) plus `workflow_dispatch`. One job on
`ubuntu-latest`: checkout, Node 22, `npm ci`, `npm run site:generate`, `npm run site:check`,
then configure, upload and deploy. It never runs on pull requests.

**Rationale**: Verify stays one workflow with one job (constitution Principle VI); the deploy
workflow is separate automation, the pattern the repository already records for `publish.yml`
in RELEASING.md. The paths filter holds the cost promise: a typical push (a primitive, a gate, a
doc) triggers nothing. Running the regeneration inside the deploy means the published gallery can
never be stale, even when a contributor forgets.

**Alternatives considered**:
- Extending verify.yml with a deploy job: violates one-workflow-one-job and entangles the
  offline guarantee with a network deployment. Rejected.
- Deploying on every push without a paths filter: adds billed minutes proportional to
  contribution volume, which Principle VI exists to prevent. Rejected.
- Manual dispatch only: the site rots behind human memory. Rejected.
- A pre-commit hook instead of CI: hooks are advisory and already carry verify; deploy is not a
  local concern. Rejected.

## R4: Gallery page generation

**Decision**: `scripts/generate-site.ts` reads `PRIMITIVES` from
`src/primitives/registry.ts` and the committed `gallery/*.png` thumbnails, and emits
`site/gallery.html` plus copied thumbnails under `site/assets/gallery/`. Ordering is stable
(registry order), output is deterministic (no clock, no randomness), and `--check` mode fails
when the committed files are stale. `npm run site:generate` and `npm run site:check` are the two
npm aliases, following `gallery:generate` and the `--check` precedents of `fonts:generate` and
`icons:generate`.

**Rationale**: Constitution Principle II forbids a second, hand-synchronised primitive list; the
gallery page is that list if anyone types it by hand. Generation from the registry reuses the
single source of truth, and the staleness check matches the pattern the gates already use for
generated data.

**Alternatives considered**:
- A hand-maintained gallery page: forbidden by Principle II as soon as the registry grows.
  Rejected.
- Rendering thumbnails in the browser from specs: no browser rasteriser exists, and the library's
  determinism promise belongs to its own native renderer. Rejected.
- Serving `gallery/` directly and hot-linking it from the page: Pages serves one artifact
  directory; copying into `site/assets/` keeps the deploy self-contained. Rejected for deploy
  shape, accepted in spirit: the copy is generated, never hand-made.

## R5: Self-containment and fonts

**Decision**: Every page loads only same-origin files. The stylesheet and pages use the
repository's shipped font files, copied to `site/assets/fonts/` with their licence texts and
declared with `@font-face`, falling back to a system monospace stack. No CDN, no analytics, no
external requests of any kind.

**Rationale**: The library's own promise is that text comes from shipped fonts, never the
machine; the site saying the same thing with the same files is both on-brand and free. A page
with zero external requests also loads fast, works offline once fetched, and never breaks when
a third-party CDN moves.

**Alternatives considered**:
- Google Fonts or another font CDN: a network dependency and a privacy cost, for fonts the
  repository already ships. Rejected.
- System fonts only: acceptable but wastes the on-brand asset already in the tree. Deferred as
  the fallback stack, not the primary.

## R6: Site content at v1

**Decision**: Three pages. Landing: the promise table, the install line, the quick-start example,
links to the docs. Gallery: one generated card per primitive. Contribute: the new-primitive rule,
the four style questions, the gates, the CLA, links to CONTRIBUTING.md, the proposal template and
`good first primitive`. CONTRIBUTING.md stays the source of truth; the page summarises and links.

**Rationale**: The site's only job is to get contributors (spec outcome). Those three pages cover
understand, see, act. Anything more (playground, rendered docs, search) is out of scope and named
as such in the spec.

**Alternatives considered**:
- Rendering the markdown docs on the site: duplicates GitHub's rendering and doubles the
  maintenance surface. Rejected for v1; the site links instead.
- An interactive spec playground: needs a browser renderer that does not exist. Rejected, named
  in the spec's out-of-scope with its holder.
- A blog or news page: nobody to feed it yet. Rejected.

## R7: Integrity checking

**Decision**: The generator's `--check` mode is the site's only automated test: it fails when
committed generated output is stale. It runs in the deploy workflow, so a forgotten regeneration
blocks the deploy rather than publishing drift. Manual checks in quickstart.md cover internal
links, self-containment (dev-tools network tab empty) and click depth.

**Rationale**: The repository's quality bar is `npm run verify`, which this feature must not
change (FR-004, SC-006). A staleness check in the deploy path is the same enforcement shape as
`fonts:generate --check` inside the gates, without touching the gates.

**Alternatives considered**:
- Adding site checks to `npm run verify`: changes the constitution's quality bar for a static
  site. Rejected; verify stays untouched.
- An HTML link crawler: a new dependency to check three pages and a handful of links.
  Rejected; quickstart.md carries the manual check instead.

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