# Research: Second Tone

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Where `fg2` lives

**Decision**: export `FG2_ROLE = "fg2"`, `FG2_MONO = "#808080"` and
`PRIMITIVE_ROLES = [FG2_ROLE]` from `src/primitives/registry.ts`, next to `BUILTIN_ROLES`.
Also add one helper, `secondTone(p: Palette) => p.roles?.[FG2_ROLE] ?? FG2_MONO`.

**Rationale**:
- Spec 020's interpreter already fills `Palette.roles` only in creative mode with a
  sanitized map, and `fg2` passes `ROLE_NAME`. So "creative and given → colour, else grey"
  falls out of one lookup (FR-002). No validator, schema or interpreter change is needed.
- `PRIMITIVE_ROLES` is the list of roles that primitives (not characters) read. The palette
  gate and the registry gate take it alongside `declaredRoles()`, so `fg2` is probed and
  its name is checked against the schema pattern (FR-008).

**Alternatives**:
- A top-level `accent2`. Rejected by the maintainer (2026-10-23): it would be a second
  format change, and roles already cover it.

## R2. The mid grey

**Decision**: `#808080`, used on both backgrounds.

**Rationale**:
- It is an even bg–fg mix, which Principle III (4.0.0) allows as a monochrome value. It
  lies on the bg–fg segment, so the palette gate's existing monochrome rule accepts it
  unchanged.
- Under a transparent background it lifts to fg at alpha 128/255 (light ink) or bg at alpha
  127/255 (dark ink). Over its source background that composites back to `#808080`, as
  spec 017 requires.

## R3. Parsing and drawing `b`

**Decision**:
- **`parsePattern`** (`registry.ts:106`): accept `b` as a cell letter and drop the
  `reserved` branch and its problem message. The doc comment changes to match.
- **`grid` `paint`** (line ~249): `b` → `{ style: secondTone(p), alpha: 1 }`.
- **`checker` `paint`** (line ~370): `b` → `secondTone(p)`.

Solid fills, broken-cell scanline fills and the transparent lift already take
`cell.style` from `paint`, so `b` inherits every one of them (FR-004).

**Byte-identity**:
- A pattern without `b` produces the same `cells` strings as before.
- Before this change, `b` became `.` in `cells`. The only behaviour change is for patterns
  containing `b`, and no reference case has one (FR-005).

## R4. Checks and references

- **Validator gate** (`verify-spec-validator.ts:208`): the check "the reserved letter b is
  reported" becomes "a pattern with b reports nothing". This follows the spec (FR-006): the
  rule it pinned is the one this feature retires. It is not a weakened gate.
- **Determinism gate**, a block after the quilt checks:
  - (a) Creative mode with `fg2`: in a solid two-tone quilt, `b` cells are exactly `fg2`,
    `#` cells exactly fg, `a` cells exactly accent.
  - (b) Monochrome: `b` cells are exactly `#808080`.
  - (c) Creative mode without `fg2`: `b` cells are `#808080`.
  - (d) A solid two-tone pattern, with a break, has only {bg, fg, accent, second tone}.
  - (e) `b` cells ignore the signal.
  - (f) Checker `b` squares tile.
  - (g) Chunked render equals whole.
- **Examples**: grid `pattern.example` becomes `"##.a.##/#b...b#/..###../#b...b#/##.a.##"`
  and checker's becomes `"#a/~b"`. The gates (palette, including the roles mode, and
  budget) then probe `b`. Examples are not part of the vocabulary snapshot.
- **References**: three new `PATTERN_CASES`, 9 per set, via `golden:update`:
  - `grid:pattern-two-tone` (monochrome).
  - `grid:pattern-two-tone-fg2` (creative, solid, accent plus `fg2`).
  - `checker:pattern-two-tone` (creative, `fg2`).
- **Showcase**: `two-tone-quilt` (a creative still).

## R5. Constitution

**Planned**: no amendment.

**Found during implementation**: the first verify run failed in the palette gate's roles
mode. On the non-solid grid, a `b` cell's anti-aliased corner pixel (46, 37) also takes the
faint foreground gridline, so it mixes background, foreground and `fg2`. Spec 020's gate rule
accepted a role only mixed with the background, a segment, so it rejected that correct pixel.
The accent never hits this, because its rule is the bg/fg/accent triangle.

**Decision** (maintainer, 2026-10-23): treat each role like the accent. A pixel may be a mix
of background, foreground and one role (`paletteViolation` uses `closestOnTriangle(bg, fg, role)`
in place of the segment), and the tolerance is unchanged.

This is a MINOR amendment (4.1.0): the Quality Gates palette row is restated. Principle III's
text already names roles and is unchanged. The alternative, snapping `b` cells to whole pixels,
was rejected: it would misalign `b` with `#` and `a`, and leave the gap for the next
anti-aliased role.
