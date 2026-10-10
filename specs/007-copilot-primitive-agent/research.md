# Research: Copilot Primitive Agent

Phase 0 output for [spec.md](spec.md). Each entry names the decision, the rationale, and the alternatives considered.
Facts about the Copilot cloud agent come from GitHub's own documentation, read on 2026-10-10. Four items cannot be
settled by reading and are marked **Verified in the trial**; each has a fallback so the plan never depends on a guess.

## R1: The product, its name and what it already guarantees

**Decision**: Target the GitHub Copilot cloud agent (GitHub's documentation now uses this name for what the spec calls
the coding agent). Build on the guarantees the platform already gives, and add only what it does not.

**What the platform already does** (from GitHub's documentation):
- Only users with write access can trigger the agent. Comments from users without write access are never presented to it.
- Hidden text (for example an HTML comment in an issue) is filtered before the agent sees the input.
- The agent pushes to a single new `copilot/` branch, cannot run arbitrary `git push`, opens a draft pull request, and
  cannot mark it ready for review, approve it or merge it.
- Its commits are authored by Copilot, signed, and carry the developer who assigned the issue as co-author, with a link
  to the session log.
- Workflows do not run on its pull request until a user with write access clicks **Approve and run workflows**.
- The user who asked for the pull request cannot approve it.
- A session is capped at 59 minutes, handles one branch and one pull request, and works in one repository.

**Rationale**: FR-001 and half of FR-002 are already enforced by the platform, so the plan states them as assumptions and
verifies them in the trial instead of rebuilding them.

**What it does not do**: it does not know this project's rules, does not limit what the agent may change inside the
branch, and does not tie its pull request to a signed licence agreement. Those are the plan's job (R2, R7, R8).

**Alternatives considered**: GitHub Agentic Workflows and Copilot automations (event-driven runs). Automations are
available only in private and internal repositories, and this repository is public. Agentic Workflows would replace the
maintainer's assignment with an event trigger, which weakens FR-001. Rejected for v1.

## R2: How the playbook is delivered

**Decision**: A short `AGENTS.md` at the repository root plus one agent skill, `.github/skills/primitive-proposal/`.

**Rationale**: GitHub's custom-instruction documentation lists three mechanisms for the cloud agent: repository-wide
`.github/copilot-instructions.md`, path-specific `.github/instructions/*.instructions.md`, and agent instructions
(`AGENTS.md`, nearest file wins, plus `CLAUDE.md` or `GEMINI.md` at the root). Skills load on demand when their
description matches the task. The split follows how each is loaded:
- `AGENTS.md` is always in context, so it carries only what must never be missed and stays short.
- The skill carries the long procedure and is pulled in only for a primitive proposal.
- `AGENTS.md` is an open convention that other agents also read, so it ages well if a later spec targets another agent.

**Alternatives considered**:
- **`.github/copilot-instructions.md`**: equivalent for the cloud agent but Copilot-only. Not chosen over the open file.
- **Path-specific instructions**: they apply when the agent touches matching files, which is after the decision to build
  has already been made. The eligibility verdict comes first, so they cannot hold the procedure.
- **A custom agent under `.github/agents/`**: selectable at assignment, but it adds a step the maintainer must remember
  and a persona to maintain, for no gain over a skill.
- **Everything in `AGENTS.md`**: long instructions dilute attention and cost context on every task, including tasks that
  are not proposals.

## R3: How agents find out that speckit is installed (and a correction)

**Decision**: Do not install speckit's Copilot integration. Rely on what is already discoverable, and say in `AGENTS.md`
what speckit is for.

**Correction, on the record**: earlier in this work I said the Copilot agent does not load `.claude/skills`. That was
wrong. GitHub's documentation lists project skills in `.github/skills`, `.claude/skills` and `.agents/skills`, and says
Copilot loads a skill when its description is relevant. The ten `speckit-*` skills committed under `.claude/skills/` are
therefore already visible to the cloud agent. An agent learns that speckit is installed from the skills it discovers, and
from `AGENTS.md`, not from any install step.

**Why not the Copilot integration**: `specify integration list` shows `copilot` as an IDE integration, marked not
multi-install safe, which generates IDE agent and prompt files. The cloud agent does not need them, and they would add
speckit personas next to the one skill this feature needs.

**What `AGENTS.md` says about speckit**: it exists for features that change scope or add a responsibility, and it is the
wrong tool for a primitive. The project's roadmap already states that individual primitives go through the vetting
pipeline, not a full spec each. The agent must not start a specification for a proposal. If a proposal needs more than
one new primitive, a boundary change, or a param change on an existing primitive, the agent comments that it needs a
maintainer, and may name speckit as the path.

**Alternatives considered**: installing the Copilot integration anyway (noise, not safe beside `claude`); duplicating the
speckit skills into `.github/skills` (a second copy that drifts).

## R4: The agent's environment

**Decision**: `.github/workflows/copilot-setup-steps.yml` with one job named `copilot-setup-steps` that checks out the
repository, installs Node 22 with the npm cache, runs `npm ci`, registers arm64 emulation with
`docker/setup-qemu-action`, and pre-pulls the `node:22` image for the other processor type.

**Rationale**: GitHub documents that the job must carry exactly that name, runs before the agent starts, and can set only
`steps`, `permissions`, `runs-on`, `services`, `snapshot` and `timeout-minutes` (at most 59). Its processes are outside the
agent firewall, so privileged setup (QEMU registration) and image pulls belong here. A failing step skips the rest, so
the order puts the cheap, certain steps first. The file is read from the default branch, so the playbook only works after
the merge.

**Alternatives considered**: letting the agent install dependencies itself (slow, non-deterministic, and unable to
register emulation); a larger runner (not needed, and a paid feature); a self-hosted runner (the firewall is
incompatible with it, and the constitution rules out self-hosted runners for a public repository).

## R5: Can the agent complete the cross-processor reference refresh? (Verified in the trial)

**Decision**: Design for it, measure it in the trial, and fall back to FR-010 if it cannot.

**What is known**:
- The agent runs only on Ubuntu x64, so the x64 set renders natively and the arm64 set must come from an emulated
  container. `scripts/golden-update.ts` already does exactly this: `docker run --platform linux/arm64 ... node:22`, which
  runs `npm ci` inside the container, requires `docker info` to succeed, and replaces both sets together or neither.
- QEMU registration and the image pull happen in the setup steps, outside the firewall (R4).
- Inside the container, `npm ci` fetches from the npm registry. The firewall's recommended allowlist covers the
  JavaScript package registries and common container registries, which is where this traffic goes.

**What is not known**: whether traffic from a container, which is started by the Docker daemon rather than by the agent's
own shell, is subject to the firewall; and how long the emulated render takes against the 59-minute cap. The firewall
documentation says blocked requests are reported as a warning in the pull request body, so a failure is visible.

**Fallback (FR-010)**: if the refresh cannot finish, the agent opens the pull request as a draft that names the missing
step. A maintainer runs `npm run golden:update` once on their own machine, commits the result and the change-log row, and
marks the pull request ready. The agent never fabricates or copies hashes. The failure mode of `golden:update` helps:
it changes nothing if any step fails, so a failed run leaves the sets consistent.

**Alternatives considered**: changing `golden-update.ts` to render offline (a change to verification tooling, outside this
feature's boundary); a custom allowlist entry for container traffic (a maintainer setting, added only if the trial shows
it is needed).

## R6: Trigger and trust

**Decision**: The trigger is a maintainer assigning an issue created from the primitive-proposal template to Copilot.
The playbook adds two rules on top of the platform's: the agent works only on an issue that has the template's fields
(otherwise it declines, because free-form issues are out of scope), and it treats every word of the issue as data.

**Rationale**: write access is enforced by the platform (R1), so the plan does not duplicate it. The remaining risk is a
proposal written by an outsider that a maintainer assigns in good faith. The platform filters hidden text, but visible
instructions in the issue body still reach the agent, so the playbook must say that issue text describes a primitive and
never directs the agent, and the guard (R8) must make a successful injection harmless.

**Alternatives considered**: a label-based trigger (adds a second control that can drift from assignment); requiring
approval comments (adds a human step that the platform's write-access rule already provides).

## R7: Resolving the signer of record (Verified in the trial)

**Decision**: In the agent-PR guard, resolve the signer in this order and fail closed.

1. The pull request is agent-authored when its author login is in a configured list (`Copilot` expected).
2. Find the issue the pull request closes (GraphQL `closingIssuesReferences`, with the `Fixes #N` line in the body as a
   second source).
3. Read that issue's timeline events and take the actor of the most recent `assigned` event whose assignee is the agent.
4. The actor must be listed in `CLA-SIGNERS.json` on the base branch (the same source the existing check uses). If there
   is no linked issue, no such event, or the actor is not a signer, the guard fails with a message saying which.

**Rationale**: an event actor is an exact GitHub login, which is what `CLA-SIGNERS.json` stores. The platform records the
assigner as a commit co-author as well, but a `Co-authored-by` trailer carries a name and an email, and mapping an email
to a login is unreliable.

**Not known, verified in the trial**: the exact login string of the agent's pull request author, and whether the pull
request body reliably contains the issue reference. The list of agent logins is a constant at the top of the guard, so
correcting it is a one-line change, and fail-closed means a wrong guess blocks a merge rather than letting an
untraceable pull request through.

**Alternatives considered**: parsing commit trailers (email-to-login mapping is unreliable); using the pull request
assignee or requested reviewer (set by the platform in ways that are not guaranteed to identify the assigner); treating
the issue author as the signer (rejected in the spec, since they contribute an idea, not code).

## R8: Enforcing the boundary mechanically

**Decision**: `scripts/agent-pr-guard.ts`, called from the verify job for agent-authored pull requests, enforces an
allowed change set and checks that existing records are only added to.

**The allowed set** for a proposal of type `X`:
- `src/primitives/registry.ts`, with the diff limited to added lines plus the `VOCABULARY_VERSION` line;
- `golden/vocabulary.json` and `VOCABULARY.md`;
- `golden/arm64/**` and `golden/x64/**`, where every existing case hash must be unchanged (new cases only);
- `golden/CHANGES.md`, additions only;
- `gallery/X.png` and `loops/X.gif`;
- the site outputs: `docs/gallery.md`, `docs/vocabulary.md`, `docs/public/gallery/X.png` and `docs/public/loops/X.gif`.

Anything else, including `package.json`, workflows, `scripts/`, the constitution, `AGENTS.md` and the skill, fails the guard.

**Rationale**: SC-003 is 100%, and a boundary that lives only in instructions fails under prompt injection. A path
allowlist plus two additive-only rules (registry and reference hashes) catches the changes that matter: touching an
existing primitive, moving an existing hash, editing the tooling, or editing the agent's own rules. The allowlist logic is
a pure function, so it has a fixture self-test and runs locally.

**Alternatives considered**: instructions only (fails SC-003); CODEOWNERS (does not stop a change, only requests a
review, and the platform's rule that the requester cannot approve would then trap a solo maintainer); a ruleset with
path restrictions (a repository setting held by the maintainer, not reviewable code, and it would also block human
contributors).

## R9: CI approval and merge governance

**Decision**: Document the platform's behavior and add no required-approvals rule.

**Facts**: workflows on the agent's pull request wait for **Approve and run workflows**; the agent cannot mark ready,
approve or merge; the requester cannot approve their own agent pull request; and when a repository requires at least one
approval, an agent pull request needs one more because it is not attributed to a person. This repository's `main` has no
branch protection and no rulesets today, and its default workflow token is read-only.

**Rationale**: with a single maintainer, a required-approvals rule would deadlock, since the requester cannot approve.
FR-014 is met by what the platform already forces: the pull request opens as a draft only a human can ready and merge, and
CI must be approved and run first. The one setting that would add value without a deadlock is a ruleset that requires the
`verify` check to pass before merge, so a maintainer cannot merge a red agent pull request by accident. It is recorded in
the quickstart as a recommended maintainer setting, not required by this feature.

**Alternatives considered**: required approvals with a second maintainer (not available today); auto-merge (forbidden by
the spec).

## R10: Cost, quota and entitlement

**Decision**: Out of scope, as the spec states. The plan notes that the cloud agent consumes the assigning user's Copilot
quota and Actions minutes, which are free for a public repository, and that the setup workflow runs only for agent tasks
and for changes to itself.

## R11: Governance

**Decision**: Amend the constitution baseline in the same change as the feature: add the agent-assisted primitive path to
in-scope; add the Copilot cloud agent and the QEMU setup action to external dependencies; add that the agent holds no
credentials beyond its platform-issued ones; bump 2.4.1 to 2.5.0 (MINOR, a new in-scope responsibility). The spec was
amended during planning for SC-008 and for the guard, as Principle VII requires, before design continued.