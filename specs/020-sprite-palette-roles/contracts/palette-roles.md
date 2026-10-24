# Contract: Palette Roles

## Spec format addition

```jsonc
{
  "accent": "#c8963e",          // existing
  "roles": {                    // NEW, optional; honoured only in creative mode
    "hair": "#5a3a1e",
    "skin": "#f0c8a0",
    "cloak": "#2d4a8c"
  },
  "layers": [{ "type": "sprite", "character": "hero" }]
}
```

- Key: `/^[a-z][a-z0-9-]{0,15}$/`, not `bg`, `fg` or `accent`.
- Value: `#rgb` or `#rrggbb`.
- At most 16 entries. Extras are dropped by sorted name.

### Validator messages (`ValidationResult.errors`)

| Input | Message | Result |
| --- | --- | --- |
| `roles: 5` | `roles dropped (not an object)` | no `roles` |
| `roles: { Hair: "#fff" }` | `roles: Hair dropped (invalid name)` | entry removed |
| `roles: { hair: "red" }` | `roles: hair dropped (not a valid hex color)` | entry removed |
| `roles: { fg: "#fff" }` | `roles: fg dropped (shadows a built-in role)` | entry removed |
| 17+ valid entries | `roles: <name> dropped (more than 16 roles)` per extra | first 16 by name kept |

## JSON schema addition (`buildJsonSchema`)

```jsonc
"roles": {
  "type": "object",
  "description": "named colours for palette roles (e.g. a sprite character's hair, skin, cloak); used only in creative mode",
  "propertyNames": { "pattern": "^[a-z][a-z0-9-]{0,15}$" },
  "additionalProperties": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" },
  "maxProperties": 16
}
```

## Public type changes (`src/index.ts` re-exports)

- `AnimSpec.roles?: Record<string, string>` (widened).
- `Palette.roles?: Readonly<Record<string, string>>` (widened).
- New export: `sanitizeRoles`.

No other export is added or removed.

## Render rule

- Creative off: `Palette.roles` is absent, and every named role draws its monochrome value.
- Creative on: `Palette.roles` is the sanitized map. A named role draws `roles[name]` when
  present, else its monochrome value.
- A spec without `roles` renders byte-identically to before.

## Primitive rule (Principle III, amended)

A primitive's `draw` colours only with `p.bg`, `p.fg`, `p.accent`, `p.roles[name]`, or the
fixed bg–fg greys used as monochrome values. In this spec only `sprite` (v2 characters) reads
`p.roles`.
