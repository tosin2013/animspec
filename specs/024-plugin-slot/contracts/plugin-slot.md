# Contract: Plugin Slot (for review against Motion Studio's plugin host)

## 1. Writing a plugin

```ts
import type { PrimitiveDef } from "animspec";
const starfield: PrimitiveDef = {
  type: "starfield", tier: "external", category: "geometry",
  description: "drifting stars brightening with the signal",
  params: { count: { type: "number", min: 1, max: 400, default: 120 } },
  draw(ctx, dims, frame, layer, palette, dctx) { /* pure: no files, network, clock or randomness */ },
};
export default { id: "acme", version: "1.2.0", licence: "Apache-2.0", primitives: [starfield] };
```

`draw` receives exactly what core primitives receive: the absolute frame (`index`, `t`,
signal fields), the validated layer (params clamped to your bounds), the palette (roles in
creative mode), and the draw context (seed, text, font, creative, assets).

## 2. Registering (host)

```ts
import { registerPlugin } from "animspec";
registerPlugin(acme); // throws with a reason on a bad id, colliding type, malformed params, or a version conflict
```

- Register once per process, at startup.
- The same version again is a no-op. A different version is refused.

## 3. Using it from a spec

```jsonc
{ "plugins": { "acme": { "version": "1.2.0" } },
  "layers": [{ "type": "ext:acme/starfield", "count": 200, "bind": { "count": { "from": "amplitude" } } }] }
```

A layer is dropped and reported when:
- `plugin acme is not declared in plugins`;
- `plugin acme is not registered`;
- `plugin acme is version 1.1.0, spec wants 1.2.0`;
- `plugin acme has no type starfield`.

## 4. Verifying

```ts
import { verifyPlugin } from "animspec/verify";
const report = verifyPlugin(acme); // { ok, primitives: [{ type, checks: [...] }] }
```

The CLI equivalent is `animspec verify-plugin ./acme.js`, which exits non-zero on any failed
check.

The checks are the same ones core primitives pass:
- **Determinism**: twice-identical, and identical in forward and reverse frame order.
- **Palette roles**: bg, fg, accent, roles, plus 022's image exemption.
- **Budget**: at most 3,000 operations and 50 ms per 1080p frame.
- **Reactivity**: the signal changes the output at a fixed time.
- **Purity**: no file or network access while drawing.

## 5. Guarantees

- **Core primitives**: byte-identical per processor type, as today.
- **Plugin primitives**: outside the reference sets. A plugin that passes `verifyPlugin` is
  "proven" by the same checks, but animspec does not keep reference frames for it.
- **Manifest**: the CLI records every plugin used (`id`, `version`, `licence`) and marks the
  render `"guarantee": "core-only"`.
- **Models**: external primitives are never offered to models unless a caller names them.

## 6. Rendering from the CLI

```sh
animspec render spec.json --signal t.asft --plugin ./acme.js --png out/
```
