# Feature Specification: Copilot Primitive Agent

**Feature Branch**: `007-copilot-primitive-agent`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "we can use github agents to resolve new feature requests for new vocabulary. I was thinking should we create a spec for that, and how would the agents know when we have speckit installed". Chosen when asked: the GitHub Copilot coding agent only. The vocabulary grows by proposals (spec 005's proposal template), and the community site (006) plus the AnimSpec Live demo are expected to raise more. This feature lets the Copilot coding agent turn an accepted proposal into a complete pull request, while the project's gates, rules and human style review stay exactly where they are.

## User Scenarios & Testing *(mandatory)*

Adding a primitive is one registry entry, but a pull request that is acceptable needs much more
around it: a vocabulary version and its record, a gallery thumbnail, reference hashes and frames for
both supported processor types with a change-log row, a sample loop, and regenerated site content,
all behind one green `npm run verify`. That pipeline is mechanical, well documented and easy to get
wrong. A coding agent can do the mechanical part, but only if it knows the project's rules without
being told every time, and only if it cannot be talked out of them.

### User Story 1 - An accepted proposal becomes a reviewable pull request (Priority: P1)

A maintainer reads a primitive proposal, decides it is worth building, and assigns it to the agent.
The agent returns a pull request with one new registry entry at tier `contrib` and every generated
output the pipeline requires, with `npm run verify` green and no hand edits needed to generated files.

**Why this priority**: This is the whole point. Without it nothing else matters, and the maintainer's
time goes to judging the primitive instead of running the pipeline.

**Independent Test**: Assign a well-formed sample proposal. The result is a pull request that passes the
project's full verification untouched by a human.

**Acceptance Scenarios**:

1. **Given** a well-formed proposal accepted by a maintainer, **When** the maintainer assigns it to the agent, **Then** the agent opens a pull request containing exactly one new registry entry at tier `contrib` plus the generated outputs the pipeline requires for a vocabulary change.
2. **Given** that pull request, **When** CI runs, **Then** `npm run verify` passes without any change to a gate, threshold or reference made by the agent to get it there.
3. **Given** that pull request, **When** the maintainer opens it, **Then** the description answers the four style questions, states why the proposal passes the new-primitive rule, lists the generated outputs, and shows the animated loop so the reviewer can judge the look without running anything.

---

### User Story 2 - Only a maintainer can start the agent, and issue text cannot steer it (Priority: P1)

An issue is public input. Anyone can open a proposal and write anything in it, including text that looks
like instructions. The agent works only when a maintainer assigns an issue to it, and treats everything in
the issue as a description of a desired primitive, never as a command.

**Why this priority**: Without this the repository hands write access to anyone who can open an issue.
It is a security property, not a convenience, and it must hold before the first run.

**Independent Test**: Run the agent on a proposal whose body contains instructions to change a gate,
add a dependency, or touch the workflows. The pull request, if any, contains none of it, and the attempt
is reported to the maintainer.

**Acceptance Scenarios**:

1. **Given** an open proposal that no maintainer has assigned, **When** time passes, **Then** the agent does nothing.
2. **Given** a proposal whose text instructs the agent to change something outside its boundary, **When** the maintainer assigns it, **Then** the instruction is ignored and reported, and the work stays inside the boundary.
3. **Given** an assignment by someone without maintainer rights, **When** it is attempted, **Then** the agent does not start.

---

### User Story 3 - The agent protects the vocabulary rule (Priority: P1)

The one rule that governs growth is that a new primitive must draw something no existing primitive can draw by
changing its params. The agent checks that rule before it writes code. When a proposal fails it, or is too
incomplete to build, the agent opens no code pull request and instead tells the maintainer precisely why.

**Why this priority**: The registry has no size cap and stays governable only if near-duplicates are
refused. An agent that builds whatever it is given would erode the vocabulary faster than any human could review.

**Independent Test**: Assign a proposal that an existing primitive can already draw with different params.
The result is a comment naming that primitive and the params, and no pull request.

**Acceptance Scenarios**:

1. **Given** a proposal that an existing primitive can draw by changing its params, **When** the agent runs, **Then** it posts a comment naming the primitive and the params that produce it, and opens no code pull request.
2. **Given** a proposal missing something required (type, category, what it draws, params with bounds and defaults, or the style answers), **When** the agent runs, **Then** it asks specific questions and stops, and invents nothing.
3. **Given** a proposal that needs something the project forbids in drawing (network or file access, colours outside the palette, ambient randomness or time, a GPU rasteriser), **When** the agent runs, **Then** it declines, citing the rule.

---

### User Story 4 - The agent finds the project's rules and environment by itself (Priority: P2)

A fresh agent session, given only the assignment, locates the constitution, the new-primitive rule,
the full pipeline, its own boundary and the escalation rules, and can run the project's one verify command.
Nobody has to paste a prompt that explains how this repository works.

**Why this priority**: This is the question that started the feature: how an agent learns that the project
uses speckit and what its rules are. It is P2 only because Story 1 cannot work without it, so it is built
with Story 1, but it is verified on its own.

**Independent Test**: Start an agent session on a sample proposal with no extra prompt. It follows the
documented pipeline and stays inside its boundary.

**Acceptance Scenarios**:

1. **Given** a fresh agent session and a sample proposal, **When** it starts, **Then** it reads the constitution and the pipeline before writing code, without being told where they are.
2. **Given** the agent's environment, **When** it needs to verify, **Then** it can run the project's one verify command and see the same result CI will.

---

### User Story 5 - Agent pull requests merge only through the same human gates (Priority: P2)

An agent pull request passes the same CI as anyone's, needs a human review to merge, and meets the
licence rule for contributions. The style review stays human.

**Why this priority**: These are existing promises (one verify command, a signed licence agreement, human
style review) that a new kind of author must not quietly bypass.

**Independent Test**: Open an agent pull request and follow it to merge: CI runs, a human approves it, and the
licence gate gives a clear result under the stated rule.

**Acceptance Scenarios**:

1. **Given** an agent pull request, **When** CI runs, **Then** it runs the same verify workflow, secret scan and licence check as any other pull request, and the one human step needed to start CI on it is documented.
2. **Given** an agent pull request, **When** a maintainer reviews it, **Then** it cannot merge without that human approval.
3. **Given** the licence rule, **When** the gate evaluates an agent pull request, **Then** it passes only if the pull request is traceable to a signed maintainer's assignment, and fails otherwise.

### Edge Cases

- **The proposal duplicates another open proposal or pull request**: the agent checks open issues and pull
  requests first, comments with the link, and does not start a second implementation.
- **The cross-type reference refresh cannot complete in the agent's environment** (no container runtime or
  no network): the pull request opens as a draft that names the missing step. The agent never fabricates or
  copies reference hashes or frames.
