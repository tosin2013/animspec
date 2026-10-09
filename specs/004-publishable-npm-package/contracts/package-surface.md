# Contract: Package Surface

The public surface of the package is exactly `src/index.ts`. A consumer may rely on what it
exports and nothing else; deep imports (for example `animspec/src/...`) are not a contract.

## Entry point

```json
{
  "name": "animspec",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```

The package is ESM-only. Node.js 22 or later.

## Exports

| Export | Kind | What it is |
| --- | --- | --- |
| `drawSpec` | function | the reference interpreter |
| `validateAnimSpec`, `ANIMSPEC_JSON_SCHEMA` | function, object | the validator and its schema |
| `PRIMITIVES`, `getPrimitive`, `sanitizeLayer` | values | the vocabulary and its lookup/sanitize |
| `buildVocabPrompt`, `buildJsonSchema` | functions | model-facing descriptions; **require a `subset` argument** |
| `select`, `selectDetailed`, `KIT_NAMES` | functions, value | deterministic selection (tier-aware) |
| `VOCABULARY_VERSION`, `TIERS` | values | the vocabulary version and tier names |
| `FONTS`, `DEFAULT_FONT` | values | the shipped fonts |
| `mulberry32`, `mixSeed`, `hashBytes` | functions | seeded RNG and hashing |
| types | `AnimSpec`, `SpecOpts`, `Dimensions`, `PrimitiveDef`, `ParamSpec`, `Category`, `Palette`, `DrawContext`, `Tier`, `KitName`, `FontKey`, `ShippedFont`, `ValidationResult`, `SignalFrame` | the public type surface |

## Removed from the surface

- The application types `SignalSource`, `SignalSourceMeta`, `SignalKind`, `AudioAnalysis` and
  `RenderOptions` are gone. `SignalFrame` is the only type carried from `src/types.ts`.
- `buildVocabPrompt()` and `buildJsonSchema()` called with no argument no longer compile: a
  selection is required, so the full vocabulary cannot be shown to a model by accident.

## Guarantees

- Rendering through the package is byte-identical to the reference interpreter on the same
  processor type, and within the stated tolerance across types.
- The package renders from any working directory and on a machine with no fonts installed.
