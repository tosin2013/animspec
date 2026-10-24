# Research: Sprite Palette Roles

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Where roles enter the render

**Decision**: `Palette` (`src/primitives/registry.ts:19`) gains an optional
`roles?: Readonly<Record<string, string>>`. `drawSpec` (`src/specInterpreter.ts:106-110`)
fills it **only** when `opts.creative` is true and the spec has a non-empty, sanitized `roles`
map, and otherwise leaves the field absent. The `draw` signature is unchanged.

**Rationale**: this mirrors how `accent` already works: the spec carries a colour, and the
interpreter decides at render time whether creative mode lets it through. Every primitive
receives the same `Palette` object, so the contract is general (FR-004). Spec 019 can add a
role without touching the call path. When `roles` is absent, no primitive can observe a
difference, so specs without `roles` render byte-identically (FR-007).

**Alternatives**:
- A separate `DrawContext.roles`. Rejected: colour belongs to the palette, and Principle III
  is phrased about the palette.
- Resolving roles inside the validator. Rejected: the validator does not know the creative
  flag.

## R2. One sanitizer shared by the validator and the interpreter

**Decision**: a pure `sanitizeRoles(raw: unknown): { roles: Record<string, string>; problems: string[] }`
is exported from `registry.ts` beside `Palette`. Its rules are:

- Names must match `/^[a-z][a-z0-9-]{0,15}$/`. Values must be hex, using the existing `isHex`
  rule (`#rgb` / `#rrggbb`).
- `bg`, `fg` and `accent` are rejected, because they shadow the built-ins.
- Entries are sorted by name, and the first 16 valid ones are kept. Order-independent
  (FR-006).
- A non-object `roles` gives an empty map and one problem.

The validator reports `problems` as `roles: <entry> dropped (<reason>)` and stores the
sanitized map, but only when it is non-empty. The interpreter calls the same function on raw
specs and ignores `problems`.

**Rationale**: this is the spec-018 pattern (`parsePattern`): one pure reader, so a raw,
unvalidated spec renders exactly like its validated form (Principle V, no exception needed).
It also matches the existing drop-and-report treatment of `accent`.

## R3. Character format v2

**Decision**: in `src/primitives/sprites.ts`, `Character` gains
`palette?: Record<string, { role: string; mono: "D" | "B" | "W" }>`. The keys are single
bitmap letters other than `.`. `role` is a built-in (`bg`, `fg`, `accent`) or a named role.

Each cell's colour is resolved as follows:

```text
legacy (no palette):  unchanged expression at registry.ts:876
v2, letter → {role, mono}:
  role ∈ {bg,fg,accent}         → p[role]
  p.roles?.[role] defined       → p.roles[role]        (creative + declared)
  otherwise                     → legacy shade colour for `mono`
                                  (D: "#3a3a3a" on black / p.fg on white; B: SHADE.B; W: SHADE.W)
```

The legacy shade expression is factored into a local `shadeColour(ch, p)` that both branches
call. The legacy branch keeps exactly the same `fillStyle` strings and calls, so its frames
cannot move.

**Rationale**:
- A v2 character in monochrome is indistinguishable in kind from a legacy one, so the ADR 0020
  quantiser path still works (spec assumption).
- Mapping a letter to `fg` or `accent` lets a character use the built-ins without inventing a
  role.

**Alternatives**:
- Per-letter hex colours in the character. Rejected: Principle III's rationale requires every
  colour to be named by a role, so a quantiser can recolour it.

## R4. Authoring checks: a pure function plus a fixture

**Decision**: `characterProblems(chars: Record<string, Character>): Problem[]` lives in
`scripts/lib/vocabularyRules.ts`, next to `tierProblems` and `replacementProblems`, and
returns the existing `Problem` shape. It checks:

1. Every frame of every pose in a character shares the walk frame's width and height (all
   characters).
2. Every row in a frame has that width (all characters).
3. v2 only: width ≤ 32 and height ≤ 48.
4. v2 only: every non-`.` letter is a palette key. The subject is the character name, and the
   detail names the pose, frame and letter.
5. v2 only: every entry's `mono` is `D`, `B` or `W`, and its `role` is a built-in or matches
   the role-name rule.

`verify-registry.ts` calls `checkNone("characters are well-formed", characterProblems(CHARACTERS))`.
It also calls one `checkCaught` per fixture in a new `scripts/fixtures/badCharacters.ts`:
an undeclared letter, a mismatched frame, an oversize v2 bitmap, and an invalid mono shade
(SC-004).

**Rationale**: this matches the gate's existing "each rule proven against a fixture that
breaks it" pattern (`verify-registry.ts:244-260`). Characters are code, so this is a registry
gate, not spec validation (FR-010).

**Check**: the legacy `mascot`, `bot` and `ghost` must already satisfy rules 1–2. The
implementation verifies this first; if any fails, it stops and reports rather than edit the
bitmap, because that would move a golden.

## R5. Palette gate extension

**Decision**:
- `paletteViolation` (`scripts/lib/gateKit.ts:295`) takes an optional `roles` on its palette
  argument. A pixel passes if it is within `PALETTE_TOLERANCE` of the bg/fg/accent segment or
  triangle (unchanged), **or** of the segment bg↔r for any role colour r.
