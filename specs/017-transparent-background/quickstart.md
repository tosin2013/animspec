# Quickstart: Validating the Transparent Background

Behaviour is specified in [contracts/transparent-background.md](contracts/transparent-background.md).

## Prerequisites

- Node.js 22 or later, `npm ci` run once, Docker for step 6.
- Run every command from the repository root.

## 1. Verify passes and no existing frame moved (SC-001, SC-006)

```bash
npm run verify
git diff main -- golden/arm64/hashes.json golden/x64/hashes.json | grep '^-  ' | wc -l
```

**Expected**: verify exits 0; the count is 0.

## 2. Every primitive, both inks (SC-002)

**Expected** (`npm run verify:gates`): the transparency line reports all primitives passing
for light and dark ink.

## 3. Empty and covered pixels (SC-003) and determinism (SC-004)

**Expected** (`npm run verify:determinism`): passing lines for "empty pixels are transparent",
"covered fg pixels are opaque", "transparent renders identically twice" and "transparent chunk
render equals the whole", for both inks.

## 4. Validation

```bash
npm run verify:validator
```

**Expected**: the five background/ink cases in the contract's validation table pass.

## 5. Command line (SC-004, SC-005)

**Expected** (`npm run verify:cli`): "transparent raw equals the library" and "transparent png
keeps alpha" pass.

## 6. Reference cases on both processor types

```bash
npm run golden:update
```

**Expected**: 9 `background:*` cases added per set, 0 changed, largest cross-type difference
within 8 (now including alpha).

## 7. By eye

Render a transparent light and a transparent dark frame of a busy spec to PNG and view them
over a checkerboard: edges are soft with no black or white fringe, seams are see-through.
