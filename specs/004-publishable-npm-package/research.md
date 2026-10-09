# Research: Publishable npm Package

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-09

Decisions taken while planning. Each was checked against the code as it stands on `main` on
2026-10-09.

## R1. How the library is built

**Decision**: Compile with `tsc` into `dist/` using a dedicated `tsconfig.build.json`
(`noEmit: false`, `declaration: true`, `outDir: "dist"`), emitting ES modules with `.js`
extensions on relative imports. `@napi-rs/canvas` stays an external dependency.

**Rationale**: The library is already pure ESM with no runtime dependency to bundle, so a
bundler adds a dev dependency for no benefit. `tsc` is already a dev dependency, satisfying the
"complexity default is no" rule. Adding `.js` extensions to the handful of relative imports is
mechanical and reviewable, and makes the emitted code runnable under Node's ESM resolver.

**Alternatives considered**:

- `tsup`/esbuild bundling: one extra dev dependency, and it hides the emit step behind a tool
  the project does not otherwise use.
- Publishing raw `src/` (the current `exports: "./src/index.ts"`): works only for consumers who
  compile or run with `tsx`; breaks for ordinary npm consumers.

## R2. Package entry points and shape

**Decision**: ESM-only. `package.json` declares `"type": "module"` (already), an `exports` map
of `"."` → `{ "types": "./dist/index.d.ts", "import": "./dist/index.js" }`, `files: ["dist"]`,
`main`/`module`/`types` for older resolvers, and a `publishConfig` with public access. The
public surface is exactly `src/index.ts`.

**Rationale**: The library is ESM-only today; no CommonJS build is added. Restricting `files`
to `dist/` guarantees no source or asset files leak into the published package, which is what
makes it self-contained.

**Alternatives considered**:

- Dual CJS/ESM output: doubles the build surface for consumers who can all use ESM (Node 22+).
- Multiple subpath exports: the spec says only the public entry point is a contract; deep
  imports are unsupported.

## R3. Removing the full-vocabulary default

**Decision**: `buildVocabPrompt(subset)` and `buildJsonSchema(subset)` lose their default
argument and require an explicit `subset`. `ANIMSPEC_JSON_SCHEMA` in `src/specValidator.ts`
becomes `buildJsonSchema(PRIMITIVES)`. The gate scripts already pass `PRIMITIVES` or a selection
explicitly, so only that one call site changes.

**Rationale**: This is the deferred item from 003 (research.md R10): a no-argument call returns
the whole registry, every tier included, which is what the validator accepts but must never be
shown to a model. Requiring the argument makes the leak impossible.

**Alternatives considered**:

- Keep the default and document "don't use it": the contract already says this, and it did not
  stop the risk; removing it is the enforcement.
- Make the default an error but keep the parameter optional: indistinguishable from removal in
  effect, and it complicates the type.

## R4. Removing the leftover application types

**Decision**: In `src/types.ts`, keep only `SignalFrame` (the frame contract the interpreter
consumes). Remove `SignalSource`, `SignalSourceMeta`, `SignalKind`, `AudioAnalysis` and
`RenderOptions`, and drop them from `src/index.ts`.

**Rationale**: `SignalFrame` is the only type the library reads; the others describe the
application the code was extracted from (they reference `videoProcessor`, `job`, `ffprobe`, the
"datamatics/data-verse lineage"). They are the "few types from the app" the README's known
limitations note. Nothing in `src/` uses them except `types.ts` itself and the re-export.

**Alternatives considered**:

- Keep them "for compatibility": there are no consumers yet (private, pre-release), so keeping
  them would only preserve dead surface.
- Move them to a separate `app-types.ts`: still dead surface; removal is cleaner.

## R5. Automated release

**Decision**: A new `.github/workflows/publish.yml` runs on a tag push matching `v*`: check out,
`npm ci`, `npm run build`, then `npm publish --provenance` using an `NPM_TOKEN` secret. It does
not run `npm run verify` (that gate runs before the tag is cut, via the normal pre-push hook and
CI). Re-publishing an unchanged version is refused by the registry and additionally guarded by
tagging: a release tag maps one-to-one to a version.

**Rationale**: A tag-triggered release is the standard, auditable pattern; the version is the
tag, so a release is reproducible from source. Provenance links the published package to the
commit that built it.

**Alternatives considered**:

- Publish on merge to `main`: mixes "every commit" with "a release", and gives no clean
  version boundary.
- Manual `npm publish` from a machine: reintroduces the hand-built step the spec forbids.

## R6. Dependency updates

**Decision**: A `.github/dependabot.yml` proposes npm updates on a weekly schedule. Each
proposal runs the offline verify before it can merge. Until the repository is public, CI is
manual-only, so the auto-run of verify on a Dependabot PR is the `pull_request:` trigger added
as part of 005; in the interim the maintainer runs the manual Verify workflow on a Dependabot
branch before merging.

**Rationale**: Dependabot is the zero-config GitHub-native way to keep `@napi-rs/canvas` and the
dev dependencies current. The offline verify is the whole safety bar, so nothing else is added.

**Alternatives considered**:

- A cron workflow that bumps deps and opens PRs: reinvents Dependabot.
- Renovate: more capable but more surface than this repository needs.

## R7. Proving the package reproduces the golden hashes (the M1 gate)

**Decision**: A new `scripts/verify-package.ts` runs in the `verify` chain: it builds to
`dist/`, packs a tarball, installs that tarball into a scratch directory (no network), imports
the installed package, and runs `computeHashes` from `scripts/lib/goldenHashes.ts` with the
package's exports as the injected API. It fails unless every hash matches the committed golden
set for the machine's processor type.

**Rationale**: The M1 gate is "the private product renders from the package with identical
hashes". `computeHashes` already takes an injectable `api`, so the same golden render runs
against the installed package and against the source tree; equal hashes prove SC-001 and SC-002.

**Alternatives considered**:

- Only a smoke import: proves the package loads, not that it renders identically.
- A manual checklist step: not enforced on every run, so it would drift.
