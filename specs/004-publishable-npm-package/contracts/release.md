# Contract: Release and Dependency Updates

## Releasing a version

1. The maintainer decides the new semver version (major only for a breaking change).
2. They cut a tag `v<version>` and push it.
3. The release workflow builds and publishes the package automatically — no hand-built
   artifacts.

```text
tag v1.0.0 pushed → npm ci → npm run build → npm publish (provenance) → package published
```

- The version maps one-to-one to the tag, so a release is reproducible from source.
- Re-publishing an unchanged version is refused by the registry.
- `npm run verify` does **not** run in the release workflow; it runs before the tag is cut (the
  pre-push hook and CI). The release workflow is separate automation, never part of `verify`,
  and uses a GitHub-hosted runner.

## Dependency updates

Dependabot proposes npm updates weekly. Each proposal is a pull request that must pass the
offline `npm run verify` before it merges.

| Situation | Outcome |
| --- | --- |
| a dependency update passes `verify` | it may merge |
| a dependency update moves a golden hash | it fails `verify`; treat it as a rendering change and refresh the reference sets, never merge silently |

## Public-launch gate (held by 005)

Actually making the package publicly installable waits on: the legal review of the licence and
CLA, a security policy (`SECURITY.md`), and a secret scan before the first public push. This
feature builds the package and its machinery and stops short of the public launch.
