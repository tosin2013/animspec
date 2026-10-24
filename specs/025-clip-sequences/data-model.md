# Data Model: Clip Sequences

## `AnimSpec.sequence`

An array of at most 64 clips, ordered and non-overlapping.

| Field | Type | Rule |
| --- | --- | --- |
| from | integer ≥ 0 | first frame (inclusive) |
| to | integer > from | end (exclusive) |
| layers | layer[] (≤ 12) | the same rules as top-level layers; a clip with no valid layer is dropped |
| camera | CameraSpec? | keyframes relative to the clip's first frame |
| transition | { type, frames?, direction? }? | type `cut`, `wipe`, `iris` or `fade`; frames 1..600 (not for cut), clamped to the clip length; direction `left`, `right`, `up` or `down` (wipe, default `right`) |

## Render-time derived values

- **Active clip**: the clip containing the frame index, else none (background).
- **Clip frame**: `index − from`. Clip time is `t·(index − from)/index` (0 at the clip start).
- **Transition progress**: `p = (index − from + 1)/(frames + 1)` over the first `frames`
  frames of the incoming clip.
- **Clip seed**: `mixSeed(seed, 0x51 + clipIndex)`.
