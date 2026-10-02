# Validation Record: Reference Frames Match on Every Machine

Outcomes recorded as the feature is implemented. The quickstart steps are added here when the
polish phase runs them.

## T023: the first build on the real x64 machine (2026-10-01)

Run 36949558398 on branch `002-cross-machine-frames` at `661dd95`, Linux x64. **Passed**, in
36 seconds.

| Gate | Verdict |
| --- | --- |
| type check, registry, validator | passed |
| determinism: reference set `x64`, 144 cases, hashes match `golden/x64` | passed |
| vetting gates: purity, palette, reactivity, budget | 29/29 each, fixtures 5/5 |

What this settles:

- **The open assumption holds.** The x64 reference set was recorded in an emulated container
  on an arm64 Mac. The real x64 build machine reproduces all 144 cases byte for byte,
  including every text case in all three shipped fonts.
- **Text no longer depends on machine fonts.** The runner's fonts differ from both the Mac's
  and the container's, and the text cases still match.
- **This is the first green build of the repository.**
- **It is also the first verdict from the real build machine on the vetting gates**, which
  feature 001 could only check in containers because the build used to stop at the
  determinism gate. Slowest primitive there: `rain` at 11.9 ms against a 50 ms limit.

Also verified locally before the push: the determinism gate passes in `linux/amd64` and
`linux/arm64` containers with only the stock image's fonts installed.

## Polish phase: quickstart and final checks (2026-10-01)

Run on the maintainer's Mac (arm64) at `e79a08c`, with Docker 29.4.0 for the container steps.
No pull request is open yet, so the items the tasks ask to be recorded "in the pull request
description" are recorded here and can be copied into it.

### Quickstart (T039)

| Step | What was run | Outcome |
| --- | --- | --- |
| 1. Verify passes on this machine | `npm run verify` | Passed. Reference set `arm64`, 150 cases, `within tolerance of x64 (largest difference 5 of 255, allowed 8)` |
| 2. Gate passes on the other processor type | determinism gate in `linux/amd64` and `linux/arm64` containers | Passed on both. The x64 container reports `reference set: x64`, 150 cases, largest difference from arm64 5 of 255 |
| 3. Text does not depend on installed fonts | `linux/arm64` container with `fonts-noto-cjk` added (3 font families before, 18 after) | Passed, including the three `text:missing-glyphs` cases |
| 4. The automated build is green | run 36957710849 at `b9f282a`, Linux x64 | Passed in 38 seconds (job 32 s). Reference set `x64`, 150 cases, hashes match `golden/x64`, largest difference from arm64 5 of 255; vetting gates 29/29. This is the real build machine at the final code, after all five stories |
| 5. Tolerance holds and is enforced | read from step 1; then limit lowered from 8 to 2 | Largest difference 5, with both `composite:layers12-*` cases included. At 2 the gate fails with 11 cases named, each with its measured difference (3 to 5). Limit restored |
| 6. One command refreshes both sets | `npm run golden:update` on unchanged code, then with Docker unreachable | 0 changed in both sets, nothing written, `git status golden/` empty, 7.7 s with a warm container volume. With Docker unreachable: `Docker is unavailable (docker info failed) — no reference set was changed`, exit 1, `golden/` untouched |
| 7. A rendering change is caught on both types | `grid`'s threshold raised by 0.2, gate run natively and in a `linux/amd64` container | Both fail, each naming its own set and the same six cases (`grid@mid`, `grid@loud`, and the composites containing `grid`). Reverted; gate passes again |
| 8. Font choice works | the snippet from the quickstart | Three keys; `dejavu`, `jetbrains` and `plex` kept; `comic-sans` dropped with `font dropped (not a shipped font)` and the spec still valid; no font means the default |
| 9. Unchanged primitives are unchanged | see T040 below | Passed |
| 10. The promise is stated accurately | README, constitution Principle I, `NOTICE` | README and Principle I both state the per-type guarantee, the tolerance of 8, and arm64 and x64. Constitution is at 2.1.1 with no gate left Planned. `NOTICE` lists the three fonts with their licences |

Step 6's first run on a machine, with a cold container volume, was not timed in this pass.

### Unchanged primitives (T040, SC-005)

`golden/arm64/hashes.json` compared with `golden/hashes.json` from the commit before `fb06c49`.

| | Count |
| --- | --- |
| cases before the feature | 111 |
| cases now | 150 |
| existing cases unchanged | 86 |
| existing cases changed | 25 |
| existing cases removed | 0 |
| cases added | 39 |

The 25 changed cases belong only to `caption`, `rain`, `text`, `crosshair`, `led` (three each),
`sprite@loud`, `composite:grid+wave+caption`, `composite:creative-accent` and
`icon:led-unknown` (three each). Nothing else moved. The 39 added cases are the 30 `font:*`
cases, 3 `text:missing-glyphs` and 6 `composite:layers12-*`. `golden/CHANGES.md` has a row for
each: the first x64 set, the shipped default font, the missing-glyph cases, the per-font
cases, the validated default layers, and the maximum-layer composites.

### Cost (T041)

| Measure | Result | Limit |
| --- | --- | --- |
| `npm run verify`, locally | 9.1 to 9.4 s over three runs | 60 s |
| Automated build | 38 s (run 36957710849 at `b9f282a`) | 2 min |
| Importing the fonts (load, decode, register) | 12 to 16 ms over five runs | 100 ms |

For scale: importing the canvas library itself takes about 81 ms, and the rest of
`src/index.ts` about 8 ms.

### Type check and vetting gates (T042)

`npm run check` passes with the generated font modules. `npm run verify:gates` reports 29/29
for purity, palette, reactivity and budget, and 5/5 fixtures. The text primitives pass the
purity gate (no file access at load or draw) and the palette gate in the shipped font.

### For the private product (T043)

- **Re-record**: every text case (`caption`, `rain`, `text`, `crosshair`, `led`, and any
  composite or icon case that draws text), plus `led` and `sprite`, whose reference cases now
  use validated default layers. Text looks different on every machine: it is drawn with the
  shipped default font, not a machine font.
- **Compare per processor type**: reference frames are byte-identical only between machines
  of the same processor type. Compare against the reference set for the type the product
  runs on (`arm64` or `x64`), or allow 8 of 255 per channel across the two.
- **New optional field**: a spec may carry `font` (`dejavu`, `jetbrains` or `plex`). Specs
  without it render with the default.
