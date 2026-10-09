# Quickstart: Validating the Publishable npm Package

How to prove the feature works end to end. Behaviour is specified in
[contracts/package-surface.md](contracts/package-surface.md) and
[contracts/release.md](contracts/release.md).

## Prerequisites

- Node.js 22 or later, and `npm install` run once
- Run every command from the repository root

## 1. The build produces a package (SC-001, SC-002)

```bash
npm run build
npm run verify:package
```

**Expected**: `dist/` is produced; `verify:package` builds a tarball, installs it into a scratch
folder, and reports that every rendered case matches the committed golden hashes for this
machine's processor type. This is the M1 gate.

## 2. The package is self-contained (SC-003)

```bash
npm pack --pack-destination /tmp/animspec-pack
mkdir -p /tmp/animspec-consumer && cd /tmp/animspec-consumer
npm init -y >/dev/null && npm install /tmp/animspec-pack/animspec-*.tgz >/dev/null
node --input-type=module -e '
  import { drawSpec, validateAnimSpec } from "animspec";
  import { createCanvas } from "@napi-rs/canvas";
  const { spec } = validateAnimSpec({ layers: [{ type: "grid" }, { type: "caption" }] });
  const d = { width: 320, height: 180 };
  const ctx = createCanvas(d.width, d.height).getContext("2d");
  drawSpec(ctx, d, { index: 0, t: 0, values: new Float64Array(256), spectrum: new Float64Array(256), amplitude: 0.5, energy: 0.4, labels: ["HI"] }, spec, { reducedFlicker: true, creative: false, seed: 1 });
  console.log("rendered from the installed package");
'
```

**Expected**: the consumer folder has no `assets/`, yet text and grid render from the installed
package. Rendering works from any working directory.

## 3. The public surface is clean (SC-004)

```bash
npx tsx -e '
  import * as pkg from "./dist/index.js";
  console.log(Object.keys(pkg).sort().join("\n"));
'
```

**Expected**: the list is exactly the exports in
[contracts/package-surface.md](contracts/package-surface.md) — no `SignalSource`, `AudioAnalysis`,
or `RenderOptions`.

```bash
npx tsc --noEmit -p tsconfig.json   # the no-argument default is gone at the type level
```

**Expected**: a call to `buildVocabPrompt()` or `buildJsonSchema()` with no argument is a type
error.

## 4. Releases and dependency updates (SC-005, SC-006)

```bash
gh workflow run publish.yml --ref 004-publishable-npm-package   # after the tag is cut (005 gate for the real publish)
```

**Expected**: the release workflow builds and publishes (or, before the public launch, a dry
run proves the flow without a live publish).

```bash
gh run list --workflow=verify.yml   # each Dependabot proposal passes verify
```

**Expected**: every proposed dependency update runs the offline verify and merges only on a
pass.

## 5. Nothing renders differently (SC-007)

```bash
npm run verify
git status --short golden/arm64 golden/x64
```

**Expected**: the full offline verify passes and no reference frame moved.
