# Quickstart: Validating Go-Public Readiness

How to prove the feature works end to end. Behaviour is specified in
[contracts/contributing.md](contracts/contributing.md) and [contracts/cla.md](contracts/cla.md).

## Prerequisites

- Node.js 22 or later, and `npm install` run once
- Maintainer access to the repository, and the legal review completed before the launch steps

## 1. The secret scan passes (SC-001)

Open the repository's security tab (or run the local scan in CI).

**Expected**: zero committed secrets reported.

## 2. CI runs automatically on a pull request (SC-002)

Open a pull request against `main`.

**Expected**: the Verify workflow starts on its own (no `workflow_dispatch`), runs on a
GitHub-hosted runner, and passes.

## 3. The CLA gate blocks an unsigned contribution (SC-003)

From an identity not in the signature list, open a pull request.

**Expected**: the CLA check fails and the merge is blocked. Add the signature, and the gate passes.

## 4. The docs exist and are linked (SC-004)

Open `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and file a new issue.

**Expected**: the primitive-proposal template is offered, the `good first primitive` label exists,
and the README links to the gallery and `CONTRIBUTING.md`.

## 5. The gallery shows every primitive (SC-005)

```bash
npm run gallery:generate
ls gallery/
```

**Expected**: 29 thumbnails, one per primitive, generated from the reference frames.

## 6. The legal review is recorded (SC-006)

Check the launch record.

**Expected**: the legal review of the licence and CLA is marked complete before the repository is
made public and the package published.

## 7. Nothing renders differently

```bash
npm run verify
git status --short golden/arm64 golden/x64
```

**Expected**: the offline verify passes and no reference frame moved.
