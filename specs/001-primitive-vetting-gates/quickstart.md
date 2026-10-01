# Quickstart: Validating the Primitive Vetting Gates

How to prove the feature works end to end. See [contracts/gates.md](contracts/gates.md) for
the rules and output format, and [data-model.md](data-model.md) for the shapes involved.

## Prerequisites

- Node.js 22 or later
- `npm install` run once in the repository root

## 1. The whole vocabulary is clean (SC-001, SC-007)

```bash
time npm run verify
```

**Expected**: exit code 0; the output ends with `29/29 primitives pass every gate` and
`vetting gates passed`; total time under 60 seconds.

## 2. Each gate really rejects a violation (SC-002, SC-008)

```bash
npm run verify:gates
```

**Expected**: the line `fixtures: each gate rejects its rule-breaking fixtures (5/5)`.

To see a real failure message, temporarily break one primitive and run the gates again:

| Temporary change in `src/primitives/registry.ts` | Expected failing line names |
| --- | --- |
| set a fixed `ctx.fillStyle = "#00ff00"` in `bars` | `palette`, `bars` |
| remove the amplitude term from `sweep` | `reactivity`, `sweep` |
| loop a `fillRect` 5,000 times in `rings` | `budget`, `rings`, the measured count |

In each case the command exits non-zero, the summary reads `28/29`, and the message alone is
enough to know what to fix. Revert the change afterwards.

## 3. Unchanged primitives are byte-identical (SC-003)

```bash
npm run verify:determinism
git diff --stat golden/hashes.json
```

**Expected**: the determinism gate passes. Against the commit before this feature, the only
existing entries that differ are seven: the six for `sweep` and `gridhorizon`, and
`flash@loud`. The `plasma` entries are unchanged. The 12 `icon:*` and 3 `flash:full@*` cases
are new. `golden/CHANGES.md` has an entry for each of these.

## 4. Icons work from any folder (SC-004)

This is checked automatically. The purity gate renders the icon layers for `led` and `sprite`
from the repository root and again from a temporary folder, and compares them.

```bash
npm run verify:gates
```

**Expected**: `purity 29/29`, with no `output depends on the working directory` line.

## 5. Drawing has no file or network access (FR-005, FR-006)

```bash
grep -rnE "from \"(node:)?(fs|path|net|http|https|dns|child_process)\"|process\.cwd" src/
```

**Expected**: no matches. The same rule is enforced by `npm run verify:determinism`.

## 6. Icon data is fresh

```bash
npm run icons:generate && git diff --stat src/primitives/iconData.ts
```

**Expected**: no diff.

## 7. Verdicts are stable (SC-006)

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do npm run --silent verify:gates >/dev/null 2>&1; echo -n "$? "; done; echo
```

**Expected**: ten zeros.

## 8. The budget holds at full HD (SC-005)

Read the `info  time per 1080p frame` line and the `budget 29/29` tally from step 1.

**Expected**: no primitive above 3,000 operations; `plasma` reports 1 operation where it
previously reported about 32,400.

## 9. Documentation matches (FR-021)

Open the quality-gate table in `.specify/memory/constitution.md` and the Verify section of
`README.md`.

**Expected**: the four rules are shown as enforced, the constitution has had a PATCH bump, and
the README no longer lists the working-directory limitation.
