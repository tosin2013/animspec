# Quickstart: Community Pages Site

Phase 1 output for [spec.md](spec.md). This is the validation guide: how to prove the feature
works end to end, locally and deployed. Implementation detail lives in the tasks, not here.

## Prerequisites

- Node.js 22 or later
- A clone of this repository, with `npm install` already run (it also installs the pre-push
  hook; it installs the site's devDependencies)
- For the deployed checks: the repository's GitHub Pages URL, and maintainer access for the
  one-time enablement below

## One-time enablement (maintainer, once)

1. Repository Settings, Pages, Build and deployment.
2. Set Source to **GitHub Actions**.
3. Nothing else; no branch is chosen, no theme is picked.

Until this is set, a deploy run fails at the configure step with the platform's message. This
flip is a setting, not code: it is held by the maintainer (spec, Assumptions).

## Local validation (no network beyond `npm install`)

### Step 1: generate the site content

```bash
npm run loops:generate
npm run site:generate
```

Expected: one GIF appears per primitive under `loops/` (rendered by the library, encoded by
`@napi-rs/canvas`); `docs/gallery.md` is written with one card per primitive; thumbnails appear
under `docs/public/gallery/`, loops under `docs/public/loops/`, and `docs/vocabulary.md` and
`docs/contributing.md` appear as generated copies of the root documents. Handwritten files are
untouched. Output ends with a per-file count, the same style as `gallery:generate`.

### Step 2: check the generated output is committed fresh

```bash
npm run site:check
```

Expected: exit 0, silent. Repeat after a deliberate hand edit to `docs/gallery.md`: it fails
naming the file. Undo the edit.

### Step 3: preview

```bash
npm run site:dev
```

Open the local server URL. Expected, per page:

- `/` shows the promise table, the install command and the quick start, and links the user
  guide, the design document, the gallery and the contribute page.
- `/gallery/` shows one card per primitive, 29 at the current vocabulary version, each with a
  thumbnail, an animated loop, category, tier and a working link to the registry source on
  GitHub. At least one loop also plays on the home page.
- `/contribute/` shows the rule, the four style questions, the five steps, and links the
  proposal template, the CLA and `good first primitive`.
- `/user-guide/`, `/deployment/`, `/DESIGN_DOC/`, `/vocabulary/` and `/contributing/` render the
  committed documents, with working nav and sidebar.
- Search (the theme's local search box) finds a primitive by name.

### Step 4: build

```bash
npm run site:build
```

Expected: exit 0, static output under `docs/.vitepress/dist`. A broken nav link or a malformed
page fails the build; that failure is the point of this step.

### Step 5: verify the self-containment contract

Serve the built output (any static server), open the browser dev-tools network tab and reload
each page. Expected: zero requests to any origin other than the local server (SC-004). No CDN,
no analytics, no external fonts.

### Step 6: verify the click-depth success criterion

From `/`, reach the primitive-proposal issue template. Expected: at most two clicks (SC-002):
one to `/contribute/`, one to the template link.

### Step 7: confirm verify is untouched

```bash
git diff main -- .github/workflows/verify.yml package.json | wc -l
npm run verify
```

Expected: the verify workflow diff is empty (SC-006) and `npm run verify` passes as before.
`package.json` changes only by the site scripts and devDependencies; the library's runtime
dependencies and its `files` list do not change. The site feature changes neither.

## Deployed validation

Run after merging to `main`, or after a `workflow_dispatch` of the Site workflow:

1. **A site-affecting push deploys**: change a gallery thumbnail or a page, push to `main`.
   Expected: the Site workflow runs, regenerates, checks, builds, deploys; the Pages URL shows
   the change within the SC-001 budget (3 minutes).
2. **An unrelated push does not**: push a change to `src/` alone. Expected: the Site workflow
   does not appear in the run list; the verify workflow runs as always.
3. **A stale generated file blocks the deploy**: commit a hand edit to
   `docs/public/gallery/` and push. Expected: the Site workflow fails at the check step and
   nothing is published. Revert, regenerate, push again.
4. **A broken page blocks the deploy**: break a nav link in the config and push. Expected: the
   build step fails and nothing is published. Revert and push again.
5. **The live gallery matches the registry**: count the cards on `/gallery/` against the
   "29 primitives" line in `VOCABULARY.md`. Expected: equal counts (SC-003), and every card
   animates (SC-007).
6. **The README carries the links**: the README links the site and at least one sample loop
   (SC-008).

## What is deliberately not here

- No in-browser rendering or playground: out of scope, with its holder named in the spec.
- No editing of the rendered documents from the site: the markdown files are the only source.
- No custom domain, analytics, remote search or SEO: not needed for the goal, out of scope.