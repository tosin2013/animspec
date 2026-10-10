# Contract: The agent environment workflow

Phase 1 output for [spec.md](spec.md). `copilot-setup-steps.yml` prepares the Copilot cloud agent's machine before it
starts. It is separate automation, never part of verify (constitution Principle VI; the same separation recorded for
`publish.yml` and `site.yml`).

## File and identity

- Path: `.github/workflows/copilot-setup-steps.yml`
- Name: `Copilot Setup Steps`
- Job id: `copilot-setup-steps`. GitHub requires exactly this name; any other job id is ignored.
- Runner: `ubuntu-latest`. The agent supports only Ubuntu x64 and Windows 64-bit.
- The file takes effect only once it is on the default branch.

## What GitHub lets the file set

Only `steps`, `permissions`, `runs-on`, `services`, `snapshot` and `timeout-minutes` (at most 59) are honoured; anything
else is ignored. A failing step skips the remaining steps and the agent starts with whatever state exists, so the order
puts the certain steps first and the optional steps last.

## Triggers

| Event | Condition |
| --- | --- |
| `workflow_dispatch` | always, for a manual check from the Actions tab |
| `push` | paths: `.github/workflows/copilot-setup-steps.yml` only |
| `pull_request` | paths: `.github/workflows/copilot-setup-steps.yml` only |

The path filters make the workflow run when it changes and when the agent starts, so a typical push adds no run.

## Permissions

```yaml
permissions:
  contents: read
```

Nothing else. The agent receives its own token, so the setup job needs no write access and no secret.

## Steps

In this order.

1. `actions/checkout@v7`
2. `actions/setup-node@v7` with Node 22 and the npm cache
3. `npm ci`
4. `docker/setup-qemu-action` for `arm64`, so an arm64 container can run on the x64 machine
5. `docker pull --platform linux/arm64 node:22`, the image `scripts/golden-update.ts` runs for the other processor type
6. A smoke check, `docker run --rm --platform linux/arm64 node:22 uname -m`, which must print `aarch64`

Steps 4 to 6 are what make the cross-processor reference refresh possible (FR-007). Setup steps run outside the agent's
firewall, so privileged registration and image pulls happen here and not in the agent's session.

## Timeout

`timeout-minutes: 20`. The agent's own session is capped at 59 minutes, and setup time counts against the task, so the
setup stays well inside it.

## What it does not do

- It does not run `npm run verify`, the gates, or any generator.
- It does not change the firewall. Allowing extra hosts is a repository setting held by the maintainer.
- It does not enable arm64 emulation for anything except the agent's own runs.
- It does not pass a secret or write to the repository.

## Validation

After the file is merged, run it from the Actions tab. Expected: all steps green and the smoke check printing `aarch64`.
The same run, started by a real task, shows its output in the session log.