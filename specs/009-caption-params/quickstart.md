# Quickstart: Caption Params

```ts
import { validateAnimSpec } from "animspec";

const { spec } = validateAnimSpec({
  background: "black",
  layers: [
    { type: "caption", case: "asis", box: "none", position: "center", maxLines: 2 },
  ],
});
```

| Param | Values | Default |
| --- | --- | --- |
| `case` | `upper`, `asis` | `upper` |
| `box` | `solid`, `none`, `outline` | `solid` |
| `position` | `bottom`, `top`, `center` | `bottom` |
| `maxLines` | 1–3 | 3 |

A bare `{ type: "caption" }` renders exactly as it always has (uppercase, solid box, bottom,
three lines). The active caption comes from `drawSpec`'s caption argument, else the frame's
`labels[0]`.
