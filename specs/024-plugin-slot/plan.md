# Implementation Plan: Plugin Slot

**Branch**: `feature/024-plugin-slot` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/024-plugin-slot/spec.md`

## Summary

A host registers plugins (`registerPlugin`). Their primitives become namespaced
`ext:<id>/<type>` definitions in a separate map beside the core registry, so everything
derived from core ignores them by construction: the selector, prompt and schema defaults,
the vocabulary record, the goldens and the gates. A spec declares `plugins` with exact
versions, and the validator keeps only declared, registered, version-matched types.

The gate checks move into a new `verify/` entry (`animspec/verify`). That is required because
`src/` may not import `fs` or use a clock. There they serve both core's gates and
`verifyPlugin`, as one implementation. The CLI gains `--plugin` and `verify-plugin`.
Constitution 6.0.0. See [research.md](research.md) R1–R8.

**Checkpoint**: [contracts/plugin-slot.md](contracts/plugin-slot.md) is reviewed against
Motion Studio's plugin host before `/speckit-implement`.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in `strict` mode, ES modules; Node.js 22 or later

**Primary Dependencies**: `@napi-rs/canvas` (unchanged). No dependency added.

**Storage**: no new reference cases; core references never include plugin output. There are
fixture plugins in `scripts/fixtures/plugins/`.

**Testing**: The existing gates chained by `npm run verify`.

**Target Platform**: Node.js on arm64 and x64, macOS and Linux

**Project Type**: Library + CLI + a new verification entry, with an offline verification
harness

**Performance Goals**: An `ext:` layer adds one map lookup. Verify stays under the 2-minute
target.

**Constraints**:
- No existing hash moves.
- No gate verdict changes from the move (R5).
- `src/` stays free of `fs` and the clock.
- Verify stays offline.

**Scale/Scope**:
- New `src/plugins.ts`; `registry.ts` (`EXTERNALS`, lookup, tier); validator; interpreter
  (`try` around `ext:` layers).
- A new `verify/` folder and `tsconfig.verify.json`; `package.json` (`exports`, `files`,
  build).
- The CLI (`--plugin`, `verify-plugin`); `gateKit.ts` and `verify-gates.ts` (re-export and
  map).
- Fixtures, the gates, the constitution and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 5.0.0, and against the amended 6.0.0 text this feature ships.

| Principle | Verdict | Notes |
| --- | --- | --- |
| I. Determinism | **Amended** | Core is unchanged. 6.0.0 scopes the byte-identical guarantee to core; plugins are proven by `verifyPlugin`, not covered by the reference sets. |
| II. Single source | **Amended** | Under 5.0.0 every primitive is in one registry. 6.0.0 keeps that for core and admits externals through the one `registerPlugin` slot, namespaced and tiered. |
| III. Palette roles | Pass | Plugins are held to it by `verifyPlugin`'s palette check. |
| IV. Untrusted input | Pass | Undeclared, unregistered, wrong-version and unknown types are dropped and reported. Models never see externals unless named. |
| V. Saved specs keep rendering | Pass | Core paths are unchanged. Plugin specs pin exact versions. |
| VI. One offline verify | Pass | Fixture plugins. The moved checks still run inside verify. |
| VII. Boundaries | Pass, with a boundary change | New public surface: `registerPlugin`, `animspec/verify`, CLI `--plugin` and `verify-plugin`, the `external` tier. Format: `plugins` and `ext:`. All named in the amendment. |

**Violation record**: Principles I and II under 5.0.0. They are justified by #92 and the
Motion Studio integration, and resolved by the MAJOR amendment in the same change.

**Post-design re-check**: unchanged.

## Project Structure

```text
specs/024-plugin-slot/  plan.md, research.md, data-model.md, quickstart.md,
                        contracts/plugin-slot.md, checklists/requirements.md, tasks.md

src/plugins.ts               # NEW: registerPlugin, plugin records, sanitizePlugins, paramSpecProblems use
src/primitives/registry.ts   # EXTERNALS map; getPrimitive/sanitizeLayer lookup; TIERS + "external"
src/specValidator.ts         # plugins field; ext: layer rules
src/specInterpreter.ts       # AnimSpec.plugins; try/save/restore around ext: layers; opts.onLayerError
src/index.ts                 # export registerPlugin, registeredPlugins
verify/index.ts              # NEW (animspec/verify): moved gate checks + verifyPlugin
tsconfig.verify.json         # NEW → dist-verify/
package.json                 # exports "./verify", files dist-verify, build step
cli/render.ts, cli/animspec.ts  # --plugin; verify-plugin subcommand; manifest
scripts/lib/gateKit.ts       # re-export moved functions from ../../verify
scripts/verify-gates.ts      # core gates map defs through verify/ checks; verifyPlugin fixture checks
scripts/fixtures/plugins/    # NEW: good, random, offpalette, fileread, heavy
scripts/verify-registry.ts, verify-spec-validator.ts, verify-determinism.ts, verify-cli.ts
.specify/memory/constitution.md (6.0.0), docs/user-guide.md, CHANGELOG.md, specs/ROADMAP.md
```

**Structure Decision**: a new `verify/` top-level entry beside `cli/`, because the checks
need `fs` patching and a clock, which `src/` forbids.

## Design Notes

**Order of work**:
1. Pure move of the gate checks into `verify/`, with `gateKit` re-exporting. The full
   verify must give identical output, verdict for verdict.
2. The registry's external map and tier.
3. `plugins.ts` and `registerPlugin`.
4. The validator rules.
5. Interpreter error isolation.
6. `verifyPlugin`.
7. The CLI.
8. Fixtures and checks.
9. The constitution 6.0.0 amendment and docs.
10. Verify, at most 3 failed attempts.
11. The PR.

The vocabulary is unchanged, because the core registry does not change.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principles I and II redefined | #92: content outside core without forking | Forking or drawing outside animspec loses validation, the camera, binds and checks |
| New `verify/` package entry | Gate checks need `fs` patching and a clock; `src/` forbids both | Putting them in `src/` breaks the static scan; leaving them script-only means no `verifyPlugin` for hosts |
