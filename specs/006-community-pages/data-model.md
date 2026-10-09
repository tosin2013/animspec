# Data Model: Community Pages Site

Phase 1 output for [spec.md](spec.md). The site has no database and no runtime state; the model
below describes the files and the invariants the generator and the deploy workflow enforce.
Field types are descriptive, not TypeScript: the generator is a script, not a library API.

## Entities

### SitePage

One HTML document served at a fixed path.

| Field | Type | Rules |
| --- | --- | --- |
| `path` | fixed URL path | `/` (index.html), `/gallery/` (gallery.html), `/contribute/` (contribute.html) |
| `title` | string | Unique per page; used in `<title>` and the nav |
| `nav` | label | Every page shows the same three-item nav; the current page is marked |
| `source` | `handwritten` or `generated` | `index` and `contribute` are handwritten and code-reviewed; `gallery` is generated and never hand-edited |
| `external requests` | none | A page loads only same-origin assets (FR-008) |

Validation rules:

- A page MUST link every other page in its nav (the site is three clicks deep at most).
- A handwritten page MUST NOT contain a primitive list; the gallery is the only page that may,
  and only by generation.
- Every link to a repository document MUST point at the canonical file on GitHub, not at a copy.

### PrimitiveCard

The gallery unit. Derived, never authored.

| Field | Source | Rules |
| --- | --- | --- |
| `type` | `PRIMITIVES[i].type` | The card's id and heading; links to the registry source line |
| `category` | `PRIMITIVES[i].category` | Shown as a label |
| `tier` | `PRIMITIVES[i].tier` | Shown as a label; `legacy` cards never appear in a model offer but still render, and the card says which primitive replaces one, when `replacedBy` is set |
| `description` | `PRIMITIVES[i].description` | Shown as the card body, verbatim from the registry |
| `thumbnail` | `site/assets/gallery/<type>.png` | Copied from `gallery/<type>.png` by the generator; alt text is the type and description |

Relationships and invariants:

- Exactly one card per registry primitive, no more and no fewer: the page is the image of
  `PRIMITIVES` (constitution Principle II; SC-003).
- A card exists only if its thumbnail exists; the registry gate already refuses a primitive
  without a gallery thumbnail, so the generator can assume the file and fail loudly if it is
  missing anyway.
- Ordering is registry order on every generation: no clock, no randomness (FR-009).

### ContributeStep

One ordered step of the contribution path on the contribute page.

| Field | Type | Rules |
| --- | --- | --- |
| `order` | 1..n | Rendered as a numbered path: propose, implement one registry entry, verify, sign the CLA, open the pull request |
| `title` | string | Short, imperative |
| `links` | list | Each step links its canonical target: the proposal template, CONTRIBUTING.md, the CLA, `good first primitive` |

Validation rules:

- The page MUST link CONTRIBUTING.md as the source of truth and MUST NOT restate the rule in
  words that could drift from it (FR-007). Summarise, then link.
- The CLA step comes before the pull-request step.

### SiteAsset

A file served by the site. All live under `site/assets/`.

| Kind | Files | Rules |
| --- | --- | --- |
| stylesheet | `assets/style.css` | Handwritten; monochrome palette (`bg`, `fg`, accent used sparingly), no external `@import` |
| fonts | `assets/fonts/*` | Copies of the shipped font files plus each licence text, copied by the generator from `assets/fonts/`; declared with `@font-face`, system monospace fallback |
| thumbnails | `assets/gallery/*.png` | Copies of `gallery/*.png`, made by the generator |

Invariants:

- No asset is fetched from another origin at view time (FR-008, SC-004).
- Copied assets are generated output: `site:check` fails if they are stale or hand-edited.

### DeployRun

One execution of the deploy workflow. No persisted state; the contract lives in
[contracts/deploy.md](contracts/deploy.md).

| Field | Type | Rules |
| --- | --- | --- |
| `trigger` | site-affecting push to `main`, or manual dispatch | Never a pull request; never part of verify |
| `inputs` | the committed `site/`, `gallery/`, `assets/fonts/`, registry | Read-only; the workflow regenerates before it deploys |
| `output` | a Pages deployment | The `github-pages` environment; the site directory is the only uploaded artifact |

## State transitions

None. Every entity is a file, and the only state change is regeneration, which is a pure
function of the repository: same commit, same site output, byte for byte.

## Out-of-model

Deliberately absent: page metadata front matter, a JSON site index, any database, any runtime
beyond the browser's HTML and CSS processing. If the site later needs a data file (for example,
search), that is a new spec decision, not an extension of this model.