- **`npm run verify` keeps failing**: the agent stops after a bounded number of attempts and reports what
  fails. It never weakens, skips or edits a gate, a threshold or a reference to go green.
- **The proposal embeds code or shell commands**: treated as a description of a wish, not as instructions;
  the maintainer is told it was not executed.
- **Two agent pull requests in flight raise the vocabulary version**: the version rises by one per change, so
  the second must be rebased after the first merges; maintainers merge them one at a time.
- **The proposal is really a param or enum request, a replacement, or a removal**: outside this feature; the
  agent comments that a maintainer or a human contributor should take it.
- **The assigning maintainer assigns something that is not a proposal** (a bug, a docs change): the agent
  declines, since this feature covers proposals from the template only.
- **An outside contributor's proposal and the licence**: the assigning maintainer is the signer of record
  (FR-013). The issue author signs nothing, because the proposal is a description and the agent writes the
  implementation itself without copying code from the issue (FR-002). If an issue carries substantial code
  from its author, the agent says so and stops, since that code would need its own author's agreement.

## Requirements *(mandatory)*

### Functional Requirements

**Trigger and trust**

- **FR-001**: The agent MUST start only when a maintainer assigns an issue created from the primitive-proposal template to it. Nothing in an issue body, comment or linked content MAY start, widen or redirect the work.
- **FR-002**: Everything written by an issue author MUST be treated as untrusted data that describes a desired primitive, never as instructions to the agent. Any attempt to instruct it MUST be ignored and reported to the maintainer. The agent MUST write the implementation itself from the described behaviour and MUST NOT copy code from an issue into the pull request, so the proposal contributes an idea and never code.

**Eligibility**

