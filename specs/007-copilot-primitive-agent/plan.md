# Implementation Plan: Copilot Primitive Agent

**Branch**: `007-copilot-primitive-agent` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-copilot-primitive-agent/spec.md`

## Summary

Four pieces make the GitHub Copilot cloud agent (the product this spec calls the coding agent) able to
turn an accepted primitive proposal into a reviewable pull request without bypassing any project rule:

1. **A playbook the agent finds by itself**: a short `AGENTS.md` at the repository root (always loaded) that states
   the trust model, the boundary and the escalation rules, plus one agent skill under `.github/skills/` that holds
   the detailed procedure (eligibility verdict, the pipeline commands in order, the pull request description).
2. **An environment definition**: `.github/workflows/copilot-setup-steps.yml`, which prepares the agent's Ubuntu x64
   machine (Node, dependencies, arm64 emulation, a pre-pulled container image) so it can run the project's one verify
   command and the cross-processor reference refresh.
3. **A mechanical guard**: one step in the existing verify job, run only for agent-authored pull requests, that enforces
   the allowed change set and resolves the signer of record from the issue assignment. The boundary and the licence
   rule therefore never rest on the agent's instructions alone.
4. **A trial** on sample proposals (well-formed, duplicate, incomplete, hostile) that measures the success criteria.

No new dependency enters the library, `npm run verify` and the gates are unchanged, and every pull request that is not
agent-authored takes exactly the path it takes today.

## Technical Context

**Language/Version**: Markdown (`AGENTS.md`, the skill), YAML (GitHub Actions), and TypeScript 5.9 for one guard script (Node.js 22, ESM, `strict`)

**Primary Dependencies**: none new in the library or the build. The setup workflow uses `actions/checkout`, `actions/setup-node` and `docker/setup-qemu-action` (arm64 emulation, setup steps only). External services: the GitHub Copilot cloud agent and GitHub Actions.

**Storage**: none. The playbook, the setup workflow and the guard are committed files.

**Testing**: the guard script carries its own fixture self-test (`--self-test`: an allowed change set, a forbidden path, a modified existing hash, an untraceable assignment), run by hand and in the trial, not by `npm run verify`. The success criteria are measured by the quickstart trial on sample proposals.

**Target Platform**: GitHub Actions `ubuntu-latest` (the guard and the setup steps), and the Copilot cloud agent's own Ubuntu x64 environment. The agent supports only Ubuntu x64 and Windows 64-bit, so the arm64 reference set is always produced by emulation in a container.

**Project Type**: repository automation and agent instructions; no application code.

**Performance Goals**: the guard finishes in under 30 s; one task fits inside the agent's 59-minute session cap and inside SC-006's 2 hours; the emulated arm64 refresh time is measured in the trial.

**Constraints**: `npm run verify`, the gates and the golden sets are unchanged (SC-008); verify stays one workflow with one job, offline for everything it runs today; no private-product name in any agent instruction; the agent never merges, marks ready for review or approves (the platform already forbids it); a prompt-injected agent must still be unable to leave the allowed change set.

**Scale/Scope**: one new `AGENTS.md`, one skill with two reference files, one new workflow, one added verify step, one guard script, and a constitution amendment. One proposal per task, one pull request per task.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Reason |
| --- | --- | --- |
| I. Determinism | Pass | The agent's output must still carry reference hashes for both processor types. The guard refuses any change to an existing reference entry (additions only), so the promise cannot be weakened by a bad run. |
| II. Registry is the single source of truth | Pass | The allowed change set contains one registry entry. The guard checks that `src/primitives/registry.ts` changes by additions plus the version line only, and the generated outputs stay generated, never hand-written. |
| III. Pure, palette-only, CPU-only primitives | Pass | The skill cites the rule and the existing purity, palette, reactivity and budget gates enforce it on the agent's primitive exactly as on a human's. Nothing in this feature touches a `draw`. |
| IV. Specs are untrusted input | Pass | Issue text is untrusted input. The platform already limits triggering to users with write access, never presents comments from others to the agent, and filters hidden text. The playbook adds the rule that issue text is data, and the guard backs it with a mechanical boundary. |
| V. Saved specs keep rendering | Pass | New primitives enter at tier `contrib` and never replace one. The guard forbids edits to existing primitives and to their reference entries, so no saved spec can change. |
| VI. One offline verify command | Pass, with recorded deviations | `npm run verify`, its gates and its job are unchanged, and ordinary pull requests run exactly the steps they run today. Two deviations are recorded in Complexity Tracking: a step that runs only for agent-authored pull requests, and a separate `copilot-setup-steps.yml` workflow that the agent product requires. |
| VII. Explicit boundaries | **Boundary change, recorded** | A new external service (the Copilot cloud agent), a new kind of contributor, and a new in-scope responsibility. The spec carries the six entries and was amended during planning (SC-008 and the in-scope guard) before design continued, as Principle VII requires. The baseline is amended in the same change that ships the feature: the agent-assisted proposal path added to in-scope, the Copilot cloud agent and the QEMU action added to external dependencies, version 2.4.1 to 2.5.0 (MINOR). |

**Gates the change touches**: none by behavior. `npm run check` (the `tsc` step of verify) compiles the new guard script, so
it must type-check under `strict`. No golden hash moves in this feature; agent pull requests add reference entries later,
each with its own `golden/CHANGES.md` row.

**Post-Phase-1 re-check**: the design below stays inside the spec's in-scope list. The guard reads only the pull request,
its linked issue's assignment events and `CLA-SIGNERS.json`; it writes nothing. `src/index.ts` gains no export, so the
public API is unchanged. Still a boundary change, still recorded.

## Project Structure

### Documentation (this feature)

```text
specs/007-copilot-primitive-agent/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── playbook.md      # AGENTS.md and the skill: required content, verdicts, comment and PR formats
│   ├── setup-steps.md   # The agent environment workflow
│   └── agent-pr-guard.md # The guard: identity, signer of record, allowed change set
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not this command)
```

### Source Code (repository root)

```text
AGENTS.md                                   # new: always-loaded front door for agents
.github/
├── skills/
│   └── primitive-proposal/
│       ├── SKILL.md                        # new: the procedure
│       └── references/
│           ├── decisions.md                # new: verdict comment formats (ask, decline)
│           └── pr-description.md           # new: the required pull request description
└── workflows/
    ├── copilot-setup-steps.yml             # new: the agent's environment
    ├── verify.yml                          # changed: PR-only agent guard step; CLA step skips agent PRs
    ├── publish.yml                         # untouched
    └── site.yml                            # untouched
