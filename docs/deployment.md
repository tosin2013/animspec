# animspec Deployment and Release Runbook

**Owner:** animspec maintainers
**Risk Level:** Medium
**Last Updated:** 2026-10-09
**Last Tested:** 2026-10-09
**Version:** 1.0.0

---

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Execution Time** | ~15 minutes for a release, plus CI time |
| **Impact Window** | No downtime. Consumers choose when to upgrade. |
| **Rollback Time** | ~5 minutes, by deprecation and fix-forward |
| **Prerequisites** | Green `npm run verify`, a clean working tree, maintainer rights |

animspec is a library, not a hosted service. Deployment here means publishing a version to the npm registry. Consumers deploy their own applications.

---

## Scope and Use Case

### When to use this runbook

- You publish a new version of `animspec`.
- You refresh the golden reference sets after an intended rendering change.
- You raise the vocabulary version.

### Expected outcome

A tag `v<version>` maps one-to-one to a published npm version, reproducible from source with provenance attestation.

### What this runbook does not cover

- Writing or reviewing primitives. See [CONTRIBUTING.md](../CONTRIBUTING.md).
- Consumer application deployment. Each consumer owns their pipeline.
- The first public publish. It waits on the checks in [RELEASING.md](../RELEASING.md).

---

## Prerequisites

### Required access

- [ ] Maintainer rights on `github.com/tosin2013/animspec`
- [ ] Permission to push tags to the repository
- [ ] npm trusted publishing configured for the repository (OIDC)

### Required tools

- [ ] Node.js 22 or later
- [ ] npm 11 or later, for local checks of publish behaviour
- [ ] Docker, only for the golden reference set procedure

Verify the tools:

```bash
node --version
npm --version
docker --version
```

### System state requirements

- [ ] The working tree is clean and on `main`.
- [ ] No other release is in progress.
- [ ] CI is green on `main`.

---

## Pre-Flight Checks

Stop unless every check passes.

### Check 1: Confirm a clean state

```bash
git status --short
git log origin/main..HEAD --oneline
```

**Pass criteria:** both commands print nothing.
**Fail action:** commit or stash your changes, then push `main`.

### Check 2: Run the full verification suite

```bash
npm install
npm run verify
```

**Pass criteria:** the run ends green, ending with a gate count such as `29/29 primitives pass every gate`.
**Fail action:** fix the failure before any release step. Do not tag a red build.

### Check 3: Confirm the version is new

```bash
node -p "require('./package.json').version"
npm view animspec versions
```

**Pass criteria:** the package.json version does not appear in the published list.
**Fail action:** the registry refuses to re-publish an unchanged version. Choose the next version number.

---

## Procedure A: Release a version

### Step 1: Bump the version

Edit the `version` field in `package.json`.

Follow semver. A breaking change requires a major bump. A new primitive or a param addition is a minor bump. A fix is a patch bump.

**Expected result:** `package.json` shows the new version.

### Step 2: Verify the build

```bash
npm run verify
```

**Expected result:** every gate passes.
**If this fails:** stop. Tagging a red build publishes a broken release.

### Step 3: Commit and tag

```bash
git add package.json package-lock.json
git commit -m "Release v<version>"
git tag v<version>
git push origin main
git push origin v<version>
```

**Expected result:** the tag exists on the remote at the release commit.

### Step 4: Let CI publish

The push of the tag triggers `.github/workflows/publish.yml`.

The workflow runs on GitHub-hosted `ubuntu-latest` with Node 24, installs npm 11, then runs `npm ci`, `npm run build` and `npm publish --provenance`. It uses OIDC trusted publishing, so no npm token is stored in the repository.

