# Quickstart: Validating Vocabulary Version and Tiers

How to prove the feature works end to end. Behaviour is specified in
[contracts/vocabulary-version.md](contracts/vocabulary-version.md) and
[contracts/tiers-and-selection.md](contracts/tiers-and-selection.md).

## Prerequisites

- Node.js 22 or later, and `npm install` run once
- Run every command from the repository root
- A clean working tree, so that steps which edit files can be undone with `git checkout`

## 1. Verify passes on unchanged code (SC-009)

```bash
npm run verify
```

**Expected**: exit code 0. The registry gate prints a line for the vocabulary record, one for
each tier rule, one for each fixture, and the two selection sweeps. No network is used.

## 2. No reference frame moved (SC-006)

```bash
git status --short golden/arm64 golden/x64
npm run verify:determinism
```

**Expected**: no changes under either reference set, and the determinism gate passes with the
same case count as before the feature.

## 3. Every validated spec records a version (SC-001, SC-002)

```bash
npm run verify:validator
```

**Expected**: passing checks for each row of the validation table in
[contracts/vocabulary-version.md](contracts/vocabulary-version.md): no version, a known
version, a newer version, an invalid version, and a spec validated twice keeping its version.

## 4. Tiers are assigned and visible (SC-003, SC-010)

Open `VOCABULARY.md`.

**Expected**: the current version at the top; 29 rows; 24 marked core and 5 marked extended
(`sprite`, `tetris`, `plasma`, `gridhorizon`, `tunnel`); none contrib or legacy. Finding the
version and any one primitive's tier takes under a minute.

## 5. Selection respects tiers (SC-004, SC-005)

```bash
npm run verify:registry
```

**Expected**: the sweep lines report at least 1,000 selections with no kit and at least 1,000
for each of the 8 kits, with 0 violations.

Spot check by hand:

```bash
npx tsx -e '
import { select, selectDetailed } from "./src/index";
console.log(select("auto", 0.5, 7).map((p) => `${p.type}:${p.tier}`).join(" "));
console.log(select("retro", 0.5, 7).map((p) => `${p.type}:${p.tier}`).join(" "));
console.log(selectDetailed("auto", 0.5, 7, ["plasma", "nope"]).refused);
'
```

**Expected**: the first line is all core. The second contains `plasma`, `gridhorizon` and
`tunnel` as extended and everything else core. The third lists `plasma` as refused
(extended, no kit) and `nope` as refused (not a primitive).

## 6. A replaced primitive keeps rendering and is never offered (SC-007)

Covered inside step 5 by the replacement fixture.

**Expected**: lines reporting that the fixture renders byte-identical frames as core and as
legacy, and that it was offered in 0 selections.

## 7. Each rule catches its violation (SC-008)

Covered inside step 5 by the fixtures. To see one fail for real, break a rule in the working
tree, run the gate, then undo it:

| Break | Expected failure |
| --- | --- |
| change `grid`'s tier to `"gold"` | names `grid`: not a valid tier |
| add `"sprite"` to the `minimal` kit after marking `sprite` contrib | names `minimal` and `sprite` |
| remove `plasma` from the `retro` kit | names `plasma`: extended, in no kit |
| add a param to `wave` without raising the version | vocabulary differs from version N; names `wave` |
| raise `VOCABULARY_VERSION` without recording | no record for version N |

```bash
npm run verify:registry   # exits 1 and names what is at fault
git checkout -- src       # undo
```

## 8. Raising the version works (FR-008, FR-024)

On a scratch branch:

1. Add a boolean param to any primitive, defaulting to the old behaviour.
2. Run `npm run verify:registry`. **Expected**: fails, vocabulary differs.
3. Raise `VOCABULARY_VERSION` by one and run `npm run vocab:record -- "quickstart test"`.
4. Run `npm run verify`. **Expected**: passes; `golden/vocabulary.json` has a new entry and
   `VOCABULARY.md` shows the new version. No reference frame moved.
5. Run `npm run vocab:record -- "again"`. **Expected**: reports the vocabulary unchanged and
   adds no entry; `golden/vocabulary.json` is byte-identical.

Discard the branch.

## 9. The build stays within budget (SC-009)

Trigger the Verify workflow by hand once the change is pushed.

**Expected**: it passes in under two minutes.
