# Implementation Plan: Community Pages Site

**Branch**: `006-community-pages` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-community-pages/spec.md`

## Summary

A static GitHub Pages site under `site/` whose job is to convert visitors into contributors: a
landing page that states the determinism promise and the install, a gallery page generated from
the primitive registry, and a contribute page that surfaces the existing contribution path. The
site is handwritten HTML with no site generator and no new dependency; its only generated part is
the gallery, emitted by `npm run site:generate` from the registry and the committed gallery
thumbnails. A separate, paths-filtered workflow regenerates, checks and deploys it to GitHub
Pages. The verify workflow and `npm run verify` are untouched.

## Technical Context

**Language/Version**: HTML5, CSS, and TypeScript 5.9 for the generator (Node.js 22 or later, ESM, `strict`)

**Primary Dependencies**: none new. The generator uses existing dev dependencies (`typescript`, `tsx`). The deploy workflow uses GitHub's Pages actions (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`).

**Storage**: none. Static files committed in the repository (`site/`, assets copied from `gallery/` and `assets/fonts/`).

**Testing**: `npm run site:check` (staleness of generated output, emitted by the same generator script in `--check` mode) plus the quickstart's manual link and self-containment checks. No test framework is added.

**Target Platform**: GitHub Pages static hosting; any modern browser. The site is a document, not an application: no JavaScript is required for it to work.

**Project Type**: static marketing/community site, generated in part.

**Performance Goals**: self-contained pages (0 external requests); landing page loads in under a second on broadband; a site-affecting push deploys in at most 3 minutes; a typical push adds 0 billed CI minutes (paths filter).

**Constraints**: no new runtime or build dependency; no CDN, analytics or external fonts; no in-browser rendering (the library's rasteriser is native); the gallery page must come from the registry, never from a hand-maintained list.

**Scale/Scope**: three pages and a stylesheet at v1; one card per primitive (29 at v1, flat grid designed to hold the v1.0 target of 100+).

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
| VII. Explicit boundaries | **Boundary change, recorded** | The site is a new kind of output and GitHub Pages is a new external service. The spec names both under its six boundary entries. The baseline (Scope and Boundaries) must be amended in the same change that ships the site: add the community site to in-scope, add GitHub Pages to external dependencies, and bump the constitution version 2.3.0 to 2.4.0 (MINOR, materially expanding scope). FR-012 carries this. |

**Gates the change touches**: none. `npm run verify` is unchanged, no golden hash moves, and the
change alters the project boundary only through the recorded amendment above.

**Post-Phase-1 re-check**: the design below stays inside the spec's in-scope list. The generator
reads `src/primitives/registry.ts` and `gallery/`, writes only under `site/`, and adds no export
to `src/index.ts`, so the public API surface is unchanged. Still a boundary change, still
recorded.

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
site/
├── index.html            # handwritten landing page
├── contribute.html       # handwritten contribution path
├── gallery.html          # generated by scripts/generate-site.ts
└── assets/
    ├── style.css         # handwritten stylesheet
    ├── fonts/            # copies of the shipped font files + licence texts
    └── gallery/          # thumbnails copied from gallery/ by the generator

scripts/
└── generate-site.ts      # npm run site:generate, --check for site:check

.github/workflows/
├── verify.yml            # untouched
├── publish.yml           # untouched
└── site.yml              # new: regenerates, checks, deploys (paths-filtered)
```

**Structure Decision**: a single new top-level `site/` directory, because GitHub Pages deploys one
artifact and the repository keeps one home per kind of thing (`gallery/`, `golden/`, `docs/`,
`specs/`). Handwritten pages sit beside generated ones in the same directory, the same pattern
as `src/fonts/`, where handwritten `index.ts` sits beside generated data modules. The generator
is one script in the existing `scripts/` directory, alongside its siblings
`generate-gallery.ts` and `generate-fonts.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The one tension, a second GitHub-owned workflow, is not a Principle VI violation:
verify remains one workflow with one job, and the deploy workflow is separate automation that
never runs inside verify, the same separation the repository already records for `publish.yml`
in RELEASING.md. It is recorded in the Constitution Check above, not justified here.