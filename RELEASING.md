# Releasing

How to publish a new version of `animspec`. Releases are automated; the steps are
deliberately short.

## The short version

1. Bump the `version` in `package.json` (semver — a major bump only for a breaking change).
2. Run `npm run verify` and make sure it is green.
3. Tag and push:

   ```bash
   git tag v<version>
   git push origin v<version>
   ```

The `.github/workflows/publish.yml` workflow runs on the tag: `npm ci` → `npm run build` →
`npm publish --provenance`. There is no hand-built artifact.

## Rules

- A release maps one-to-one to a tag, so any published version is reproducible from source.
- Re-publishing an unchanged version is refused by the registry.
- `npm run verify` does **not** run inside the release workflow — it runs before the tag is
  cut (the pre-push hook and CI). The release workflow is separate automation, never part of
  `verify`, and uses a GitHub-hosted runner.
- The package is ESM-only; Node.js 22 or later.

## What is *not* a release

- **Dependabot** only opens pull requests to bump dependencies. It never publishes. A
  dependency update becomes a release only when you later tag a version that includes it.
- A dependency bump that moves a golden hash is a rendering change: it fails `verify`, and the
  reference sets must be refreshed (see `npm run golden:update`), not merged silently.

## Before the first public publish

The package is built and consumable now, but the first real `npm publish` and making the
repository public wait on spec 005: a legal review of the licence and CLA, a secret scan, and a
security policy (`SECURITY.md`).
