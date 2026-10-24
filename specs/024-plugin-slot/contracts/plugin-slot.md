# Contract: Plugin Slot

**Status**: reviewed by Motion Studio's plugin host (PR #148, 2026-10-24); its five requests are folded in below.

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

`draw` receives exactly what core primitives receive:
- the absolute frame (`index`, `t`, signal fields);
- the validated layer (params clamped to your bounds);
- the palette (roles in creative mode);
- the draw context (`seed`, `layerSeed`, `text`, `font`, `creative`, `assets`).

Use **`dctx.layerSeed`** for your randomness. It is derived from the render seed *and* the
layer's position in the spec (`mixSeed(seed, layerIndex)`), so two instances of the same
plugin layer in one spec don't share identical randomness. Because it follows the layer's
position, inserting a layer before it changes its seed.

**`licence` must be a valid SPDX license expression.** That means a listed SPDX id such as
`Apache-2.0`, `MIT` or `GPL-3.0-only`, a `LicenseRef-…` id, or a combination with `AND`, `OR`,
`WITH <exception>` and parentheses, for example `MIT OR Apache-2.0`. Registration rejects
anything else, so hosts can read the field reliably (for example to treat GPL or AGPL plugins
as separate add-ons).

## 2. Registering (host)

```ts
import { registerPlugin } from "animspec";
registerPlugin(acme); // throws with a reason on a bad id, a licence that is not a valid SPDX expression, malformed params, or a version conflict
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

The CLI equivalent is `animspec verify-plugin ./acme.js [--json]`:
- **Without `--json`**: prints a readable summary.
- **With `--json`**: prints the report as one JSON object, so CI can see which check failed.
- **Exit codes**: 0 when every check passes, **6** when any check fails, 2 on a usage or
  load error. These codes are documented and stable.

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
- **The purity check is a test, not a sandbox.** It watches file and network calls while
  drawing probe frames in the same process, so it catches accidental I/O, not a plugin
  determined to hide it. Hosts should still run plugins they do not fully trust in an
  isolated worker (Motion Studio does).
- **Manifest**: the CLI records every plugin used (`id`, `version`, `licence`, and the
  **`sha256` of the plugin module file** it loaded), and marks the render
  `"guarantee": "core-only"`. The digest means one version string can't quietly map to two
  different builds.
- **Models**: external primitives are never offered to models unless a caller names them.

## 6. Rendering from the CLI

```sh
animspec render spec.json --signal t.asft --plugin ./acme.js --png out/
```