**Expected result:** the Publish workflow completes green.
**If this fails:** go to [Troubleshooting](#troubleshooting).

### Step 5: Confirm the publication

```bash
npm view animspec@<version>
npm view animspec@<version> dist
```

**Pass criteria:** the version appears on the registry, and the tarball contains `dist`, `NOTICE`, `LICENSE` and the three font licence texts.

---

## Procedure B: Refresh the golden reference sets

Use this procedure when a rendering change is intended, when a reference case is added, or when a dependency bump moves a golden hash.

### Step 1: Confirm Docker runs

```bash
docker info
```

**Pass criteria:** the command prints server information.
**Fail action:** start Docker and retry.

### Step 2: Refresh both sets

```bash
npm run golden:update
```

The script renders the reference set for the local processor type directly. It renders the other type in a `node:22` container. It needs the network on the first run.

**Expected result:** the script prints which cases changed in which set, and replaces `golden/arm64` and `golden/x64` together.
**If this fails:** the script changes nothing. Fix the reported error and retry.

### Step 3: Log the change

Add a row to `golden/CHANGES.md`. Name the primitive, the cases, the set (`arm64`, `x64` or `both`) and the reason.

**Expected result:** every changed case has a row. Review rejects a reference change without a row.

### Step 4: Verify

```bash
npm run verify
```

**Expected result:** the determinism gate passes against both refreshed sets.

---

## Procedure C: Raise the vocabulary version

Use this procedure when the primitive vocabulary changes.

### Step 1: Edit the registry

Change `src/primitives/registry.ts`, including the `VOCABULARY_VERSION` constant, which you raise by one.

### Step 2: Record the version

```bash
npm run vocab:record -- "<one-line summary>"
```

**Expected result:** `golden/vocabulary.json` gains an entry and `VOCABULARY.md` is regenerated. A raised version with an unchanged vocabulary is refused.

### Step 3: Commit everything together

Commit `src/primitives/registry.ts`, `golden/vocabulary.json` and `VOCABULARY.md` in one commit.

### Step 4: Verify

```bash
npm run verify
```

---

## Verification and success criteria

After a release, confirm each item:

- [ ] The Publish workflow is green for the tag.
- [ ] `npm view animspec@<version>` shows the version.
- [ ] The published tarball contains only `dist`, `NOTICE`, `LICENSE` and the font licence texts.
- [ ] A fresh project can install and import the package on Node 22.
- [ ] The pre-push hook ran `npm run verify` before the tag was pushed.

---

## Rollback procedure

### When to act

Act immediately if any of these occur:

- The published version renders differently from the tag.
- The package cannot be installed or imported.
- A gate failure was discovered after publication.

### Rollback steps

The npm registry refuses to re-publish an unchanged version. The rollback path is deprecate and fix forward.

1. Deprecate the bad version:

   ```bash
   npm deprecate animspec@<version> "Broken in <way>. Upgrade to <next version>."
   ```

2. Fix the problem on `main`.
3. Release the fix as a new version, through Procedure A.
4. Un-deprecate the old version only if it turns out not to be broken:

   ```bash
   npm deprecate animspec@<version> ""
   ```

Do not unpublish. Unpublishing breaks every consumer that pinned the version, and npm policy restricts it.

### Notify stakeholders

- Open an issue describing what went wrong and the fix.
- Record the incident in the release discussion for that tag.

---

## Troubleshooting

### Issue 1: The Publish workflow fails at login

**Symptoms:** the workflow fails at `npm publish` with an authentication error.
**Cause:** trusted publishing is not configured for the repository on npm, or the workflow used npm below 11.5.1. The workflow installs `npm@11` itself, so check the trusted publishing settings first.
**Solution:** confirm the package is registered for OIDC trusted publishing from the repository, then re-run the workflow from the tag.

### Issue 2: `verify` fails in CI but passes locally

**Symptoms:** the determinism gate fails on the CI runner, an x64 machine, but passed on your arm64 machine.
**Cause:** the golden hashes moved for one processor type only. CI compares against `golden/x64`, your machine against `golden/arm64`.
**Solution:** run Procedure B on a machine of the type that drifted, or refresh both sets. Never force a merge past a red gate.

### Issue 3: The determinism gate prints that the exact comparison was not made

**Symptoms:** the gate reports the exact comparison was not made and does not report a pass.
**Cause:** the machine is Windows or a processor type with no reference set.
**Solution:** run the gates on an arm64 or x64 machine with macOS or Linux.

### Issue 4: A dependency bump fails the determinism gate

**Symptoms:** a Dependabot pull request for `@napi-rs/canvas` fails `verify` with hash mismatches.
**Cause:** the new rasterizer version changed rendering output. The bump is a rendering change.
**Solution:** run Procedure B on the pull request branch, add the `golden/CHANGES.md` row naming the reason, and let review check it.

### Issue 5: `golden:update` fails

**Symptoms:** the script exits with an error and leaves the golden sets untouched.
**Cause:** Docker is not running, or the first run had no network access.
**Solution:** start Docker, confirm network access for the first container pull, and retry. The script replaces both sets together or neither, so a failed run leaves a consistent state.

### Escalation path

| Severity | First contact | Response time |
|----------|---------------|---------------|
| Broken published version | Repository maintainers | Immediate |
| Release workflow down | Repository maintainers | Same day |
| Security issue | Follow [SECURITY.md](../SECURITY.md) | Per policy |

---

## Automation

### What is already automated

- Verification: the `.githooks/pre-push` hook runs `npm run verify` on every push. The `prepare` npm script installs the hook.
- CI verification: `.github/workflows/verify.yml` runs on pushes to `main` and on pull requests. It performs a gitleaks secret scan, a CLA check against `CLA-SIGNERS.json`, `npm ci` and `npm run verify`.
- Publishing: `.github/workflows/publish.yml` builds and publishes on a `v*` tag, with provenance.
- Dependency updates: Dependabot opens pull requests only. It never publishes.

### Commands you run by hand

| Command | Purpose |
|---------|---------|
| `npm run verify` | The full offline gate suite |
| `npm run golden:update` | Refresh both reference sets, needs Docker |
| `npm run vocab:record -- "<summary>"` | Record a vocabulary version |
| `npm run fonts:generate` | Regenerate font data, only when a font file changes |
| `npm run icons:generate` | Regenerate icon data, only when the icon set changes |
| `npm run gallery:generate` | Regenerate gallery thumbnails |

---

## Post-execution tasks

### Within 5 minutes

- [ ] Confirm the Publish workflow is green.
- [ ] Confirm the version appears on the registry.
- [ ] Install the published package into a scratch project and render one frame.

### Within 24 hours

- [ ] Record the actual execution time against this runbook.
- [ ] Update this runbook if any step changed.

### Within 1 week

- [ ] Review Dependabot pull requests opened by the release.
- [ ] Check open issues for regressions reported against the new version.

---

## Related documentation

- [RELEASING.md](../RELEASING.md): the release rules in short form
- [Software Design Document](DESIGN_DOC.md): architecture, gates and reference sets
- [User Guide](user-guide.md): how consumers install and use the package
- [CONTRIBUTING.md](../CONTRIBUTING.md): the primitive proposal path
- [SECURITY.md](../SECURITY.md): vulnerability reporting

---

## Version history

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-10-09 | Initial version, written from the repository's workflows and RELEASING.md |