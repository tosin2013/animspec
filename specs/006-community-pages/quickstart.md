# Quickstart: Community Pages Site

Phase 1 output for [spec.md](spec.md). This is the validation guide: how to prove the feature
works end to end, locally and deployed. Implementation detail lives in the tasks, not here.

## Prerequisites

- Node.js 22 or later
- A clone of this repository, with `npm install` already run (it also installs the pre-push
  hook)
- For the deployed checks: the repository's GitHub Pages URL, and maintainer access for the
  one-time enablement below

## One-time enablement (maintainer, once)

1. Repository Settings, Pages, Build and deployment.
2. Set Source to **GitHub Actions**.
3. Nothing else; no branch is chosen, no theme is picked.

Until this is set, a deploy run fails at the configure step with the platform's message. This
flip is a setting, not code: it is held by the maintainer (spec, Assumptions).

## Local validation (no network beyond `npm install`)

### Step 1: generate the site

```bash
npm run site:generate
```

Expected: `site/gallery.html` is written, thumbnails appear under `site/assets/gallery/`, and
fonts with their licence texts appear under `site/assets/fonts/`. Handwritten pages are
untouched. Output ends with a per-file count, the same style as `gallery:generate`.

### Step 2: check the generated output is committed fresh

```bash
npm run site:check
```

Expected: exit 0, silent. Repeat after a deliberate hand edit to `site/gallery.html`: it fails
naming the file. Undo the edit.

### Step 3: preview

```bash
python3 -m http.server -d site 8000
```

Open `http://localhost:8000/`. Expected, per page:

- `/` shows the promise table, the install command and the quick start, and links the user
  guide, the design document, the gallery and the contribute page.
- `/gallery/` shows one card per primitive, 29 at the current vocabulary version, each with a
  thumbnail, category, tier and a working link to the registry source on GitHub.
- `/contribute/` shows the rule, the four style questions, the five steps, and links the
  proposal template, the CLA and `good first primitive`.

### Step 4: verify the self-containment contract

With the preview open, open the browser dev-tools network tab and reload each page. Expected:
zero requests to any origin other than `localhost` (SC-004). No CDN, no analytics, no external
fonts.

### Step 5: verify the click-depth success criterion

From `/`, reach the primitive-proposal issue template. Expected: at most two clicks (SC-002):
one to `/contribute/`, one to the template link.

### Step 6: confirm verify is untouched

```bash
git diff main -- .github/workflows/verify.yml package.json | wc -l
npm run verify
```

Expected: the diff is empty (SC-006) and `npm run verify` passes as before. The site feature
changes neither.

## Deployed validation

Run after merging to `main`, or after a `workflow_dispatch` of the Site workflow:

1. **A site-affecting push deploys**: change a gallery thumbnail or a page, push to `main`.
   Expected: the Site workflow runs, regenerates, checks, deploys; the Pages URL shows the
   change within the SC-001 budget (3 minutes).
2. **An unrelated push does not**: push a change to `src/` or `docs/` alone. Expected: the Site
   workflow does not appear in the run list; the verify workflow runs as always.
3. **A stale generated file blocks the deploy**: commit a hand edit to
   `site/assets/gallery/` and push. Expected: the Site workflow fails at the check step and
   nothing is published. Revert, regenerate, push again.
4. **The live gallery matches the registry**: count the cards on `/gallery/` against the
   "29 primitives" line in `VOCABULARY.md`. Expected: equal counts (SC-003).

## What is deliberately not here

- No in-browser rendering or playground: out of scope, with its holder named in the spec.
- No rendered copies of the markdown docs: the site links the GitHub canonical pages.
- No custom domain, analytics or SEO: not needed for the goal, out of scope.