# Quickstart: Validating Designed Grid Patterns

Behaviour is specified in [contracts/pattern-and-breaks.md](contracts/pattern-and-breaks.md).

## Prerequisites

Node.js 22 or later, `npm ci` run once, Docker for step 5. Run from the repository root.

## 1. Verify, no existing frame moved (SC-001, SC-007)

```bash
npm run verify
git diff main -- golden/arm64/hashes.json golden/x64/hashes.json | grep '^-  ' | wc -l
```

**Expected**: verify exits 0; the count is 0.

## 2. The quilt (SC-002) and signal cells

**Expected** (`npm run verify:determinism`): passing lines for "quilt cells match the pattern
at quiet, mid and loud", and "an all-~ pattern equals the unpatterned grid".

## 3. Breaks (SC-003, SC-004, SC-006)

**Expected** (same gate):
- "a break leaves every other pixel unchanged" passes.
- "break order does not matter" passes.
- "solid pattern with a rotated break uses only bg, fg and accent" passes.
- "patterned chunk render equals the whole" passes.

## 4. Validation (SC-005)

```bash
npm run verify:validator
```

**Expected**: the eight contract cases pass, each reported, each layer still rendering.

## 5. Vocabulary and reference cases

```bash
npm run vocab:record
npm run golden:update
```

**Expected**:
- Vocabulary 13 is recorded.
- 12 `grid:pattern-*` / `checker:pattern` cases are added per set, 0 changed.
- The cross-type difference is within 8.

## 6. By eye

`npm run showcase:generate`, then look at the quilt and break-it-once cases: empty fabric
stays empty, one block sits turned.
