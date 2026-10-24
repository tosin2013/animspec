# Data Model: Sprite Palette Roles

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## Palette role

| Field | Type | Rule |
| --- | --- | --- |
| name | string | `bg`, `fg`, `accent` (built-in) or `/^[a-z][a-z0-9-]{0,15}$/` (named) |
| colour (creative) | hex | from `spec.roles[name]` if present and creative is on |
| monochrome value | colour | built-ins: `bg` / `fg` / `fg` (accent outside creative); named: the letter's `mono` shade |

## Roles map (spec level, `AnimSpec.roles`)

- An optional object of up to 16 entries, `name → "#rgb" | "#rrggbb"`.
- Sanitized by `sanitizeRoles` (R2). Invalid names, invalid values and shadowed built-ins are
  dropped and reported. Beyond 16, the first 16 by sorted name are kept.
- The validator stores it only when the map is non-empty after sanitizing.
- At render time it is passed into `Palette.roles` only in creative mode.

## Palette (render time, `registry.ts`)

```text
Palette { bg: string; fg: string; accent: string; roles?: Readonly<Record<string, string>> }
```

`roles` is absent unless creative mode is on and the sanitized map is non-empty.

## Character (built-in, `sprites.ts`)

```text
Character {
  walk: string[][];          // required
  idle?: string[][];
  jump?: string[];
  palette?: Record<letter, { role: string; mono: "D" | "B" | "W" }>   // v2 marker
}
```

| Rule | Applies to | Enforced by |
| --- | --- | --- |
| All frames of all poses share one width × height; every row has that width | all characters | `characterProblems` (verify-registry) |
| width ≤ 32, height ≤ 48 | v2 | same |
| every non-`.` letter is a palette key | v2 | same |
| `mono` ∈ {D, B, W}; `role` built-in or a valid role name | v2 | same |

**State**: a character is legacy (no `palette`) or v2 (`palette` present). No transitions.

## `hero` (the v2 demo character)

About 16 × 20 cells, a two-frame `walk`, an `idle` (optional), and 10 roles:

| Letter | Role | Mono |
| --- | --- | --- |
| O | outline | D |
| H | hair | B |
| h | hair-light | W |
| S | skin | W |
| E | eyes | D |
| G | gold | W |
| C | cloak | B |
| c | cloak-shade | D |
| T | tunic | B |
| K | boots | D |

The bitmap is authored fresh from #103's description (hair with a highlight, skin, eyes, gold
trim, cloak, boots, a two-frame leg cycle). No issue code is copied.
