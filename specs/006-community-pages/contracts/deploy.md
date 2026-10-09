# Contract: Deploy workflow

Phase 1 output for [spec.md](spec.md). The deploy workflow is separate automation, never part of
verify (constitution Principle VI; the same separation RELEASING.md records for `publish.yml`).

## File and identity

- Path: `.github/workflows/site.yml`
- Name: `Site`
- Runner: `ubuntu-latest`, GitHub-hosted. No self-hosted runner.
- Environment: `github-pages`, the Pages deployment environment.

## Triggers

| Event | Condition |
| --- | --- |
| `push` to `main` | paths: `site/**`, `gallery/**`, `assets/fonts/**`, `VOCABULARY.md`, `scripts/generate-site.ts`, `.github/workflows/site.yml` |
| `workflow_dispatch` | always available, for a manual redeploy |
| `pull_request` | never |

A push that matches no path triggers nothing and adds zero billed minutes (FR-002, SC-001).

## Permissions

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

No other permission is granted. The workflow writes nothing to the repository: regeneration
output is uploaded as a Pages artifact, never committed back by the workflow.

## Steps (one job)

1. `actions/checkout@v7`
2. `actions/setup-node@v7` with Node 22 and the npm cache
3. `npm ci`
4. `npm run site:generate` (regenerate so the published site can never be stale)
5. `npm run site:check` (fail the deploy on stale or hand-edited generated output; FR-011)
6. `actions/configure-pages@v5`
7. `actions/upload-pages-artifact@v4` with `path: site`
8. `actions/deploy-pages@v4`

Failure of step 5 fails the deploy: the artifact is never uploaded with drift in it.

## Concurrency and timeout

- `concurrency`: one deploy at a time per ref, `cancel-in-progress: true`, so a burst of
  site-affecting pushes deploys only the newest state.
- `timeout-minutes: 5`, matching the repository's workflow discipline.

## Non-goals

- The workflow MUST NOT run `npm run verify`: verify ran before the push (pre-push hook and CI)
  and stays out of deploy automation.
- The workflow MUST NOT deploy pull requests.
- The workflow MUST NOT push generated files back to any branch.

## One-time enablement (held by the maintainer)

Repository Settings, Pages, Build and deployment, Source: **GitHub Actions**. The deploy
workflow fails with the platform's message until this is set; quickstart.md documents the check.