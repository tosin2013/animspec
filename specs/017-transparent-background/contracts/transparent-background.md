# Contract: Transparent Background (spec 017)

## Shape

```json
{
  "background": "transparent",
  "ink": "dark",
  "layers": [{ "type": "grid" }, { "type": "wave" }]
}
```

- `background`: `"black"` (default), `"white"` or `"transparent"`.
- `ink` (only with `"transparent"`): `"light"` (default) draws as on black with the black
  removed; `"dark"` draws as on white with the white removed.

## Behaviour

- Where nothing is drawn, a pixel is fully transparent (alpha 0).
- Where the foreground fully covers a pixel, it is opaque in exactly that colour. An accent
  pixel is exact over the matching background; on its own it may be a more saturated colour
  at partial alpha (for example `#ff2d2d` with dark ink → `#ff0000` at alpha 210).
- Parts drawn in the background colour (seams, cut-outs, masks) are transparent; tones
  between background and foreground are the foreground colour at partial alpha.
- Laid over the matching solid background, the frame equals the solid render within one step
  per channel.
- Deterministic, per frame and per chunk, like every frame. Specs without `"transparent"`
  render byte-identically to before.

## Validation

| Input | Result | Reported |
| --- | --- | --- |
| `background: "transparent"` | kept | — |
| unknown `background` | `"black"` | — (unchanged) |
| `ink: "light"` or `"dark"` with transparent | kept | — |
| other `ink` with transparent | `"light"` | `ink must be light or dark; using light` |
| `ink` with a solid background | dropped | `ink dropped (only applies to a transparent background)` |

## Command line

- `animspec render … --png <dir>`: RGBA PNG files, transparent where nothing is drawn.
- `animspec render … --raw`: four bytes per pixel, unchanged layout; alpha is now below 255
  where the frame is transparent. Bytes equal the library's `getImageData` for that frame.

## Compatibility

- Black and white specs are unchanged.
- A spec stored unvalidated with `"transparent"` used to draw on black; it now draws
  transparent (intended, recorded in the changelog). Validated specs hold `"black"`.

## For models

The JSON schema lists `"transparent"` in `background` and `ink` with `"light"`/`"dark"`.
