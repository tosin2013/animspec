# Contract: Dither, Caption Margin, Pixel Aspect

```jsonc
{
  "pixelAspect": 1.2,
  "roles": { "sky0": "#000014", "sky1": "#281444", "sky2": "#6c3468", "bar": "#0000a8" },
  "layers": [
    { "type": "dither", "colors": "sky0,sky1,sky2", "y1": 0.55, "drive": "none" },
    { "type": "dither", "colors": "bar", "y0": 0.7, "drive": "none" },
    { "type": "caption", "box": "none", "margin": 0, "maxLines": 2 }
  ]
}
```

| Input | Validator message |
| --- | --- |
| `colors: ""` | `dither colors: empty; nothing drawn` |
| 7+ names | `dither colors: only the first 6 are used` |
| a name failing the role-name rule | `dither colors: "<name>" is not a role name; drawn as its grey` |
| `pixelAspect: 3` | `pixelAspect dropped (must be a number from 0.5 to 2)` |

- **Manifest**: the CLI manifest line gains `pixelAspect`, only when the spec has one.
- **Exports**: no new public export. `AnimSpec` widens with `pixelAspect`.
