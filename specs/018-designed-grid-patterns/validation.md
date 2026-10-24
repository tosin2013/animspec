# Validation: Designed Grid Patterns

Run on 2026-10-23, arm64 (macOS), branch `feature/018-designed-grid-patterns`, against
[quickstart.md](quickstart.md).

| Step | Outcome |
| --- | --- |
| 1. Verify, no existing frame moved (SC-001, SC-007) | `npm run verify` exits 0. `git diff main` of both `hashes.json` files removes 0 lines. |
| 2. The quilt (SC-002) and signal cells | "quilt cells match the pattern at quiet, mid and loud" (every cell-centre pixel bg, fg or `#ff2d2d` as its letter says, at levels 0.02, 0.5 and 0.95); "designed cells ignore the signal"; "an all-~ pattern equals the unpatterned grid" (7 × 5); "checker pattern tiles"; "a transparent patterned grid has alpha 0 in . cells". |
| 3. Breaks (SC-003, SC-004, SC-006) | "a break leaves every other pixel unchanged" (outside a 16-pixel margin around cell 3,2, while the cell itself differs); "break order does not matter"; "a cell named twice adds"; "breaks clamp" (r90 = r45); "solid pattern with a rotated break uses only bg, fg and accent"; "patterned chunk render equals the whole". |
| 4. Validation (SC-005) | 13 cases pass: unknown letter, reserved `b`, short rows, oversize (grid and checker), malformed break, 17 breaks, an out-of-grid break on grid, a clamped value (not reported), a checker break off the board (not reported), and a model-style spec with extra spaces and a trailing `;`. Each layer still renders. |
| 5. Vocabulary and reference cases | Vocabulary 13 recorded ("grid and checker pattern and breaks (designed grids)"). `golden:update`: 309 cases per set, 12 added, 0 changed, largest cross-type difference 5 of 255. Four `golden/CHANGES.md` rows. |
| 6. By eye | The showcase quilt: empty fabric stays empty, the gold blocks sit where the `a` letters are. Break it once: the centre block is turned 15° with clean whole-pixel edges. The patterned checker tiles its 3 × 3 pattern with gold accents. |

**Budget**: the default `grid` and `checker` layers are unchanged (502 and 648 operations per
1080p frame). The gates now also probe each new param's declared example.

**Analysis findings applied**:
- I1: the contract notes that checker breaks outside the board are not reported.
- U1: the param descriptions and the guide say that spaces count toward the length limit.
- U2: the prompt check uses `PRIMITIVES.filter`.
- I2: the 0.6.0 showcase cases come first.
