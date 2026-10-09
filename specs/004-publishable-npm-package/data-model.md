# Data Model: Publishable npm Package

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Package

The built, installable form of the library.

| Field | Meaning |
| --- | --- |
| `name` | `animspec` (settled, verified unclaimed) |
| `version` | semver; starts at `0.1.0` for the first publish |
| `exports` | the public entry points; exactly `.` → `dist/index.js` (+ `.d.ts`) |
| `files` | `dist/` only — nothing else is published |
| `dependencies` | `@napi-rs/canvas` only |

**Rules**:

- The package is self-contained: fonts and icons are compiled in-memory modules; nothing is
  read from disk at runtime.
- The package is ESM-only (`"type": "module"`).

## Public surface

The set of exports a consumer may rely on, defined by `src/index.ts`.

| Group | Exports |
| --- | --- |
| Interpreter | `drawSpec`, `AnimSpec`, `SpecOpts`, `Dimensions` |
| Registry / vocabulary | `PRIMITIVES`, `getPrimitive`, `sanitizeLayer`, `buildJsonSchema`, `buildVocabPrompt`, `VOCABULARY_VERSION`, `TIERS`, `Tier`, `PrimitiveDef`, `ParamSpec`, `Category`, `Palette`, `DrawContext` |
| Selector | `select`, `selectDetailed`, `KIT_NAMES`, `KitName` |
| Validator | `validateAnimSpec`, `ANIMSPEC_JSON_SCHEMA`, `ValidationResult` |
| Fonts | `FONTS`, `DEFAULT_FONT`, `FontKey`, `ShippedFont` |
| RNG | `mulberry32`, `mixSeed`, `hashBytes` |
| Signal | `SignalFrame` |

**Rules**:

- Only `SignalFrame` remains from `src/types.ts`; the application types
  (`SignalSource`, `SignalSourceMeta`, `SignalKind`, `AudioAnalysis`, `RenderOptions`) are
  removed.
- `buildVocabPrompt` and `buildJsonSchema` require a `subset` argument; there is no
  full-vocabulary default.

## Release

One published version.

| Field | Meaning |
| --- | --- |
| `version` | semver, tied one-to-one to a git tag `v<version>` |
| `tag` | the git tag that triggered the release |
| `provenance` | a link from the published package back to the commit that built it |

**Rules**:

- A release is triggered by a maintainer cutting a tag; the build and publish are automated.
- Re-publishing an unchanged version is refused (the registry enforces this, and the tag maps
  one-to-one to a version).
- A breaking change is introduced only in a major version (constitution Principle V).

## Dependency update

A proposed change to a declared dependency.

| Field | Meaning |
| --- | --- |
| `dependency` | the package and range being updated |
| `proposal` | a pull request opened automatically (weekly) |
| `verification` | the offline `npm run verify` gate |

**Rules**:

- Every proposal runs the offline verify; it merges only if that gate passes.
- A proposal that moves a golden hash is a rendering change and must be handled as one
  (refresh reference sets), not merged silently.
