# Contract: Image Assets

```jsonc
{
  "assets": {
    "forest": { "sha256": "<64 hex>", "width": 640, "height": 180 },
    "hero":   { "sha256": "<64 hex>", "width": 48,  "height": 64 }
  },
  "layers": [
    { "type": "image", "asset": "forest", "fit": "cover", "wrap": "x", "scrollX": 0.1, "drive": "none" },
    { "type": "image", "asset": "hero", "fit": "none", "scale": 3, "x": 0.3, "y": 0.8, "anchor": "bottom", "drive": "none" }
  ]
}
```

**Host API**:

```ts
drawSpec(ctx, dims, frame, spec, { creative, reducedFlicker, seed, assets: { forest: img1, hero: img2 } });
checkAssets(spec, { forest: bytes1, hero: bytes2 }); // → { ok, problems }
```

**Validator messages**:

| Input | Message |
| --- | --- |
| non-object `assets` | `assets dropped (not an object)` |
| a bad id, sha256 or size | `assets: <id> dropped (<reason>)` |
| 33+ entries | `assets: <id> dropped (more than 32 assets)` |
| an `image` layer naming an undeclared asset | `image dropped (asset "<id>" is not declared in assets)` |

**CLI**:
- Exit 5 means `asset <id>: missing <path>` or `asset <id>: sha256 mismatch`.
- The manifest records `"assets":{"forest":"<sha>",…}`.

**Exports**: `checkAssets`, and the `AssetImage` type.
