# Quickstart: Validating Cross-Machine Reference Frames

How to prove the feature works end to end. Behaviour is specified in
[contracts/reference-frames.md](contracts/reference-frames.md) and
[contracts/fonts.md](contracts/fonts.md).

## Prerequisites

- Node.js 22 or later, and `npm install` run once
- Docker, for steps 2, 3 and 6
- The `gh` command, for step 4

## 1. Verify passes on this machine (SC-001, part)

```bash
npm run verify
```

**Expected**: exit code 0. The determinism gate names this machine's reference set and prints
`within tolerance of <other type> (largest difference N of 255, allowed 8)`.

## 2. The determinism gate passes on the other processor type (SC-001, part)

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/in:ro node:22 \
  bash -c 'cp -r /in /work && cd /work && rm -rf node_modules && npm ci --silent && npm run verify:determinism'
```

Repeat with `--platform linux/arm64`.

**Expected**: exit code 0 on both. On x64 the gate reports `reference set: x64`.

Only the determinism gate is run in containers. The full suite includes a speed gate with a
time limit, which emulation can exceed for reasons that have nothing to do with this feature.
The full suite on real x64 hardware is step 4.

## 3. Text does not depend on installed fonts (SC-002)

The `node:22` image in step 2 has three font families installed, against several hundred on a
Mac. Step 2 passing on `linux/arm64` therefore shows text is byte-identical with and without
machine fonts. To check a machine with extra fonts as well:

```bash
docker run --rm --platform linux/arm64 -v "$PWD":/in:ro node:22 \
  bash -c 'apt-get update -qq && apt-get install -y -qq fonts-noto-cjk >/dev/null && \
           cp -r /in /work && cd /work && rm -rf node_modules && npm ci --silent && npm run verify:determinism'
```

**Expected**: passes, including the `text:missing-glyphs` cases.

## 4. The automated build is green (SC-004)

```bash
gh workflow run verify.yml --ref <branch>
gh run watch
```

**Expected**: success, in under two minutes. This run is also the first comparison of text on
the real x64 build machine with the emulated one; a hash mismatch confined to text cases means
the open assumption in research.md has failed.

## 5. Cross-type tolerance holds and is enforced (SC-003, SC-007)

Read the `within tolerance` line from step 1.

**Expected**: largest difference no more than 8, with the two `composite:layers12-*` cases
included.

To see it enforced, temporarily lower the limit in the determinism gate to 2 and run
`npm run verify:determinism`.

**Expected**: failure naming a case and its measured difference. Restore the limit.

## 6. One command refreshes both sets (SC-006)

```bash
time npm run golden:update
git status --short golden/
```

**Expected**: on unchanged code, both sets are reported with 0 changed and `git status` shows
nothing. Under five minutes.

Then quit Docker and run it again.

**Expected**: it stops with an explanation and `git status --short golden/` is still empty.

## 7. A rendering change is caught on both types (SC-007)

Temporarily change one number in a primitive in `src/primitives/registry.ts`, then run step 1
and step 2.

**Expected**: both fail, name the primitive's cases and the set compared against. Revert.

## 8. Font choice works (SC-009)

```bash
npx tsx -e '
import { validateAnimSpec, FONTS } from "./src/index";
console.log(Object.keys(FONTS));
for (const font of ["dejavu", "jetbrains", "plex", "comic-sans", undefined]) {
  const r = validateAnimSpec({ font, layers: [{ type: "caption" }] });
  console.log(font, "->", r.spec?.font ?? "(default)", r.errors);
}'
```

**Expected**: three keys; the three shipped fonts are kept; `comic-sans` is dropped with
`font dropped (not a shipped font)` and the spec is still valid; no font means the default.

The per-font reference cases (`font:jetbrains:caption@mid` and so on) passing in step 1 show
that each choice renders in its own font.

## 9. Unchanged primitives are unchanged (SC-005)

```bash
git diff <commit before this feature> -- golden/arm64/hashes.json
```

Compare against the old `golden/hashes.json`.

**Expected**: the only existing keys whose hashes changed belong to `caption`, `text`, `rain`,
`crosshair`, `led`, `sprite`, the two composites that contain text, and the `icon:led-*`
cases. Every other existing hash is identical. `golden/CHANGES.md` has an entry for each.

## 10. The promise is stated accurately (SC-008)

Open the determinism paragraph in `README.md`, Principle I in
`.specify/memory/constitution.md`, and `NOTICE`.

**Expected**: both documents state the per-type guarantee, the tolerance of 8, and the two
supported processor types; the constitution is at version 2.0.1 or later, with no gate left
marked Planned for this feature; `NOTICE` lists the
three fonts with their licences.
