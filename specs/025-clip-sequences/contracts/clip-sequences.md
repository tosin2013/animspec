# Contract: Clip Sequences

```jsonc
{
  "background": "black",
  "sequence": [
    { "from": 0,   "to": 90,  "layers": [{ "type": "chapter-card" }] },
    { "from": 90,  "to": 240, "layers": [{ "type": "grid" }, { "type": "wave" }],
      "transition": { "type": "wipe", "frames": 15, "direction": "left" } },
    { "from": 240, "to": 330, "layers": [{ "type": "sprite", "character": "hero" }],
      "camera": { "move": "push", "from": { "frame": 0, "zoom": 1, "x": 0.5, "y": 0.5 }, "to": { "frame": 89, "zoom": 1.3, "x": 0.5, "y": 0.6 } },
      "transition": { "type": "iris", "frames": 20 } },
    { "from": 330, "to": 390, "layers": [{ "type": "text" }], "transition": { "type": "fade", "frames": 30 } }
  ]
}
```

**Semantics**:
- **Each clip** animates from its own frame 0. Signal fields are the absolute frame's, and
  the frame rate is assumed constant.
- **A transition** plays over the incoming clip's first `frames` frames. The outgoing clip
  keeps playing under it.
- **wipe and iris**: each pixel is from one clip. **fade**: a per-pixel mix. Both happen
  inside animspec's render; they are not a filter on a finished frame.
- **Gaps** show the background.

**Validator messages** (prefixed `sequence[i]:`):

| Input | Message |
| --- | --- |
| overlapping or out of order | `sequence[i]: dropped (overlaps or is out of order)` |
| bad range | `sequence[i]: dropped (from and to must be integers with 0 ≤ from < to)` |
| no valid layers | `sequence[i]: dropped (no valid layers)` |
| a transition on the first clip | `sequence[i]: transition ignored (first clip)` |
| a transition that is too long | `sequence[i]: transition frames clamped to <n>` |
| more than 64 clips | `sequence: only the first 64 clips are used` |
| top-level layers or camera beside a sequence | `layers ignored (the spec has a sequence)` / `camera ignored (the spec has a sequence)` |

**CLI manifest**: `"clips": <n>`.
