# Contract: site:generate and site:check

Phase 1 output for [spec.md](spec.md). One script, `scripts/generate-site.ts`, npm aliases,
following the pattern of `gallery:generate`, `fonts:generate --check` and `icons:generate`.

## npm scripts

| Alias | Command | Effect |
| --- | --- | --- |
| `npm run site:generate` | `tsx scripts/generate-site.ts` | Writes every generated file under `docs/` |
| `npm run site:check` | `tsx scripts/generate-site.ts --check` | Regenerates in memory and compares; writes nothing; exits non-zero on any difference |
| `npm run site:dev` | `vitepress dev docs` | Local preview server with hot reload |
| `npm run site:build` | `vitepress build docs` | Builds `docs/` to `docs/.vitepress/dist` (gitignored) |

## Inputs (read-only)

| Input | Path | Used for |
| --- | --- | --- |
| Registry | `src/primitives/registry.ts` (`PRIMITIVES`, `VOCABULARY_VERSION`) | Card fields, ordering, the "vocabulary version N" caption on the gallery page |
| Thumbnails | `gallery/*.png` | Copied to `docs/public/gallery/` |
| Root documents | `VOCABULARY.md`, `CONTRIBUTING.md` | Copied into `docs/` as generated pages, with the theme's front matter added |
| Fonts (optional) | `assets/fonts/` (files and licence texts) | Copied to `docs/public/fonts/` |

## Outputs (all generated, all committed)

| Output | Path |
| --- | --- |
| Gallery page | `docs/gallery.md` |
| Copied thumbnails | `docs/public/gallery/*.png` |
| Copied root documents, front-mattered | `docs/vocabulary.md`, `docs/contributing.md` |
| Copied fonts and licence texts (optional) | `docs/public/fonts/*` |

Handwritten files (`docs/index.md`, `docs/contribute.md`, `docs/.vitepress/**`, the three
existing documents) are never touched by the generator. The generator holds no copy of their
content. The two root-document copies are derived files: their sources stay canonical, and the
copies are as disposable as the thumbnails.

## Determinism

The generator is a pure function of the repository, in the spirit of constitution Principle I:

- Registry order only; no sort by time, name hash or chance.
- No `Date`, no `Math.random`, no file timestamps: output bytes depend only on input bytes.
- Front matter added to the copies is fixed text, not derived from the environment.
- Same commit, same output, byte for byte, on every machine and processor type. The site
  generator never renders, so the cross-type tolerance rules do not apply to it; its output is
  expected to be byte-identical everywhere.

## `--check` semantics

- Regenerate every output in memory.
- Compare against the committed files byte for byte.
- Fail (exit 1) listing each stale, missing or hand-edited file.
- Pass silently (exit 0) when everything matches.

A contributor who changes the registry and forgets the site learns it from this check, the same
way they learn about font and icon data staleness today.

## Failure behaviour

- A registry primitive without a thumbnail: the generator fails naming the type, though the
  registry gate should have refused the change first.
- A missing source document or licence text: the generator fails naming the file.
- The generator never deletes anything it did not generate; unexpected files under its output
  paths are reported by `--check`, not removed.

## Non-goals

- No HTML templating engine: the generator emits markdown, and the theme renders it. If the
  cards ever grow interactive, a Vue component fed a JSON file is the next step, and a new
  recorded decision.
- No transformation of document content beyond adding front matter: the copies of
  `VOCABULARY.md` and `CONTRIBUTING.md` keep the source text untouched, so the site never
  becomes a second editor of the truth.