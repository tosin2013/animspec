# Contract: Shipped Fonts and the Spec's Font Choice

## Shipped fonts

| Key | Font | Licence | Default |
| --- | --- | --- | --- |
| `dejavu` | DejaVu Sans Mono | Bitstream Vera | yes |
| `jetbrains` | JetBrains Mono | SIL OFL 1.1 | |
| `plex` | IBM Plex Mono | SIL OFL 1.1 | |

All text the library draws uses one of these. No font installed on the machine is ever used,
whether or not it contains a character the chosen font lacks.

## Choosing a font in a spec

```json
{
  "background": "black",
  "font": "jetbrains",
  "layers": [{ "type": "caption" }, { "type": "wave" }]
}
```

| Spec says | Result |
| --- | --- |
| no `font` | the default, `dejavu` |
| a shipped key | that font, for every text layer in the spec |
| anything else | the default; `validateAnimSpec` reports `font dropped (not a shipped font)`; the spec stays valid |

One font applies to the whole spec. There is no per-layer choice.

## For models and tools

The generated JSON schema lists `font` as an optional string restricted to the shipped keys,
beside `background` and `accent`. The list of fonts is exported from the library's public
surface with each font's key, label and licence.

## Characters a font does not have

They draw as that font's own empty-box placeholder, the same on every machine. Coverage
differs by font; DejaVu Sans Mono covers the most (Latin, Greek, Cyrillic, arrows and block
shapes).

## For primitive authors

- Build the font string from the size and the draw context's `font`. Do not write a family
  name such as `monospace` or `Arial`.
- `npm run verify` fails if a `.font =` assignment in `src/` does not use the draw context's font.
- Text must lay out correctly in every shipped font. Each text primitive has reference cases
  in each font.

## Adding a font later

1. Put the `.ttf`, its licence text, and its source, version and SHA-256 under
   `assets/fonts/`.
2. Add it to the font list and run `npm run fonts:generate`.
3. Add it to `NOTICE`.
4. Run `npm run golden:update`, which adds its text cases to both sets, and record that in
   `golden/CHANGES.md`.

Replacing or removing a shipped font changes saved specs' output. Before the first published
release that is allowed if recorded; afterwards it follows the replacement rules for
primitives.

## Stale font data

```text
  FAIL  font data is stale — run: npm run fonts:generate
```

Printed by `npm run verify` when a generated module under `src/fonts/` does not match its
`.ttf` file.
