# Contract: The agent pull request guard

Phase 1 output for [spec.md](spec.md). One script, `scripts/agent-pr-guard.ts`, run from the existing verify job for
agent-authored pull requests only. It enforces FR-011 (the boundary) and FR-013 (the signer of record) mechanically, so
neither rests on the agent's instructions.

## Where it runs

In `.github/workflows/verify.yml`, in the same single job, for `pull_request` events only. For a pull request that is not
agent-authored, the verify workflow runs exactly the steps it runs today (SC-008).

Changes to `verify.yml`:

1. Job-level `env`: `AGENT_LOGINS: "Copilot"`, the comma-separated list of author logins treated as the agent. It is also
   a constant at the top of the script, and the workflow value overrides it.
2. Job permissions grow from `contents: read` to `contents: read`, `issues: read`, `pull-requests: read`, which the
   assignment lookup needs.
3. The existing **CLA check** step exits 0 with a note when the author is in `AGENT_LOGINS`, because the guard decides
   for those pull requests. For every other author it behaves exactly as today.
4. A new step **Agent PR guard**, after `npm ci` (it needs Node and `tsx`), run for every `pull_request`. It decides for
   itself whether the pull request is agent-authored and exits 0 immediately if not.

## Invocation

```text
tsx scripts/agent-pr-guard.ts --pr <number>          # CI: identity, change set, signer of record
tsx scripts/agent-pr-guard.ts --self-test            # local: fixture self-test, no network
```

In CI the step passes `GH_TOKEN` and the pull request number. `--self-test` needs neither.

## Step 1: Identity

The pull request is agent-authored when `pull_request.user.login` is in `AGENT_LOGINS`. The list holds both platform
identities: `copilot-swe-agent` (the pull request author) and `Copilot` (the issue assignee). Not agent-authored: print
`not an agent pull request`, exit 0. Correcting the list is a one-line change.

## Step 2: The change set

Read the changed files and their patches from the pull request files API. Let `X` be the one primitive type added by the
pull request: the `type` fields present in `src/primitives/registry.ts` at the head but not at the base must number
exactly one. Zero or more than one fails.

Each changed file must match the allowed change set in the data model, with these rules:

| File | Rule | Fails with |
| --- | --- | --- |
| `src/primitives/registry.ts` | In the patch, every removed line is the `VOCABULARY_VERSION` line. All other changes are added lines. | `registry: removed or edited line other than the version` |
| `golden/arm64/hashes.json`, `golden/x64/hashes.json` | Compared at base and head as JSON. Every key present at the base has the same value at the head. | `golden: existing case <key> changed` |
| `golden/CHANGES.md` | In the patch, no removed lines. | `changes: a removed line` |
| `gallery/X.png`, `loops/X.gif` and the site outputs | Allowed paths, named for `X`. | none |
| Any other path | Not allowed. | `outside the allowed set: <path>` |

If a file's patch is missing from the API response (a very large diff), the guard fails closed with
`patch unavailable for <path>`.

## Step 3: The signer of record

1. Find the issue the pull request closes: GraphQL `closingIssuesReferences` first, then a `Fixes #N` line in the body.
   None found: fail with `no linked proposal issue`.
2. Read that issue's assignees. The signer of record is the **single human assignee**: the
   platform records the assigning maintainer as a co-assignee alongside the agent, not as an
   assignment-event actor (trial finding, PR #21). Zero humans: fail with `proposal has no
   human assignee: signer of record unresolved`. More than one: fail with `proposal has
   multiple human assignees (...): exactly one signer of record is required`.
3. Read `CLA-SIGNERS.json` from the base branch, as the existing check does, and fall back to
   the head only when the file is not on the base yet. The signer must be listed. Not listed:
   fail with `<login> assigned this proposal but has not signed the CLA`.

Fail closed throughout: any API error, missing issue or unparsable file is a failure with its
own message, never a pass.

## Output

On success, one line: `agent pull request ok: <type>, signer of record <login>`. On failure, one `::error::` line per
problem and exit 1. The messages above are the contract; the maintainer can act on each without reading the script.

## Self-test fixtures

`--self-test` runs these cases against the pure parts of the guard, with no network, and exits 1 if any gives the wrong
result. It is run by hand and in the trial, and is not part of `npm run verify` (SC-008).

| Fixture | Expected |
| --- | --- |
| Registry diff adds one entry and changes the version line | pass |
| Registry diff edits a line inside an existing primitive | fail |
| A change set that touches `package.json` | fail |
| A change set that touches a workflow | fail |
| A `golden/x64/hashes.json` where an existing hash changes | fail |
| A `golden/x64/hashes.json` where only new keys are added | pass |
| Two new primitive types in one pull request | fail |
| A change set that edits `AGENTS.md` or `.github/skills/` | fail |
| Issue assignees with exactly one human, a signer | pass |
| Issue assignees with one human who has not signed | fail |
| Issue assignees with no human | fail |
| Issue assignees with two humans | fail |

## Non-goals

- It does not judge the primitive's quality. The gates and the human style review do.
- It does not merge, label, comment or change anything; it only reads and reports.
- It does not replace the secret scan or the gates, which still run on every pull request.