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
| `src/primitives/iconData.ts` | Generated: the pixel-icon bitmaps used by `led` and `sprite` (do not edit; `npm run icons:generate`) |
| `scripts/verify-*.ts` | Offline gates |
| `scripts/verify-gates.ts` | The four vetting gates every primitive must pass, with a rule-breaking fixture for each |
| `golden/hashes.json` | Golden frame hashes: every primitive and composite at three signal levels, plus icon and full-strength flash cases |
| `golden/CHANGES.md` | The log of every intended change to the golden hashes, with the reason |

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
npm run verify         # everything below, offline
npm run golden:update  # only when a rendering change is intended or a reference case is added
npm run icons:generate # only when the icon set changes
```

`npm run verify` runs `tsc` and then, in order:

| Gate | What it checks |
| --- | --- |
| registry | every primitive is well-formed, unique, renders, and appears in the prompt and schema |
| validator | unknown layers are dropped, params are clamped, malformed specs are rejected |
| determinism | no ambient randomness, time, file or network access in `src/`; two renders agree; hashes match `golden/hashes.json` |
| purity | no file or network access while drawing; icon output does not depend on the working directory |
| palette | every pixel is a mix of background, foreground and accent |
| reactivity | at a fixed moment, output changes with signal level or with the text the signal carries |
| budget | at 1920×1080, at most 3,000 drawing operations and 50 ms per primitive |

The last four are the vetting gates (`npm run verify:gates`). They apply to every primitive
automatically, and the run ends with a count such as `29/29 primitives pass every gate`.

After `npm run golden:update`, add a row to `golden/CHANGES.md` saying which cases changed
and why. A golden change without a row is rejected in review.

`npm install` points git at `.githooks/`, so `npm run verify` also runs before every push.
CI (`.github/workflows/verify.yml`) is manual-only while the repo is private.

## Rules for primitives

- A frame is a pure function of `(spec, SignalFrame, seed)`. No `Math.random`,
  `Date`, network or file access in `draw` — use `mulberry32` from `src/rng.ts`.
- Draw only with the palette (`bg`, `fg`, `accent`). Monochrome by default.
- CPU canvas only (`@napi-rs/canvas`); GPU rasterizers are not byte-reproducible.

## Known limitations

- The golden hashes were recorded on an arm64 machine. On x64 the determinism gate does not
  yet pass: text uses each machine's own fonts, and x64 rounds soft edges slightly differently.
  Until that is fixed, "byte-identical" holds on the machine that recorded the hashes.
- The gate scripts expect to be run from the repo root.
- `src/types.ts` still carries a few types from the app it was extracted from.

## License

Apache-2.0 — see `LICENSE` and `NOTICE`. Outside contributions will require a signed
Contributor License Agreement (CLA); the agreement and sign-up bot are not set up yet.

## Third-party

`@napi-rs/canvas` (MIT) is the only runtime dependency. Icon bitmaps derived from
`pixelarticons` (MIT) ship inside the library. `@resvg/resvg-js` (MPL-2.0) is used only at
build time, by the icon generator. See `NOTICE`.
