# Quickstart: Pixel Mode and Two-Tone Bars and Rings

Validation scenarios for spec 026. Contract: [contracts/pixel-mode.md](contracts/pixel-mode.md).

## Prerequisites

- Node.js 22 or later, and `npm ci`.
- Docker running, to render the x64 reference set (`npm run golden:update`).

## 1. Nothing moves

```sh
npm run verify:determinism   # "hashes match golden/<arch>" and "no stale golden entries"
```

**Expected**: every pre-existing case key keeps its hash. Only the new 026 keys are added.

## 2. Palette-exact bars at a fractional pitch (US1, SC-002)

Render with the CLI. The track is the committed fixture.

```sh
cat > /tmp/bars.json <<'EOF'
{ "background": "black", "pixelMode": true, "layers": [{ "type": "bars" }] }
EOF
npm run build
node dist-cli/animspec.js render /tmp/bars.json --signal golden/signalframe/sample.asft \
  --width 1587 --height 400 --end 3 --png /tmp/bars-png
```

**Expected**: every pixel of every PNG is `#000000`, `#ffffff` or the accent. The determinism
gate runs this as "pixel mode: bars have 0 pixels outside the palette".

Run it again without `pixelMode` to see the blended edges #159 describes.

## 3. Rings, emitter, particles, image (US1 and US2)

```sh
npm run verify:determinism   # "pixel mode: <type> has 0 pixels outside the palette" for each FR-004 primitive
```

## 4. Camera rounding (US2 scenario 2)

```sh
npm run verify:determinism   # "pixel mode: a camera pan leaves no blended column"
```

## 5. tone2 (US3)

```jsonc
{ "background": "black", "roles": { "fg2": "#d8c8a0" }, "pixelMode": true,
  "layers": [{ "type": "rings", "tone2": "alternate", "count": 6, "thickness": 6 }] }
```

Render it with `--creative`.

**Expected**: rings 2, 4 and 6 are `#d8c8a0`, rings 1, 3 and 5 are the accent, and no other
pixel is `#d8c8a0`. Without `--creative`, the even rings are `#808080`.

## 6. Validation

```sh
npm run verify:validator     # "pixelMode dropped (must be true or false)" for 1, "true", null
```

## 7. Whole suite

```sh
npm run verify
```

**Expected**: exit 0, offline.