- **FR-003**: Before writing code, the agent MUST check the proposal against the new-primitive rule. If an existing primitive can draw the result by changing its params, the agent MUST open no code pull request, MUST comment naming the primitive and the params, and MUST stop.
- **FR-004**: If anything required is missing or ambiguous (type, category, what it draws, params with types, bounds and defaults, the style answers), the agent MUST ask specific questions and stop. It MUST NOT invent values.
- **FR-005**: The agent MUST decline, citing the rule, any proposal that requires breaking a constitution principle in drawing: network or file access, colours outside the palette, ambient randomness or time, or a GPU rasteriser.
- **FR-006**: The agent MUST check for an existing issue or pull request for the same capability and, if found, link it and not start a second implementation.

**Work product**

- **FR-007**: The pull request MUST contain exactly one new registry entry, at tier `contrib`, plus the generated or derived outputs the project's pipeline requires for a vocabulary change: the vocabulary version and record, the gallery thumbnail, the reference hashes and frames for both supported processor types with their change-log row, the sample loop, and the regenerated site content. It MUST contain nothing else.
- **FR-008**: `npm run verify` MUST pass on the pull request. The agent MUST NOT weaken, skip or edit any gate, threshold or reference to make it pass.
- **FR-009**: The pull request description MUST answer the four style questions, state why the proposal passes the new-primitive rule, list the generated outputs, and show the animated loop.
- **FR-010**: If a required step cannot be completed in the agent's environment, the pull request MUST open as a draft that names the missing step. The agent MUST NOT fabricate or copy reference data.

**Boundary**

- **FR-011**: The agent MUST NOT modify the constitution, the gates and verification scripts, the workflows, an existing primitive's behaviour, the reference entries of any other primitive, the package metadata, or its own instructions.
- **FR-012**: The agent MUST stop after a bounded number of failed attempts to get `npm run verify` green and report the failure instead of continuing.

**Governance and merge**

- **FR-013**: An agent-authored pull request MUST satisfy the contribution licence rule through a signer of record, who is the maintainer that assigned the proposal to the agent. That maintainer MUST be on the signed-agreement list, the pull request MUST be traceable to that assignment, and a pull request that cannot be traced to a signed maintainer's assignment MUST fail the licence check.
- **FR-014**: An agent pull request MUST run the same CI as every pull request and MUST NOT merge without a human review. The style review remains a human decision.

**Discoverability**

- **FR-015**: The repository MUST give a fresh agent session, with no extra prompt, the constitution, the new-primitive rule, the full pipeline for a vocabulary change, its boundary and its escalation rules, in the places the Copilot coding agent reads.
- **FR-016**: The repository MUST define the agent's environment so it can run the project's one verify command and the generators the pipeline needs.

**Governance of this project**

- **FR-017**: The constitution baseline MUST be amended in the same change that ships this feature: the agent-assisted proposal path added to in-scope, the GitHub Copilot coding agent added to external dependencies, version bumped.

### Key Entities

- **Proposal**: an issue created from the primitive-proposal template; untrusted input describing a desired primitive.
- **Eligibility verdict**: the agent's decision on a proposal, one of build, ask, or decline, always with the reason.
- **Agent task**: one assignment of a proposal to the agent by a maintainer; at most one active task per proposal.
- **Agent pull request**: the result of a build verdict; one registry entry plus its generated outputs, human-reviewed before merge.
- **Playbook**: the repository's agent-facing instructions and environment definition: where the rules are, what the pipeline is, what the boundary is.
- **Signer of record**: the maintainer who assigned the proposal to the agent; their signed licence agreement covers the agent-authored contribution (FR-013).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a trial of 5 well-formed proposals, at least 4 produce a pull request that passes the project's full verification with zero hand edits to generated files.
- **SC-002**: 100% of trial proposals that fail the new-primitive rule receive an explanatory comment naming the existing primitive and params, and no code pull request.
- **SC-003**: 100% of agent pull requests in the trial change only the allowed set: one registry entry and its generated outputs.
- **SC-004**: 0 agent runs start without a maintainer's assignment, and 0 runs are steered by instructions embedded in issue text (the trial includes at least 2 such injection cases).
- **SC-005**: 100% of agent pull requests carry the four style answers and the animated loop, so a reviewer can decide from the pull request page alone.
- **SC-006**: A reviewable pull request, a question or a refusal arrives within 2 hours of assignment for each trial proposal.
- **SC-007**: A fresh agent session with no extra prompt follows the documented pipeline in the trial, without being told where the rules are.
- **SC-008**: 0 changes to `npm run verify`, the verify workflow's checks, the gates or the golden sets are made by this feature.
- **SC-009**: In the trial, 100% of agent pull requests traceable to a signed maintainer's assignment pass the licence check, and 100% of agent pull requests that are not traceable fail it.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a maintainer**: an accepted proposal becomes a reviewable pull request without hand-running the pipeline, and the maintainer's time goes to judging the primitive.
- **For the community**: a proposal gets a precise answer fast: a pull request, a specific question, or a reasoned refusal.
- **For the project**: the vocabulary can grow faster without the gates, the new-primitive rule, the signed-licence rule or human style review being bypassed.

