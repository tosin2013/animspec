# Validation: Vocabulary Version and Tiers

End-to-end validation against the success criteria, recorded by running every step of
[quickstart.md](quickstart.md) on 2026-10-09 on branch `003-vocab-version-tiers` (macOS, arm64).

## 1. Verify passes on unchanged code (SC-009)

`npm run verify` exits 0. The registry gate prints the vocabulary-record line, one line per
tier rule, one per fixture, the replacement checks and the two selection sweeps. The
determinism and vetting gates are unchanged and pass (29/29). No network is used.

## 2. No reference frame moved (SC-006)

`git status --short golden/arm64 golden/x64` is empty, and `git diff main --stat -- golden/arm64 golden/x64`
is empty. The determinism gate passes with the same 150-case count as before.

## 3. Every validated spec records a version (SC-001, SC-002)

`npm run verify:validator` passes every row of the validation table in
[contracts/vocabulary-version.md](contracts/vocabulary-version.md): no version (stamped with
the current version), a known version (kept), a newer version (replaced and reported), an
invalid version (replaced and reported), and a spec validated twice keeping its version.

## 4. Tiers are assigned and visible (SC-003, SC-010)

`VOCABULARY.md` shows version 1 at the top, 29 rows, 24 marked core and 5 marked extended
(`sprite`, `tetris`, `plasma`, `gridhorizon`, `tunnel`), none contrib or legacy.

## 5. Selection respects tiers (SC-004, SC-005)

`npm run verify:registry` reports `PASS  1000 selections with no kit: core only` and
`PASS  1000 selections per kit (8 kits): tiers respected`, plus the same two sweeps over the
fixture vocabulary. Spot checks (see quickstart.md step 5) show the no-kit selection is all
core, the `retro` selection contains `plasma`/`gridhorizon`/`tunnel` as extended, and
`plasma`/`nope` are refused for the `auto` kit.

## 6. A replaced primitive keeps rendering and is never offered (SC-007)

Covered inside the registry gate by the replacement fixture:
`PASS  replaced fixture renders identically as core and as legacy`, and the fixture is offered
in 0 selections across the sweeps.

## 7. Each rule catches its violation (SC-008)

Each tier rule, replacement rule and record rule is proven against a fixture that breaks it
(`tier rule catches …`, `replacement rule catches …`, `record: … is caught`). Verified for real
by raising `VOCABULARY_VERSION` to 2 without recording: the gate fails with
`no record for version 2; run npm run vocab:record` (reverted).

## 8. Raising the version works (FR-008, FR-024)

`npm run vocab:record -- "first recorded vocabulary: 29 primitives, 24 core and 5 extended"`
wrote `golden/vocabulary.json` (one entry, version 1) and `VOCABULARY.md` (version 1, 29 rows).
A second run reported `vocabulary unchanged at version 1; VOCABULARY.md refreshed` and left
`golden/vocabulary.json` byte-identical.

## 9. The build stays within budget (SC-009)

Triggered by hand with `gh workflow run verify.yml --ref 003-vocab-version-tiers`
(run 37939028093). The `verify` job **passed in 36 seconds**, well under the two-minute budget.
