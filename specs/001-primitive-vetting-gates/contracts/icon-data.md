# Contract: Icon Data and Lookup

How named icons reach the `led` and `sprite` primitives once drawing no longer reads files.

## Lookup behaviour

`getIconBitmap(name, height)` is internal to the library, not part of the public surface.

| Input | Result |
| --- | --- |
| a name in `customIcons` | that custom bitmap, at its own size, whatever `height` is asked for |
| a generated icon name, `height` 11 or 14 | the generated bitmap |
| a generated icon name, any other `height` | `null` |
| an unknown name | `null` |

- Names are trimmed and lower-cased before lookup, as today.
- Custom icons take precedence over generated icons of the same name, as today.
- The lookup performs no file access and does not depend on the working directory.
- For every name and for heights 11 and 14, the bitmap is identical to what the previous
  file-based loader produced.

Callers treat `null` as today: `led` falls back to text, `sprite` falls back to the built-in
mascot.

## Generated data

`src/primitives/iconData.ts` is produced by the generator and committed.

- Source: the `pixelarticons` SVG set at the pinned version.
- Heights: 11 (LED sign) and 14 (sprite).
- Thresholding: a cell is lit when its luminance is below 128, as today.
- The file starts with a header stating it is generated and naming the command that
  regenerates it.

## Commands

```bash
npm run icons:generate   # rewrite src/primitives/iconData.ts
```

The freshness check runs inside `npm run verify`. It regenerates the data in memory and fails
if the committed file differs:

```text
  FAIL  icon data is stale — run: npm run icons:generate
```

## Dependencies and licence

- `pixelarticons` and the SVG rasteriser become development dependencies. The published
  library needs neither at runtime.
- Bitmaps derived from `pixelarticons` (MIT) ship inside the library, so `NOTICE` keeps its
  attribution and says so.

## When the icon set changes

Upgrading `pixelarticons` or the rasteriser can change bitmaps. That is a rendering change:
regenerate, update the golden file, and record it in `golden/CHANGES.md`.
