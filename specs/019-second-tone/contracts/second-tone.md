# Contract: Second Tone

```jsonc
{
  "accent": "#c8963e",
  "roles": { "fg2": "#d8c8a0" },          // creative mode only
  "layers": [{ "type": "grid", "solid": true, "pattern": "##.a.##/#b...b#/..###../#b...b#/##.a.##" }]
}
```

| Condition | `b` cell colour |
| --- | --- |
| creative on, `roles.fg2` valid | `roles.fg2` |
| creative on, no `fg2` | `#808080` |
| creative off | `#808080` |

- **Validator**: `b` is no longer reported. An invalid `fg2` is dropped by spec 020's
  messages, for example `roles: fg2 dropped (not a valid hex color)`.
- **Exports**: `FG2_ROLE`, `FG2_MONO` and `PRIMITIVE_ROLES` are added to the registry module.
  They are internal to the gates, and the package's public `src/index.ts` surface is
  unchanged.
- **Descriptions**: grid `pattern` desc reads "`.` off, `#` fg, `a` accent, `b` second tone
  (roles.fg2 in creative mode, else mid grey), `~` spectrum". Checker's is the same.