scripts/
└── agent-pr-guard.ts                       # new: allowed change set + signer of record
CONTRIBUTING.md                             # changed: a short note on the agent path (regenerate docs/contributing.md)
.specify/memory/constitution.md             # changed: baseline amendment 2.5.0
```

**Structure Decision**: the playbook is split by how GitHub loads it. `AGENTS.md` is always in the agent's context, so it
stays short and holds only what must never be missed: the trust model, the boundary, the escalation rule and the pointer
to the skill. The skill loads when its description matches a primitive proposal and holds the long procedure, so the
agent's everyday context stays small. Both sit in locations the cloud agent already reads, so nothing needs installing.
The guard is one script beside its siblings in `scripts/`, called from the existing verify job so the repository keeps
one verify workflow. The setup workflow is a separate file because GitHub requires it to be one.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A step in `verify.yml` that runs only for agent-authored pull requests, and a CLA step that skips them | FR-013 needs the signer of record from the issue's assignment event, which only CI can read, and FR-011 needs a mechanical boundary. The existing CLA step cannot pass an agent pull request because its author is the agent, not a signer. | A separate guard workflow breaks "one workflow, one job" more than a step does. Maintainers re-submitting each branch was rejected in the spec. Relying on the agent's instructions alone fails SC-003 under prompt injection. |
| Part of that step needs the GitHub API, so it cannot run locally | The assignment event exists only on GitHub. | The CLA check already sets this precedent. The allowed-change-set half is pure, ships with a self-test and runs locally, so only the unavoidable half is CI-only. |
| A third automation workflow, `copilot-setup-steps.yml` | The agent product reads its environment from a workflow with exactly that name and job. | Letting the agent discover and install tooling by trial and error is slow and unreliable, and cannot register arm64 emulation, which FR-007 needs. It is separate automation, never part of verify, the same separation recorded for `publish.yml` and `site.yml`. |
| `docker/setup-qemu-action` in the setup workflow | The agent machine is x64, and the arm64 reference set is rendered in an emulated container. | Skipping emulation leaves every agent pull request a draft with a missing reference set (FR-010), which defeats the feature. Setup steps are outside the agent firewall, so this is where privileged setup can happen. |