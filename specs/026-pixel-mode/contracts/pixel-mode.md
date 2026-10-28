# Contract: `pixelMode` and `tone2`

## Spec format (amends "The format", constitution 6.2.0)

```jsonc
{
  "background": "black",
  "pixelMode": true,            // optional boolean; absent = false
  "roles": { "fg2": "#d8c8a0" }, // optional, spec 020; read by tone2 in creative mode
  "layers": [
    { "type": "bars", "tone2": "alternate" },  // none | alternate | peak
    { "type": "rings", "tone2": "alternate" }  // none | alternate
  ]
}
```

## Validator

| Input | `spec.pixelMode` | `errors` |
| --- | --- | --- |
| absent | absent | none |
| `true` / `false` | kept | none |
| anything else (`1`, `"true"`, `null`, `{}`) | absent | `pixelMode dropped (must be true or false)` |

`tone2` follows the enum rule: an unknown value becomes `none`.

## JSON schema

`properties.pixelMode = { "type": "boolean" }`, next to `pixelAspect`.

## Rendering promises

| Promise | Holds when |
| --- | --- |
| Byte-identical to 0.8.2 | `pixelMode` absent or false, and `tone2` absent or `none` |
| Every pixel is a palette colour | `pixelMode: true`, solid background, camera zoom 1, no fade transition in progress, only FR-004 primitives (`bars`, `hbars`, `rings`, `emitter`, `particles`, `image`) |
| Camera offsets are whole pixels | `pixelMode: true`, any camera move (zoom ≠ 1 rounds both translations, but scaled drawing may still blend) |
| `fg2` only where `tone2` says | any mode |
| Pure, chunk-stable, cross-type tolerant | always |

## Draw context (library, for plugin authors)

`DrawContext.pixel?: boolean` is true when the spec asks for pixel mode. A plugin primitive
may read it to draw on whole pixels. animspec does not check plugins for palette exactness.
