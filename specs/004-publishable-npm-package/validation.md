# Validation: Publishable npm Package

End-to-end validation against the success criteria, recorded by running every step of
[quickstart.md](quickstart.md) on 2026-10-09 on branch `004-publishable-npm-package`
(macOS, arm64).

## 1. The build produces a package (SC-001, SC-002)

`npm run build` compiles `src/` to `dist/` (ES modules + `.d.ts`). `npm run verify:package`
reports `PASS  package reproduces the golden hashes (150 cases)` — the built package renders
the full reference set identically to the committed golden hashes (the M1 gate).

## 2. The package is self-contained (SC-003)

`npm pack` produces `animspec-0.1.0.tgz` (33 dist files + `package.json`, `LICENSE`, `README.md`,
`NOTICE` and the three font licence texts). Installing that tarball into a scratch folder with
no `assets/` and rendering a grid + caption spec succeeded
(`rendered from installed package: OK`).

## 3. The public surface is clean (SC-004)

`npm run check` passes with the application types (`SignalSource`, `SignalSourceMeta`,
`SignalKind`, `AudioAnalysis`, `RenderOptions`) removed, and `buildVocabPrompt` /
`buildJsonSchema` requiring an explicit `subset` (a no-argument call is a type error). The
packed package exposes only the documented surface plus `dist/` internals.

## 4. Releases and dependency updates (SC-005, SC-006)

`.github/workflows/publish.yml` (tag `v*` → `npm ci` → build → `npm publish --provenance`) and
`.github/dependabot.yml` (npm, weekly) are created. The publish workflow is not registered with
`gh` until the branch is pushed; the first real `npm publish` waits on the 005 legal review and
secret scan.

## 5. Nothing renders differently (SC-007)

`npm run verify` passes (registry, validator, determinism, vetting gates, package gate), and
`git status --short golden/arm64 golden/x64` is empty — no reference frame moved.