- `runPaletteGate` (`scripts/verify-gates.ts:179`) gains one mode, `roles`. The palette has
  the probe accent red, plus a `roles` map giving every role declared by any v2 character
  (`declaredRoles()` from `sprites.ts`) a distinct probe colour (fixed, evenly spread hues).
  It covers every primitive's probe layers, both backgrounds, at the mid level only.
- The sprite `character` param gains `example: "hero"` (the spec-018 `example` mechanism).
  The existing modes therefore probe the hero in monochrome and with accents, and the new mode
  probes it with roles.

**Rationale**:
- The rule is extended, not loosened: the tolerance and the triangle are untouched, and
  without roles the check is identical (FR-013).
- Probing every primitive in the roles mode keeps the gate generic for spec 019.
- Mid level only bounds the cost (about one extra probe per layer per background). The
  implementation confirms the gate's time stays inside the 2-minute verify target.

**Hard edges**: `sprite` draws `fillRect` at rounded positions with whole-pixel scale at the
probe sizes, so role cells never blend into each other. A non-integer `scale` could blend two
adjacent role colours, but the probes use the default (12), the min (2) and the max (48). A
blend between two roles is not on a bg↔role segment, so a future failure there would be real
and must not be hidden.

## R6. Exact-colour and determinism checks

**Decision**: `verify-determinism.ts` gains hero checks:

- Creative mode with a full role map: every pixel is the background or exactly one declared
  role colour (SC-002).
- Monochrome: every pixel lies on the bg–fg grey line (SC-003).
- The hero spec renders identically twice and in a chunked order. This is already covered
  generically once the hero is a reference case.

## R7. Reference cases and showcase

**Decision**:
- `scripts/lib/goldenHashes.ts` gains `ROLE_CASES`, added through `renderCases` like
  `PATTERN_CASES`:
  - `sprite:hero-mono`: `{ layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] }` (at the default scale 12 the 20-row hero is taller than the 180 px reference frame), creative off.
  - `sprite:hero-roles`: the same, with a full 10-role `roles` map, creative on.
  - `sprite:hero-roles-partial`: three roles given, creative on (acceptance scenario 1.3).

  That is 3 cases × 3 frames = 9 per set, recorded in both `golden/arm64` and `golden/x64`,
  with `golden/CHANGES.md` rows.
- `scripts/lib/showcase.ts` gains `hero-roles` (a loop, creative) and `hero-mono` (a still),
  since `0.7.0`.

**Rationale**:
- Per-primitive `gallery/sprite.png` and `loops/sprite.gif` render the **default** sprite
  (mascot), so they do not change. The hero belongs in the showcase, which supports creative
  mode, rather than the gallery.
- `npm run golden:update` records both sets together: the native set directly, and the other
  processor type in a Docker container (`scripts/golden-update.ts`). If Docker is not
  available, the PR opens as a draft naming the missing x64 step (AGENTS.md stop rule).

## R8. Vocabulary, prompt and schema

**Decision**:
- `VOCABULARY_VERSION` **stays 13**. Implementation finding: the vocabulary record hashes
  each primitive's type, tier and param bounds (`snapshot` in `scripts/lib/vocabularyRules.ts`),
  not descriptions or param values, and `vocab:record` refuses a raised version with an
  unchanged snapshot. A new character name is a value of the existing `character` string
  param, so nothing in the snapshot changes. `npm run vocab:record` only refreshes
  `VOCABULARY.md`.
- The `sprite` description names `hero` and its roles. `buildVocabPrompt` prints
  descriptions, not param descs, so this is what a model sees (US3).
- The `character` param desc lists `hero`.
- `buildJsonSchema` adds a property `roles: { type: "object", description, propertyNames: { pattern }, additionalProperties: { type: "string", pattern: hex }, maxProperties: 16 }`.
- `verify-registry.ts` checks that the schema's `roles` exists, and that every
  `declaredRoles()` name matches its `propertyNames` pattern.

## R9. Constitution amendment

**Decision**: constitution 3.2.0 → **4.0.0**, changed in the same commit as the code:

- **Principle III** bullet 2 becomes: "`draw` MUST colour only with palette roles: `bg`, `fg`,
  `accent`, and the named roles a spec declares. Output is monochrome by default: outside
  creative mode `accent` equals `fg` and every named role resolves to its monochrome value (the
  foreground or a fixed bg–fg grey)."
- The rationale gains: "every colour is named by a role".
- **"The format"** entry (`constitution.md:175`) gains: "the optional spec-level `roles` map
  (up to 16 named colours, honoured only in creative mode)".
- **Quality Gates table**: the "Uses palette colours only" row becomes "Uses palette roles
  only (bg/fg/accent mixes, or bg mixed with a declared role)". A new row, "Built-in
  characters are well-formed (sizes, v2 letters declared)", is enforced by
  `verify-registry.ts`.
- **Amendment note**: MAJOR, because a principle's rule is redefined (the governance rule at
  `constitution.md:372`, with the same reasoning as the spec-017 MAJOR). The note states:
  contract change under Principle VII; no scope change; no new runtime dependency; the
  `Palette` and `AnimSpec` types widen; no golden render hash moves (9 cases added per set);
  `VOCABULARY_VERSION` unchanged (13).

## R10. Command-line renderer

**Finding**: `cli/render.ts:142` hard-codes `creative: false`, so the CLI cannot show roles.

**Decision**: leave it out of scope. A creative flag on the CLI is a separate request. Visual
checks use the showcase output.
