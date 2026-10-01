# Data Model: Reference Frames Match on Every Machine

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Processor type

| Value | Meaning |
| --- | --- |
| `arm64` | supported; has a reference set |
| `x64` | supported; has a reference set |
| anything else | unsupported; the exact comparison is not made and is not reported as passed |
| any processor on Windows | unsupported, the same way |

Taken from the running process. Among supported systems (macOS and Linux) the operating
system is not part of it. Windows is not supported at all.

## Reference set (persisted)

One per supported processor type, under `golden/<type>/`.

| Part | Path | Content |
| --- | --- | --- |
| hashes | `golden/<type>/hashes.json` | case key to SHA-256 of raw RGBA; the exact authority |
| frames | `golden/<type>/frames/<case>.png` | the same frames as lossless images; used by the other type's tolerance check |

**Rules**:

- Both sets contain exactly the same case keys.
- For every case, the stored frame decodes to pixels whose hash equals the stored hash.
- Sets are replaced together or not at all.
- A frame file is rewritten only when its decoded pixels change.
- File names are the case key with characters outside `a-z 0-9 @ + -` replaced by `_`.

## Reference case

| Kind | Key | What it renders |
| --- | --- | --- |
| primitive | `<primitive>@<level>` | the primitive's validated default layer, default font |
| composite | `composite:<name>@<level>` | a fixed multi-layer spec |
| maximum-layer | `composite:layers12-dark@<level>`, `composite:layers12-light@<level>` | twelve layers of the primitives that differ most across types |
| per-font text | `font:<key>:<primitive>@<level>` | each text primitive in each non-default font |
| missing characters | `text:missing-glyphs@<level>` | a label with characters the default font lacks |
| carried from 001 | `icon:*`, `flash:full@*` | unchanged |

`<level>` is quiet, mid or loud, as today.

## Cross-type comparison

| Field | Meaning |
| --- | --- |
| `case` | the reference case |
| `maxDelta` | largest absolute difference in any colour channel of any pixel |
| `pixels` | number of pixels that differ at all |

**Rule**: fails when `maxDelta` is greater than 8. The largest `maxDelta` over all cases is
always reported.

## Shipped font

| Field | Meaning |
| --- | --- |
| `key` | short name a spec uses: `dejavu`, `jetbrains`, `plex` |
| `family` | the family name the font is registered under, unique to this library: `specfont-<key>` |
| `label` | human-readable name |
| `licence` | licence identifier, also listed in `NOTICE` |
| data | the font bytes, base64, in a generated module |

**Rules**:

- Exactly one font is the default: `dejavu`.
- Every font is registered once, when the library loads, from memory.
- Each generated data module matches its `.ttf` file under `assets/fonts/`; a freshness check
  enforces it.
- `assets/fonts/README.md` records each file's source, version and SHA-256.

## Font choice (part of the spec format)

| Field | Type | Rule |
| --- | --- | --- |
| `font` | optional string | one of the shipped font keys; when absent, the default |

**Validation**: a known key is kept. Anything else is removed, the default applies, and the
validation result's errors include `font dropped (not a shipped font)`. The spec stays valid.

**Rendering**: the interpreter resolves the key to a family name and passes it in the draw
context. If an unvalidated spec carries an unknown key, the default is used.

## Draw context (changed)

| Field | Status |
| --- | --- |
| `reducedFlicker` | unchanged |
| `seed` | unchanged |
| `text` | unchanged |
| `font` | new: the resolved font family for this spec |

Text primitives build their font string as size plus the context's `font`, and never name a
family themselves.

## Change log for reference frames (persisted, from 001)

`golden/CHANGES.md` gains a `set` column: `arm64`, `x64` or `both`.
