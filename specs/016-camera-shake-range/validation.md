# Validation: Camera Shake and a Wider Camera Range

Run on 2026-10-23, arm64 (macOS), branch `feature/016-camera-shake`, against
[quickstart.md](quickstart.md).

| Step | Outcome |
| --- | --- |
| 1. Verify passes, no existing frame moved (SC-001, SC-007) | `npm run verify` exits 0. `git diff main` of both `hashes.json` files removes 0 lines; only the 9 `camera:*` keys are added per set. |
| 2. Determinism and chunks (SC-002) | Passing: "shake renders identically twice", "shake chunk render equals the whole", "different seeds shake differently" (the unshaken frame is seed-independent; the shaken frame is not). |
| 3. Strength 0 (SC-003) | "shake amp 0 equals no shake" passes. |
| 4. Depth under parallax (SC-004) | "depth 0 layer does not shake under parallax", "depth 1 layer shakes under parallax" and "a non-parallax move ignores depth" pass. |
| 5. Range and validation (SC-005, SC-006) | Validator: `x: 1.5` kept, `x: 3` → 2, `y: -2` → -1, `x: 0.7` unchanged; the four malformed shakes dropped with their exact messages, camera kept. Determinism: "a pan to x 1.5 ends one frame right of x 0.5" passes. |
| 6. Reference cases | `npm run golden:update`: 288 cases per set, 9 added, 0 changed; largest cross-type difference 5 of 255 (allowed 8). Three `golden/CHANGES.md` rows. |
| 7. By eye | Contact sheets of 8 frames (every third frame) for a static shake (`amp` 0.03) and a parallax shake (`amp` 0.05). The grid trembles irregularly in both axes and reveals at most a thin background edge; under parallax the depth-0 horizon and sun stay fixed while the depth-1 figure shakes. |

Additional checks added at analysis: "zoom does not enlarge the shake" (the best-aligning
pixel shift is the same at zoom 1 and 2, within 1 pixel) and "reduced flicker leaves the
shake unchanged" both pass. Sampling 100,000 offsets at `amp` 0.05, `freq` 5 gives a
largest offset of 0.049999…, so the stated strength is the true maximum.