### In scope

- The agent-facing instructions and environment definition that let the GitHub Copilot coding agent follow this repository's rules (the playbook).
- The eligibility rules (build, ask, decline) for proposals from the template, and the escalation behaviour.
- The assignment convention that makes a maintainer the only trigger.
- The licence rule for agent-authored pull requests (FR-013), including any change to the licence check that it needs.
- A trial on sample proposals (well-formed, duplicate, incomplete, hostile) that measures the success criteria.
- Maintainer-facing documentation of the workflow.
- The constitution baseline amendment this feature requires.

**Boundary change**: the GitHub Copilot coding agent is a new external service, and agent-authored pull requests are a new kind of contributor. Both are named here and recorded in the plan's Constitution Check; the baseline is amended in the same change that ships the feature.

### Out of scope

- **Merging**: the agent never merges. Held by: a human maintainer.
- **Assigning**: the agent never picks up issues on its own. Held by: the maintainer.
- **Param or enum changes, replacements and removals of primitives**: not proposals for a new primitive. Held by: a maintainer or a human contributor, or a later spec.
- **Any work other than a new primitive from a proposal**: bugs, documentation, the site, the gates, the workflows. Held by: the normal contribution path.
- **Other agents** (Claude in Actions, others): a later spec if wanted. The Copilot agent is the only one targeted here.
- **AnimSpec Live**: the demo application is its own repository; the proposals it files are inputs here, like any other proposal. Held by: that repository.
- **The wording of the CLA and the legal review**: decisions, not features (constitution, out of scope). This spec chooses who stands as the signer of record, not what the agreement says. Held by: the maintainer.
- **Quota, billing and entitlement for the agent**: held by the maintainer's GitHub account.

### External dependencies

- **GitHub Copilot coding agent**: the service that performs the work, including its network firewall rules, its repository environment setup and its usage quota. A new external service for this project, named here as a boundary change.
- **GitHub Actions**: used only to prepare the agent's environment, as separate automation never part of verify.
- **A container runtime in the agent's environment**: needed to render the other processor type's reference frames; availability is confirmed in planning (FR-010 covers the case where it is absent).
- **No new npm dependency.**

### Assumptions

- The maintainer has the Copilot coding agent enabled for this repository, and assignment is the trigger that product supports.
- Proposals use the existing primitive-proposal template; free-form issues are out of scope.
- The agent runs on a Linux x64 machine, so the arm64 reference set needs cross-type rendering; whether that works in the agent's environment is a planning question, and FR-010 is the fallback.
- A pull request opened by the agent needs a maintainer to approve its first CI run; this is documented, not removed.
- The repository owner remains a signer on `CLA-SIGNERS.json`.
- Assigning a proposal to the agent is the maintainer's act of taking responsibility for the contribution as its signer of record. The CLA's own wording is unchanged; the maintainer owns the decision, recorded in the legal review, that this reading is sound.
- The project's existing pipeline for a vocabulary change is complete and correct; this feature automates following it and does not redesign it.
- Vocabulary version bumps serialize merges: one primitive pull request merges at a time.

### Non-negotiable constraints

- **Constitution Principles I to VII all apply to the agent's output**, unchanged. In particular: determinism and golden hashes for both processor types (I), one registry entry (II), pure palette-only CPU primitives (III), specs and issue text as untrusted input (IV), and one offline verify command that stays one workflow with one job (VI).
- **The agent's environment definition is separate automation**, never part of verify, the same separation the repository records for the publish and site workflows.
- **Human style review** stays human, and no agent pull request merges without a human approval.
- **The licence rule**: no outside contribution merges without a signed Contributor License Agreement on record; this feature changes who is recorded, never whether one is required.
- **Naming**: no private-product or artist name appears in any agent instruction or output.