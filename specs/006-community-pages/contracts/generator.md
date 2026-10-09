# Contract: site:generate and site:check

Phase 1 output for [spec.md](spec.md). One script, `scripts/generate-site.ts`, two npm aliases,
following the pattern of `gallery:generate`, `fonts:generate --check` and `icons:generate`.

## npm scripts

| Alias | Command | Effect |
| --- | --- | --- |
| `npm run site:generate` | `tsx scripts/generate-site.ts` | Writes every generated file under `site/` |
| `npm run site:check` | `tsx scripts/generate-site.ts --check` | Regenerates in memory and compares; writes nothing; exits non-zero on any difference |

## Inputs (read-only)

| Input | Path | Used for |
| --- | --- | --- |
| Registry | `src/primitives/registry.ts` (`PRIMITIVES`, `VOCABULARY_VERSION`) | Card fields, ordering, the "vocabulary version N" caption on the gallery page |
| Thumbnails | `gallery/*.png` | Copied to `site/assets/gallery/` |
| Fonts | `assets/fonts/` (files and licence texts) | Copied to `site/assets/fonts/` |

## Outputs (all generated, all committed)

| Output | Path |
| --- | --- |
| Gallery page | `site/gallery.html` |
| Copied thumbnails | `site/assets/gallery/*.png` |
| Copied fonts and licence texts | `site/assets/fonts/*` |

Handwritten files (`index.html`, `contribute.html`, `assets/style.css`) are never touched by the
generator. The generator holds no copy of their content.

## Determinism

The generator is a pure function of the repository, in the spirit of constitution Principle I:

- Registry order only; no sort by time, name hash or chance.
- No `Date`, no `Math.random`, no file timestamps: output bytes depend only on input bytes.
- Same commit, same output, byte for byte, on every machine and processor type. The site
  generator never renders, so the cross-type tolerance rules do not apply to it; its output is
  expected to be byte-identical everywhere.

## `--check` semantics

- Regenerate every output in memory.
- Compare against the committed files byte for byte.
- Fail (exit 1) listing each stale, missing or hand-edited file.
- Pass silently (exit 0) when everything matches.

A contributor who adds a primitive and forgets the site learns it from this check, the same way
they learn about font and icon data staleness today.

## Failure behaviour

- A registry primitive without a thumbnail: the generator fails naming the type, though the
  registry gate should have refused the change first.
- A missing font file or licence text: the generator fails naming the file.
- The generator never deletes anything it did not generate; unknown files under
  `site/assets/gallery/` are reported by `--check` as unexpected, not removed.

## Non-goals

- No HTML templating engine, no markdown rendering, no dependency beyond what the repository
  already has (`typescript`, `tsx`). String templates in the script are the ceiling; if they
  stop being enough, that is a new spec decision.