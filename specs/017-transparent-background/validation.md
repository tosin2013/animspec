# Validation: Transparent Background

Run on 2026-10-23, arm64 (macOS), branch `feature/017-transparent-background`, against
[quickstart.md](quickstart.md).

| Step | Outcome |
| --- | --- |
| 1. Verify passes, no existing frame moved (SC-001, SC-006) | `npm run verify` exits 0. `git diff main` of both `hashes.json` files removes 0 lines; only 9 `background:*` keys are added per set. |
| 2. Every primitive, both inks (SC-002) | `transparency: 38/38 primitives match their solid render over the matching background (light, dark)`, at three signal levels, within 1 per channel. |
| 3. Empty and covered pixels, determinism (SC-003, SC-004) | For `grid` and `dots`, light and dark ink: every pixel equal to the source background is alpha 0; every pixel equal to the foreground is that colour at alpha 255. Repeated and chunked renders are byte-identical. A solid spec ignores `ink`. |
| 4. Validation | The five contract cases pass, and the schema lists `"transparent"` and `ink`. |
| 5. Command line (SC-004, SC-005) | "transparent raw equals the library" (alpha below 255 present), "transparent chunk equals the full render" and "transparent png keeps alpha" (alpha 0 present; decoded PNG differs from the library frame by 0) pass. No change to `cli/` was needed. |
| 6. Reference cases | First attempt with alpha added as a raw channel: refused, `background:transparent-accent` differed by 255 (a pixel at alpha 1: `255,0,0` on arm64, `255,255,255` on x64; about 2 as seen). Monochrome cases: colour 0, alpha at most 2. After constitution 3.0.0 (maintainer's choice): 297 cases per set, 9 added, 0 changed, largest cross-type difference 5 of 255. |
| 7. By eye | A light, a dark and an accent transparent frame over a grey checkerboard: soft edges with no black or white fringe, grid seams see-through, the figure solid, the accent rings clean. |

**Budget**: the transparent 12-layer composition case costs 3,045 operations and 24–27 ms per
1080p frame (the solid case: 3,044 operations, 13–15 ms), within 12,000 and 200 ms.
