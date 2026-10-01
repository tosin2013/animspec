# animspec

Deterministic, declarative animation. An `AnimSpec` (JSON) plus a `SignalFrame`
(audio, data or text reduced to numbers) renders to a frame — and the same spec,
signal and seed always produce **byte-identical pixels**.

Status: private, pre-release (v0.1.0). Licensed under Apache-2.0.

## What is here

| Path | What it is |
| --- | --- |
| `src/specInterpreter.ts` | Reference interpreter: `drawSpec(ctx, dims, frame, spec, opts)` |
| `src/primitives/registry.ts` | The vocabulary: 29 primitives, their param schemas, `sanitizeLayer`, `buildJsonSchema`, `buildVocabPrompt` |
| `src/primitives/selector.ts` | Deterministic subset / kit selection for LLM prompts |
| `src/specValidator.ts` | `validateAnimSpec` — drops unknown layers, clamps params |
| `src/rng.ts`, `src/types.ts` | Seeded RNG and the `SignalFrame` contract |
| `scripts/verify-*.ts` | Offline gates |
| `golden/hashes.json` | Golden frame hashes (29 primitives + 3 composites × 3 frames) |

## Example

```ts
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec, validateAnimSpec } from "animspec";

const { spec } = validateAnimSpec({
  background: "black",
  layers: [{ type: "grid" }, { type: "wave" }],
});

const dims = { width: 1280, height: 720 };
const ctx = createCanvas(dims.width, dims.height).getContext("2d");
drawSpec(ctx, dims, frame, spec!, { reducedFlicker: true, creative: false, seed: 1 });
```

## Verify

```bash
npm install
npm run verify        # tsc + registry + validator + determinism gates (offline)
npm run golden:update # only when a rendering change is intended
```

`npm install` points git at `.githooks/`, so `npm run verify` also runs before every push.
CI (`.github/workflows/verify.yml`) is manual-only while the repo is private.

## Rules for primitives

- A frame is a pure function of `(spec, SignalFrame, seed)`. No `Math.random`,
  `Date`, network or file access in `draw` — use `mulberry32` from `src/rng.ts`.
- Draw only with the palette (`bg`, `fg`, `accent`). Monochrome by default.
- CPU canvas only (`@napi-rs/canvas`); GPU rasterizers are not byte-reproducible.

## Known limitations

- `src/primitives/icons.ts` finds `pixelarticons` relative to the current working
  directory, so run from the repo root. To be fixed before publishing as a package.
- `src/types.ts` still carries a few types from the app it was extracted from.

## License

Apache-2.0 — see `LICENSE` and `NOTICE`. Outside contributions will require a signed
Contributor License Agreement (CLA); the agreement and sign-up bot are not set up yet.

## Third-party

`@napi-rs/canvas` (MIT), `pixelarticons` (MIT), `@resvg/resvg-js` (MPL-2.0).
