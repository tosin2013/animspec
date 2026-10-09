# Implementation Plan: Community Pages Site

**Branch**: `006-community-pages` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-community-pages/spec.md`

## Summary

A GitHub Pages site built with VitePress, rooted at `docs/`, whose job is to convert visitors into
contributors: a home page that states the determinism promise and the install, a gallery page
generated from the primitive registry, a contribute page that surfaces the existing contribution
path, and the repository's own documentation (user guide, deployment runbook, software design
document, VOCABULARY, CONTRIBUTING) rendered as pages from the same committed files. VitePress is
a devDependency, chosen over a hand-rolled site; its default theme ships all assets locally, so
the site stays self-contained. A separate, paths-filtered workflow regenerates, checks, builds
and deploys it to GitHub Pages. The verify workflow and `npm run verify` are untouched.

## Technical Context

**Language/Version**: Markdown and VitePress for the site; TypeScript 5.9 for the generator (Node.js 22 or later, ESM, `strict`)

**Primary Dependencies**: `vitepress` and its `vue` peer, as devDependencies (both MIT, Apache-2.0-compatible). They never enter the library runtime or its published package. The generator uses existing dev dependencies (`typescript`, `tsx`). The deploy workflow uses GitHub's Pages actions (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`).

**Storage**: none. Markdown and theme config are committed in the repository (`docs/`, `docs/.vitepress/`); thumbnails and optional font files are copied by the generator into `docs/public/`.

**Testing**: `npm run site:check` (staleness of generated output, emitted by the same generator script in `--check` mode) and `npm run site:build` (VitePress fails on broken nav links or malformed pages), both run in the deploy workflow. No test framework is added.

**Target Platform**: GitHub Pages static hosting; any modern browser. The built site works without JavaScript except for the bundled local search.

**Project Type**: static documentation and community site, generated in part.

**Performance Goals**: self-contained pages (0 external requests); home page loads in under a second on broadband; a site-affecting push deploys in at most 3 minutes (build included); a typical push adds 0 billed CI minutes (paths filter).

**Constraints**: no CDN, analytics or external fonts; local search only; no in-browser rendering (the library's rasteriser is native); the gallery page must come from the registry, never from a hand-maintained list; the library's runtime dependencies and its package `files` list do not change.

**Scale/Scope**: three content pages plus the rendered documents at v1; one card per primitive (29 at v1, flat grid designed to hold the v1.0 target of 100+).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Reason |
| --- | --- | --- |
| I. Determinism | Pass | The site draws nothing. It displays the committed reference thumbnails that `gallery:generate` already renders from the library. No rendering code is touched, no golden hash moves. |
| II. Registry is the single source of truth | Pass | The gallery page is generated from `PRIMITIVES` and the committed thumbnails. There is no hand-maintained primitive list anywhere on the site. `site:check` refuses stale generated output. |
| III. Pure, palette-only, CPU-only primitives | Pass (not applicable) | No primitive or draw function is changed. |
| IV. Specs are untrusted input | Pass (not applicable) | The site validates nothing and renders no spec. |
| V. Saved specs keep rendering | Pass (not applicable) | No vocabulary or primitive change. |
| VI. One offline verify command | Pass, with a recorded separation | `npm run verify`, the verify workflow, its one job and its triggers are byte-identical before and after (SC-006). The deploy workflow is separate automation, the established pattern of `publish.yml`; it is paths-filtered so a typical push adds zero billed minutes, runs on a GitHub-hosted runner, and never runs as part of verify. |
| VII. Explicit boundaries | **Boundary change, recorded** | The site is a new kind of output, GitHub Pages is a new external service, and VitePress (with its Vue peer) is a new devDependency, chosen by the owner. The spec names all three under its six boundary entries. The baseline (Scope and Boundaries) must be amended in the same change that ships the site: add the community site to in-scope, add GitHub Pages to external dependencies, record VitePress as a development dependency, and bump the constitution version 2.3.0 to 2.4.0 (MINOR, materially expanding scope). FR-012 carries this. |

**Gates the change touches**: none. `npm run verify` is unchanged, no golden hash moves, and the
change alters the project boundary only through the recorded amendment above.

**Complexity, recorded**: the constitution's governance says the default answer to a new
dependency is no. The owner chose a known documentation theme over a hand-rolled site
(direction recorded 2026-10-09), which brings `vitepress` and `vue` as devDependencies. The
justification: a maintained, accessible, responsive theme with local search and a build-time
link check, in exchange for two MIT devDependencies that never touch the library runtime, its
package output, or `npm run verify`. The choice, its costs and its alternatives live in
research.md R2, and the baseline amendment (FR-012) records the dependency against the
constitution's external-dependencies entry.

**Post-Phase-1 re-check**: the design below stays inside the spec's in-scope list. The generator
reads `src/primitives/registry.ts` and `gallery/`, writes only under `docs/` (the gallery page
and `docs/public/` assets), and adds no export to `src/index.ts`, so the public API surface is
unchanged. VitePress reads the committed markdown in place and writes its build output to a
gitignored directory. Still a boundary change, still recorded.

## Project Structure

### Documentation (this feature)

```text
specs/006-community-pages/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── site.md          # Page, URL and asset contract
│   ├── deploy.md        # Deploy workflow contract
│   └── generator.md    # site:generate / site:check contract
└── tasks.md             # Phase 2 output (/speckit-tasks, not this command)
```

### Source Code (repository root)

```text
docs/
├── .vitepress/
│   ├── config.mts           # nav, sidebar, theme: site root is docs/
│   └── theme/               # optional CSS tweak (monochrome accent, font layer)
├── index.md                 # handwritten home page
├── contribute.md            # handwritten contribution path
├── gallery.md               # generated by scripts/generate-site.ts
├── user-guide.md            # existing document, rendered as a page
├── deployment.md            # existing document, rendered as a page
├── DESIGN_DOC.md            # existing document, rendered as a page
└── public/
    ├── gallery/             # thumbnails copied from gallery/ by the generator
    └── fonts/              # optional shipped-font layer with licence texts

scripts/
└── generate-site.ts         # npm run site:generate, --check for site:check

.github/workflows/
├── verify.yml               # untouched
├── publish.yml              # untouched
└── site.yml                 # new: regenerates, checks, builds, deploys (paths-filtered)
```

**Structure Decision**: the site root is `docs/`, VitePress's own convention for a repository
whose documentation is already markdown. The committed documents become pages without being
moved or copied: one markdown home, no duplication, no drift. The VitePress config and the two
handwritten content pages sit beside them, and the generated gallery page joins the same
directory, the same pattern as `src/fonts/`, where handwritten code sits beside generated data.
The generator is one script in the existing `scripts/` directory, alongside its siblings
`generate-gallery.ts` and `generate-fonts.ts`. VitePress's build output
(`docs/.vitepress/dist`, gitignored) is the only thing the deploy workflow uploads.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The one tension, a second GitHub-owned workflow, is not a Principle VI violation:
verify remains one workflow with one job, and the deploy workflow is separate automation that
never runs inside verify, the same separation the repository already records for `publish.yml`
in RELEASING.md. It is recorded in the Constitution Check above, not justified here.