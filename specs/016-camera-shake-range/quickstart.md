# Quickstart: Validating Camera Shake and the Wider Range

Behaviour is specified in [contracts/camera-shake.md](contracts/camera-shake.md).

## Prerequisites

- Node.js 22 or later, `npm ci` run once, Docker for step 6.
- Run every command from the repository root.

## 1. Verify passes and no existing frame moved (SC-001, SC-007)

```bash
npm run verify
git diff main -- golden/arm64/hashes.json golden/x64/hashes.json | grep '^-  ' | wc -l
```

**Expected**: verify exits 0; the diff count is 0 (only added keys).

## 2. Shake is deterministic and chunk-stable (SC-002)

`npm run verify:determinism` includes the camera-shake checks.

**Expected**: lines passing for "shake renders identically twice", "shake chunk render equals
the whole" and "different seeds shake differently".

## 3. Strength 0 is no shake (SC-003)

**Expected** (same gate): "shake amp 0 equals no shake" passes.

## 4. Depth under parallax (SC-004)

**Expected** (same gate): "depth 0 layer does not shake" and "depth 1 layer shakes" pass.

## 5. Wider range (SC-005) and validation (SC-006)

```bash
npm run verify:validator
```

**Expected**: passing checks for `x: 1.5` kept, `x: 3` clamped to 2, `x: -2` clamped to -1, and
the four malformed-shake cases dropped with their messages while the camera is kept.

## 6. Reference cases on both processor types

```bash
npm run golden:update   # only when the case table changes; reports added cases, 0 changed
```

**Expected**: the `camera:*` cases are added in both sets, 0 existing cases changed, largest
cross-type difference within 8.

## 7. By eye

Render a short loop of `camera:shake-static` and `camera:parallax-shake` (for example with
`animspec render`) and check that the shake reads as a tremble, the background stays still at
depth 0, and nothing reveals more background than `amp` allows.
