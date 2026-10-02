# Data Model: Vocabulary Version and Tiers

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Vocabulary version

| Property | Value |
| --- | --- |
| Type | whole number |
| First value | 1, the vocabulary as it stands when this feature ships |
| Current value | `VOCABULARY_VERSION`, declared in the registry |
| Rises by one when | a primitive is added; a param or allowed value is added, removed or changed; a primitive changes tier or replacement |
| Does not rise when | a description or category changes; a primitive's drawing changes with no change to its declaration |

## Spec (changed)

| Field | Before | After |
| --- | --- | --- |
| `background`, `accent`, `font`, `layers` | as today | unchanged |
| `vocabulary` | absent | optional on input; always present after validation |

**Rules**:

- After validation, `vocabulary` is an integer from 1 to the library's current version.
- A valid `vocabulary` on input is never changed by validation.
- `vocabulary` has no effect on what is drawn.

## Primitive (changed)

| Field | Before | After |
| --- | --- | --- |
| `type`, `category`, `description`, `params`, `draw` | as today | unchanged |
| `tier` | absent | required: `core`, `extended`, `contrib` or `legacy` |
| `replacedBy` | absent | the replacement's type; required when `tier` is `legacy`, absent otherwise |

**Rules**:

- Exactly one tier per primitive.
- A legacy primitive's `replacedBy` names an existing primitive. Following `replacedBy`
  repeatedly ends at a primitive that is not legacy, without visiting any primitive twice.
- A primitive of any tier is validated, drawn, and covered by reference frames.

### Initial tiers

| Tier | Primitives |
| --- | --- |
| core (24) | `grid`, `barcode`, `checker`, `bars`, `hbars`, `radial`, `wave`, `lissajous`, `particles`, `orbits`, `dots`, `shape`, `rings`, `spiral`, `scan`, `flash`, `sweep`, `noise`, `caption`, `rain`, `text`, `crosshair`, `led`, `mesh3d` |
| extended (5) | `sprite`, `tetris` (kit `arcade`); `plasma`, `gridhorizon`, `tunnel` (kit `retro`) |
| contrib (0) | none |
| legacy (0) | none |

### Tier transitions

```text
contrib ──► extended ──► core
   │            │          │
   └────────────┴──────────┴──► legacy   (when replaced; names its replacement)
```

- Any move between tiers raises the vocabulary version.
- Legacy is final. A legacy primitive leaves the registry only by removal, which is out of
  scope here.
- Which tier a primitive enters, and when it moves, is decided by the style review.

## Kit (unchanged shape, new rules)

A named list of primitive types, kept in the selector.

**Rules**:

- Every type a kit lists exists.
- A kit lists only core and extended primitives.
- Every extended primitive is listed by at least one kit.

## Selection

| Input | Meaning |
| --- | --- |
| kit | a kit name, `auto`, or none |
| breadth | 0 to 1; how far to widen beyond the kit, or how many to sample |
| seed | fixes every random choice |
| named | optional list of primitive types the caller asks for in addition |

| Output | Meaning |
| --- | --- |
| primitives | the bounded, ordered set offered to a model |
| refused | each named type that was not offered, with the reason |

**Rules**: see [contracts/tiers-and-selection.md](contracts/tiers-and-selection.md).

## Vocabulary record (persisted)

`golden/vocabulary.json`

| Part | Content |
| --- | --- |
| `versions` | one entry per version from 1 to current: `version`, `hash` of the snapshot at that version, `summary` |
| `current` | the full snapshot for the current version |

**Snapshot**: for each primitive, in registry order: `type`, `tier`, `replacedBy`, and each
param's declaration (type, bounds, default, allowed values). Descriptions, categories and
draw functions are left out.

**Rules**:

- Entries are numbered 1 to current with no gaps.
- The hash of `current` equals the hash in the last entry.
- The snapshot derived from the registry equals `current`.
- An entry, once written, is not rewritten.

## Vocabulary document (generated)

`VOCABULARY.md`: the current version, the version history, and one row per primitive with
its category, tier, replacement and description. Generated from the registry and the
record; committed; checked for freshness by the registry gate.
