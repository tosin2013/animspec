# Validation Record: Complete the Primitive Vetting Gates

**Date**: 2026-10-01 | **Machine**: macOS, arm64 | **Branch**: `001-primitive-vetting-gates`

The outcome of each step in [quickstart.md](quickstart.md), and of the polish tasks T050 to
T054. The tasks ask for this to be recorded in the pull request description; it is kept here
so it travels with the branch.

## Quickstart steps

| Step | Check | Outcome |
| --- | --- | --- |
| 1 | The whole vocabulary is clean | Pass. `npm run verify` exits 0 and ends `29/29 primitives pass every gate`, with four gates listed. 9 seconds. |
| 2 | Each gate rejects a violation | Pass. `fixtures: each gate rejects its rule-breaking fixtures (5/5)`. See the deliberate breaks below. |
| 3 | Unchanged primitives are byte-identical | Pass. Against `main`, five existing hashes changed and 15 were added; see below. |
| 4 | Icons work from any folder | Pass. `purity 29/29`, no working-directory failure. |
| 5 | No file or network access in `src/` | Pass. The search finds nothing; the static scan agrees. |
| 6 | Icon data is fresh | Pass. Regenerating produces no diff. |
| 7 | Verdicts are stable | Pass. Ten consecutive runs of `verify:gates`, ten zero exit codes. |
| 8 | The budget holds at full HD | Pass. `budget 29/29`. `plasma` reports 1 operation (was 32,400) and about 3.8 ms (was 22 to 31). The heaviest is `rain` at 1,377 operations and about 4.4 ms. |
| 9 | Documentation matches | Pass. The constitution is at 2.0.1 with the four rules Enforced; the README lists the gates and no longer has the working-directory limitation. |

## Deliberate breaks (run in a scratch copy, not in the repository)

| Change | Result |
| --- | --- |
| `bars` paints a fixed `#00ff00` | `FAIL palette bars pixel 0,133,0`; summary `28/29`; exit 1 |
| `sweep` loses its amplitude term | `FAIL reactivity sweep identical output for silent/loud and for both labels`; `28/29`; exit 1 |
| `rings` loops 5,000 `fillRect` calls | `FAIL budget rings 5005 ops (allowed ≤ 3000 ops)`; `28/29`; exit 1 |
| icon lookup made to depend on the working directory at draw time | `FAIL purity led` and `sprite`, `output depends on the working directory`; `27/29`; exit 1 |
| a primitive throws on a non-default probe | `FAIL purity scan threw: boom`; `28/29`; exit 1 |
| `flash`'s full-strength accent branch reverted to inversion | `FAIL palette flash pixel 76,255,255 (reducedFlicker off)`; `28/29`; exit 1 |

In each case the failing line names the gate, the primitive, what was measured and what is
allowed, and only the offending primitive is blamed.

## Golden hashes against `main` (SC-003)

- **Existing hashes changed: 5.** `sweep@quiet`, `sweep@loud`, `gridhorizon@quiet`,
  `gridhorizon@loud`, `flash@loud`.
- **Added: 15.** Twelve `icon:*` cases and three `flash:full@*` cases.
- **Removed: 0.**
- `golden/CHANGES.md` has a row for each of the five groups.

This is fewer than the seven changes the plan expected. `sweep@mid` and `gridhorizon@mid` did
not move, because both loudness factors are exactly 1 at the mid level, so the mid-level
picture is the same as before.

Result against SC-003: 26 of 29 primitives produce exactly the same monochrome frames as
before. The three that changed are `sweep`, `gridhorizon` and `flash`.

## Other polish checks

| Task | Check | Outcome |
| --- | --- | --- |
| T051 | Ten stable runs | Pass |
| T052 | Full suite under 60 seconds | Pass, 9 seconds |
| T054 | `tsc` passes; public exports unchanged | Pass; `src/index.ts` is identical to `main` |

## The run on the build machine (T055)

Run 36907635181 on branch `001-primitive-vetting-gates`, Linux x64, 15 seconds.

| Gate | Verdict on the build machine |
| --- | --- |
| type check, registry, validator | passed |
| determinism: static scan, two renders agree | passed |
| determinism: hashes match golden | **failed**, as expected: the hashes were recorded on arm64 (see the roadmap finding that became spec 002) |
| the four vetting gates | **not reached**: `npm run verify` stops at the first failing gate |

Because the build stops before the vetting gates, they were run separately in Linux
containers. Planning for spec 002 showed that an emulated x64 container renders byte-identically
to the real build machine.

| Machine | Vetting gates | Slowest primitive | Time for the four gates |
| --- | --- | --- | --- |
| Linux x64 (emulated) | 29/29, fixtures 5/5 | `plasma` 14.6 ms, `rain` 10.2 ms | 111 s under emulation |
| Linux arm64 | 29/29, fixtures 5/5 | `rain` 5.0 ms | 7 s |

What this does and does not show:

- The four vetting gates give the same verdict on macOS arm64, Linux arm64 and Linux x64.
- The 50 ms time limit holds with room to spare even under emulation.
- The build machine's own verdict on the vetting gates, and the full suite's duration there,
  remain unmeasured until the determinism gate passes on x64, which is spec 002's job. The
  15-second run covers everything up to and including the determinism gate.

## What the private product must re-record

`sweep@quiet`, `sweep@loud`, `gridhorizon@quiet`, `gridhorizon@loud` and `flash@loud`.
Everything else it renders with these primitives is unchanged, including `plasma`.
