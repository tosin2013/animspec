# Research: Plugin Slot

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Where external primitives live

**Decision**:
- `registry.ts` gains a second map, `EXTERNALS: Map<string, PrimitiveDef>`, keyed by the full
  type `ext:<id>/<type>`, plus an internal `addExternal(def)`.
- `getPrimitive` and `sanitizeLayer` look in `byType` first, then in `EXTERNALS`.
- A new `src/plugins.ts` owns the plugin records (`id → { version, licence, types }`) and the
  public `registerPlugin()`. It validates and namespaces each primitive (a copy with
  `type: "ext:<id>/<type>"` and `tier: "external"`), then calls `addExternal`.

**Rationale**:
- `PRIMITIVES` (the core array) is untouched, so everything derived from it ignores plugins
  by construction (FR-009, FR-010):
  - the selector, `buildVocabPrompt` and `buildJsonSchema` defaults;
  - the vocabulary record;
  - the golden cases and the gates.
- The interpreter and validator reach externals through the same `getPrimitive` and
  `sanitizeLayer`, so binds, the camera, `depth` and transparency work unchanged (FR-005).
- No circular import: `plugins.ts` imports `registry.ts`, not the other way round.

**Tier**: `TIERS` gains `"external"`. `tierProblems` (`scripts/lib/vocabularyRules.ts`)
already rejects tiers outside the set for core. It must reject `external` on a core primitive
too, which needs a check and a fixture.

## R2. Validation rules (`src/specValidator.ts`)

- **`plugins`**: `sanitizePlugins(raw)` keeps `{ id: { version } }` entries with a valid id and
  a non-empty version string (at most 64 characters). It drops and reports the rest.
- **For each `ext:` layer**, in order:
  1. Check the id is declared in the spec, else drop with `plugin <id> is not declared in plugins`.
  2. Check the plugin is registered in the host, else `plugin <id> is not registered`.
  3. Check the registered version equals the declared one, else `plugin <id> is version <r>, spec wants <d>`.
  4. Check the plugin provides the type, else `plugin <id> has no type <t>`.

  Each failure pushes the layer's type into `dropped`, as an unknown core type does today.
- **Params** are clamped by the shared `sanitizeLayer`.

## R3. Registration rules (`registerPlugin`)

Registration refuses (throws an `Error` with the reason):
- an id failing `ROLE_NAME`;
- an empty or over-long version or licence;
- a primitive type failing `ROLE_NAME`, or duplicated within the plugin;
- params failing the same well-formedness rules core is held to (reusing the registry gate's
  param checks, moved to a shared helper `paramSpecProblems`);
- the same id already registered at a different version.

Re-registering at the same version is a no-op.

## R4. A throwing plugin

`drawSpec` wraps only `ext:` layers in `try` and `ctx.save`/`restore`. A throw draws nothing
for that layer and calls `opts.onLayerError?.(type, error)`. Core layers keep exactly today's
path, so no frame can move. The CLI reports these errors as JSON lines on stderr.

## R5. The verifier lives in `verify/` (`animspec/verify`), not `src/`

**Finding**: the determinism gate statically scans `src/` and forbids `fs` imports and
`performance.now` (`verify-determinism.ts:96-103`). The purity check patches `fs` (the IO
guard), and the budget check times draws. Neither can live in `src/`.

**Decision**:
- **A new top-level `verify/` folder**, compiled by a new `tsconfig.verify.json` to
  `dist-verify/`. It is published as the package subpath `animspec/verify`: an `exports`
  entry plus `files`.
- **What moves there from `scripts/lib/gateKit.ts`**: the IO guard, `renderProbe`,
  `probeLayers`, `signalFrame`, `countOperations`, `measureBudget`, `paletteViolation` and its
  geometry.
- **Per-primitive checks**: the per-def bodies of `runPurityGate`, `runPaletteGate`,
  `runReactivityGate` and `runBudgetGate` (`scripts/verify-gates.ts`) become exported
  `checkPurity`, `checkPalette`, `checkReactivity` and `checkBudget`, each taking a
  `PrimitiveDef`.
- **One implementation**: `gateKit.ts` re-exports the moved functions, and `verify-gates.ts`
  maps the core defs through the same checks (FR-008).
- **Determinism for plugins**: `checkDeterminism(def)` renders each probe layer twice, and in
  forward and reverse frame order, comparing hashes. Core keeps its stronger golden and
  multi-process checks in `verify-determinism.ts`.
- **`verifyPlugin(plugin)`** runs the five checks over each primitive and returns
  `{ ok, primitives: [{ type, checks: { name, pass, measured, allowed }[] }] }`.

**Risk**: the move must not change any gate verdict. The plan's first step is a pure move,
with the full verify run unchanged, before any plugin code.

## R6. CLI

- `--plugin <path>` is repeatable. Each module is `import()`ed before validation, and must
  `export default` a plugin object, which the CLI passes to `registerPlugin`.
- The manifest gains `plugins: [{ id, version, licence }]` for the plugins the spec uses,
  plus `"guarantee": "core-only"` when any plugin is used.
- A new subcommand, `animspec verify-plugin <path>`, prints the report and exits non-zero on
  a failure, so Motion Studio can run it in its own CI.

## R7. Constitution 6.0.0

- **Principle I**: the guarantee covers core primitives. Plugin output is "proven" by
  `verifyPlugin` and not covered by the reference sets.
- **Principle II**: the registry is the single source for core. External primitives enter
  only through `registerPlugin`, namespaced `ext:<id>/<type>`, in the `external` tier.
- **Principle IV**: models see externals only when explicitly named.
- **Principle VII (scope)**:
  - "The format" gains `plugins` and `ext:` types.
  - The public surface gains `registerPlugin`, the `animspec/verify` entry, and the CLI's
    `--plugin` and `verify-plugin`.
- **Quality Gates**: a row for "plugin verifier shares the core checks; fixture plugins
  pass and fail as expected".
- **Version**: MAJOR, because principles are redefined.

## R8. Fixtures and checks

`scripts/fixtures/plugins/` holds:
- `good.ts`: a `starfield` primitive drawn with fg and accent, reacting to amplitude.
- `random.ts`: uses `Math.random`.
- `offpalette.ts`: draws `#00ff00`.
- `fileread.ts`: calls `fs.readFileSync` in draw.
- `heavy.ts`: 5,000 fills.

The checks go in the existing gates:
- **Registry gate**:
  - the external tier is excluded from 1,000 selections with `good` registered;
  - registration refusals (bad id, colliding type, version conflict);
  - `tierProblems` rejects `external` on core.
- **Validator gate**: the four drop reasons.
- **Determinism gate**:
  - a `good` layer renders identically twice and chunked, with a bind and the camera;
  - a throwing plugin draws nothing and reports.
- **Vetting gates**:
  - `verifyPlugin(good)` passes;
  - each faulty fixture fails exactly its check.
- **CLI gate**:
  - `--plugin` renders, and the manifest records the plugin;
  - `verify-plugin` exits 0 for `good` and non-zero for `random`.
