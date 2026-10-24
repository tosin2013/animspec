# Contract: Sprite Sheets

```jsonc
{
  "assets": { "run": { "sha256": "<64 hex>", "width": 512, "height": 64 } },
  "layers": [
    { "type": "image", "asset": "run", "sheetCols": 8, "fps": 12, "fit": "none", "scale": 3,
      "x": 0.4, "y": 0.8, "anchor": "bottom", "flip": "x", "drive": "none" }
  ]
}
```

- **Frame shown at frame time `t`**: `(frameStart + floor(t·fps)) mod frameCount`.
- **Reading order**: left to right, then top to bottom.
- **Validation**: no new messages. The params are bounded numbers, clamped by the existing
  sanitizer.
