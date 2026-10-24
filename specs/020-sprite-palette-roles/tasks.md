---

description: "Task list for sprite palette roles"
---

# Tasks: Sprite Palette Roles

**Input**: Design documents from `/specs/020-sprite-palette-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/palette-roles.md, quickstart.md

**Tests**: No separate test suite. The checks live in the existing registry, validator,
determinism and vetting gates, and in new reference cases.

**Organization**: By user story in priority order: US1 colour by role (#103 core), US2
authoring checks, US3 model-readable contract.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 roles, US2 checks, US3 models
- Paths are relative to the repository root. Run commands from there.

**Standing rules**:
- No existing key in `golden/arm64/hashes.json` or `golden/x64/hashes.json` may change value.
  A changed hash is a defect in the task, never a `golden/CHANGES.md` row.
- Never change a gate threshold, tolerance or reference to make verify pass.
- At most 3 failed `npm run verify` attempts, then stop and report.
- No code is copied from issue #103.

---

## Phase 1: Setup

- [X] T001 Confirm the starting point:
  - Branch `feature/020-sprite-palette-roles` is based on `main` at `f387c73`.
  - `.specify/feature.json` points at `specs/020-sprite-palette-roles`.
  - `npm run verify` passes.
  - `git status --short golden/ src/ scripts/` is empty.
  - `docker info` works (needed by `golden:update` for the x64 set).

---

## Phase 2: Foundational

**Purpose**: The roles contract every story uses. No primitive reads it yet, so nothing
renders differently.

- [X] T002 In `src/primitives/registry.ts`, next to `interface Palette` (line ~19):
  - Add `roles?: Readonly<Record<string, string>>` with the comment "named palette roles (spec 020); present only in creative mode".
  - Add the exported constants `BUILTIN_ROLES = ["bg", "fg", "accent"] as const` and `ROLE_NAME = /^[a-z][a-z0-9-]{0,15}$/`.
  - Add the exported pure function `sanitizeRoles(raw: unknown): { roles: Record<string, string>; problems: string[] }`. Its rules:
    - A non-object, an array or `null` gives `{}` and the problem `"roles dropped (not an object)"`.
    - Iterate the keys **sorted by name**.
    - Drop each name failing `ROLE_NAME` (`"roles: <name> dropped (invalid name)"`).
    - Drop each name in `BUILTIN_ROLES` (`"roles: <name> dropped (shadows a built-in role)"`).
    - Drop each value that is not `#rgb`/`#rrggbb`, matching `/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/` (`"roles: <name> dropped (not a valid hex color)"`).
    - After 16 kept entries, drop the rest (`"roles: <name> dropped (more than 16 roles)"`).
- [X] T003 [P] Export `sanitizeRoles` from `src/index.ts` (`Palette` is already exported, line 16).
- [X] T004 In `src/specInterpreter.ts`:
  - Add `roles?: Record<string, string>` to `AnimSpec`, with a doc comment: "Spec 020: named palette role colours, honoured only in creative mode".
  - In `drawSpec` (line ~109-110), build the palette as follows: `const roles = opts.creative && spec.roles !== undefined ? sanitizeRoles(spec.roles).roles : {}`, then `const palette: Palette = Object.keys(roles).length ? { bg, fg, accent, roles } : { bg, fg, accent }`.
  - Import `sanitizeRoles` from the registry.
- [X] T005 [P] In `src/specValidator.ts` `validateAnimSpec`, after the `accent` handling (line ~97):
  - When `obj.roles !== undefined`, call `sanitizeRoles(obj.roles)`.
  - Push every problem to `errors`.
  - Keep `roles` only if non-empty.
  - Add `...(roles ? { roles } : {})` to the returned spec, after `accent` (line ~160).
- [X] T006 [P] In `src/primitives/registry.ts` `buildJsonSchema` (line ~2220), add after `accent`: `roles: { type: "object", description: "named colours for palette roles (e.g. a sprite character's hair, skin, cloak); used only in creative mode", propertyNames: { pattern: "^[a-z][a-z0-9-]{0,15}$" }, additionalProperties: { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" }, maxProperties: 16 }`.
- [X] T007 Run `npm run check && npm run verify:registry && npm run verify:determinism`. Every existing hash must be unchanged, because no primitive reads `roles` yet.

**Checkpoint**: The roles contract exists and every frame is unchanged.

---

## Phase 3: User Story 1 - Colour a character by role (Priority: P1) 🎯 MVP

**Goal**: The `hero` draws each letter in its role colour in creative mode, and in the legacy
greys otherwise. Legacy characters are byte-identical.

**Independent Test**: Render `{ roles: <10 roles>, layers: [{ type: "sprite", character: "hero", motion: "static" }] }`:
- With creative on, every non-background pixel is exactly one declared role colour.
- With creative off, every pixel is on the bg–fg grey line.

- [X] T008 [US1] In `src/primitives/sprites.ts`:
  - Add to `Character`: `palette?: Record<string, { role: string; mono: "D" | "B" | "W" }>`. Its doc comment: "sprite format v2 (spec 020): each bitmap letter's palette role and the legacy shade it falls back to outside creative mode; letters must all be declared; at most 32 wide × 48 tall".
  - Update the file header comment to describe v2.
- [X] T009 [US1] In `src/primitives/sprites.ts`, author `hero`, a v2 character written fresh from #103's description:
  - About 16 wide × 20 tall.
  - A two-frame `walk` with a leg cycle, and a two-frame `idle` (blink).
  - The palette, exactly per data-model.md: `O outline D`, `H hair B`, `h hair-light W`, `S skin W`, `E eyes D`, `G gold W`, `C cloak B`, `c cloak-shade D`, `T tunic B`, `K boots D`.
  - Every frame the same width and height, and every row the same length.
  - Export `declaredRoles(): string[]`: the sorted, de-duplicated named roles across all `CHARACTERS` palettes, excluding `bg`, `fg` and `accent`.
- [X] T010 [US1] In `src/primitives/registry.ts`, the sprite `draw` blit (line ~868-879):
  - Factor the legacy colour expression into a local `const shadeColour = (ch: string) => ch === "D" ? (p.bg === "black" ? "#3a3a3a" : p.fg) : SHADE[ch] ?? p.fg;`, keeping the strings exactly.
  - When `poses.palette` is undefined, `fillStyle = shadeColour(ch)`. This is the same as today.
  - Otherwise, look up `const e = poses.palette[ch]`, then pick the colour:
    - `e.role` is `bg`, `fg` or `accent`: use `p[e.role]`.
    - else, when `p.roles?.[e.role]` is set: use `p.roles[e.role]`.
    - else: use `shadeColour(e.mono)`.
  - The icon-fallback path is unchanged.
- [X] T011 [US1] In `src/primitives/registry.ts`, the sprite entry (line ~797):
  - Set the `character` param `desc` to "built-in multi-pose character: mascot, bot, ghost, hero (v2, coloured by `roles` in creative mode). Falls back to `icon`, then mascot", and add `example: "hero"`.
  - Extend `description` with: "; `hero` is a 16-bit-era character whose parts (outline, hair, hair-light, skin, eyes, gold, cloak, cloak-shade, tunic, boots) take colours from the spec's `roles` in creative mode".
  - ~~Bump `VOCABULARY_VERSION` from 13 to 14.~~ Dropped during implementation: `vocab:record` refuses a bump because the snapshot (types, tiers, params) is unchanged (research.md R8). The version stays 13.
  - Run `npm run vocab:record` (no summary needed at an unchanged version), which refreshes `VOCABULARY.md`.
- [X] T012 [P] [US1] In `scripts/lib/gateKit.ts` `paletteViolation` (line ~295):
  - Widen the palette argument to `{ bg; fg; accent; roles?: Readonly<Record<string,string>> }`.
  - A pixel passes if it is within `PALETTE_TOLERANCE` of today's segment or triangle (unchanged code), **or** of `closestOnSegment(p, bg, rgbOf(role))` for any role colour.
  - Do not change `PALETTE_TOLERANCE`. Without `roles` the function behaves identically.
- [X] T013 [US1] In `scripts/verify-gates.ts` `runPaletteGate` (line ~179), add a `roles` mode:
  - Build `rolesProbe` by mapping each name in `declaredRoles()` to a fixed, evenly spread probe hue (a deterministic list, e.g. HSL hue `i*360/n` at full saturation, rendered to hex).
  - Palette: `{ ...paletteFor(background, "#ff0000"), roles: rolesProbe }`.
  - Render every primitive's `probeLayers(def)` at the mid level only, on both backgrounds, and check them with `paletteViolation`.
  - Report under the same gate name, with mode label "roles".
  - Update the gate's doc comment (line ~167).
- [X] T014 [US1] In `scripts/verify-determinism.ts`, add hero checks (follow the existing quilt pixel checks):
  - (a) Creative on with a full 10-role map: every pixel equals the background or exactly one declared role colour.
  - (b) Creative off: every pixel has r = g = b (the bg–fg grey line), on black and on white.
  - (c) The same spec rendered twice is byte-identical.
- [X] T015 [US1] In `scripts/lib/goldenHashes.ts`, add `ROLE_CASES`, rendered in `renderCases` like `PATTERN_CASES`:
  - `sprite:hero-mono`: creative false, `{ layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] }` (scale 6 and y 0.55 so the 20-row hero fits the 320 × 180 reference frame).
  - `sprite:hero-roles`: creative true, the same plus a full 10-role `roles` map.
  - `sprite:hero-roles-partial`: creative true, `roles` with only `hair`, `skin`, `cloak`.
- [X] T016 [US1] Run `npm run golden:update`, which writes both sets (x64 via Docker). Then confirm with `git diff golden/arm64/hashes.json golden/x64/hashes.json` that only the 9 new `sprite:hero-*@*` keys per set are added and no value changed. If Docker fails, stop: record arm64 only and mark the PR draft naming the missing x64 step.
- [X] T017 [US1] Add three rows to `golden/CHANGES.md` (date 2026-10-23, primitive `sprite`, spec `020`, set `both`):
  - `sprite:hero-mono@*` (3 added): "the v2 hero in monochrome falls back to the legacy greys; vocabulary unchanged".
  - `sprite:hero-roles@*` (3 added): "the hero with a full roles map in creative mode: every cell its role colour (#103)".
  - `sprite:hero-roles-partial@*` (3 added): "three roles given; the rest fall back to their greys".

**Checkpoint**: The hero renders in colour and in monochrome, and all old frames are unchanged.

---

## Phase 4: User Story 2 - Author larger, safer characters (Priority: P2)

**Goal**: Verify rejects malformed characters, and each rule is proven by a fixture.

**Independent Test**: `npm run verify:registry` prints `PASS characters are well-formed` and four `PASS character rule catches ...` lines.

- [X] T018 [P] [US2] In `scripts/lib/vocabularyRules.ts`, add `characterProblems(chars: Record<string, Character>): Problem[]` (the existing `Problem` shape, with the character name as the subject). It checks:
  - (1) Every frame of `walk`, `idle` and `jump` matches the walk frame 0's height and width, and every row has that width (all characters).
  - (2) v2 only: width ≤ 32 and height ≤ 48.
  - (3) v2 only: every non-`.` letter is a palette key. The detail names the pose, frame index and letter.
  - (4) v2 only: each entry's `mono` ∈ {D, B, W}, and its `role` ∈ {bg, fg, accent} or matches `ROLE_NAME`.
- [X] T019 [P] [US2] Create `scripts/fixtures/badCharacters.ts` exporting `BAD_CHARACTERS: Array<{ name; chars: Record<string, Character>; subject }>` with four fixtures:
  - `undeclared-letter`: a v2 bitmap using `X`, which is not in its palette.
  - `mismatched-frame`: a walk frame 2 that is one row shorter.
  - `oversize-v2`: 33 columns wide.
  - `bad-mono`: a palette entry with `mono: "Q"`.
- [X] T020 [US2] In `scripts/verify-registry.ts`, after the replacement checks (line ~260):
  - `checkNone("characters are well-formed", characterProblems(CHARACTERS))`.
  - For each `BAD_CHARACTERS` fixture, `checkCaught(\`character rule catches "${f.name}"\`, characterProblems(f.chars), f.subject)`.
  - If a legacy character fails rule 1, **stop and report**. Never edit a legacy bitmap.

**Checkpoint**: Authoring errors fail verify with named offenders.

---

## Phase 5: User Story 3 - Model-readable contract (Priority: P3)

**Goal**: Models can find `hero`, its roles and the `roles` map.

**Independent Test**:
- The vocab prompt for a selection with `sprite` contains `hero` and its role names.
- The schema has `roles`.
- A creative spec using `hero` and `roles` validates with no errors.

- [X] T021 [US3] In `scripts/verify-registry.ts`, near the schema checks (line ~97), add:
  - `check("json schema describes roles", "roles" in schema.properties)`.
  - `check("every declared role name fits the schema's role-name pattern", declaredRoles().every((r) => new RegExp(schema.properties.roles.propertyNames.pattern).test(r)))`.
  - `check("vocab prompt names hero and its roles", vocab.includes("hero") && declaredRoles().every((r) => vocab.includes(r)))`.
- [X] T022 [P] [US3] In `scripts/verify-spec-validator.ts`, add the five contract cases from `contracts/palette-roles.md`:
  - Not an object.
  - Invalid name.
  - Invalid hex.
  - A shadowed built-in.
  - 17 entries (assert that the first 16 by sorted name are kept and one message is reported).

  Also add:
  - Key order does not change the result.
  - A clean 10-role spec yields no errors, and keeps `roles` intact.
  - A raw spec and its validated form render identically, in creative mode, through `drawSpec`.

**Checkpoint**: The contract is discoverable and validated.

---

## Phase 6: Polish & Cross-Cutting

- [X] T023 Amend `.specify/memory/constitution.md` per research.md R9:
  - Principle III bullet 2 and its rationale.
  - "The format" entry (line ~175): add `roles`.
  - Quality Gates table:
    - Change the palette row to "Uses palette roles only (bg/fg/accent mixes, or bg mixed with a declared role)".
    - Add the row "Built-in characters are well-formed (sizes, v2 letters declared) | Enforced (`verify-registry.ts`)".
  - Append the amendment note (spec 020, MAJOR, the reasons listed in R9).
  - Set the version line to `4.0.0`, Last Amended 2026-10-23.
- [X] T024 [P] In `scripts/lib/showcase.ts`, add two entries since `0.7.0`:
  - `hero-roles`: a loop, creative, with a full roles map and `motion: "walk"`.
  - `hero-mono`: a still, `motion: "static"`.

  Then run `npm run showcase:generate` and `npm run site:generate`.
- [X] T025 [P] Add a "Palette roles and v2 characters" section to `docs/user-guide.md`. Cover the `roles` map, creative-only behaviour, the monochrome fallback, and `hero`. Add an Unreleased entry to `CHANGELOG.md`.
- [X] T026 [P] Update `specs/ROADMAP.md`:
  - Add a 020 row (Sprite palette roles, #103, 0.7.0, In progress).
  - Change the "Palette roles" blocked row (line ~146) to say spec 020 carries the Principle III amendment and 019 reuses it.
- [X] T027 Run `npm run verify`, at most 3 failed attempts, never editing a gate or threshold. Then run the quickstart.md checks (steps 2–4). View `showcase/hero-roles.gif` and `showcase/hero-mono.png`.
- [X] T028 Check `.github/workflows/` and `scripts/agent-pr-guard.ts` to confirm the boundary guard only applies to agent primitive PRs. Then commit, push, and open the PR to `main`, titled "feat(sprite): palette roles and sprite format v2 (spec 020)". Comment on #103 linking the PR and spec.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T002 before T003–T006; T007 closes it) → the user stories.
- **US1**:
  - T008 → T009 → T010 → T011.
  - T012 can run in parallel with T008–T011.
  - T013 needs T009 and T012.
  - T014 and T015 need T010 and T011.
  - T016 needs T015, and T017 needs T016.
- **US2**: needs only Phase 2 and T008 (the `Character.palette` type). T018 and T019 can run in parallel, then T020. It can run alongside US1 after T008.
- **US3**: T021 needs T009 and T011. T022 needs Phase 2 only.
- **Polish**: T023–T026 can run in parallel once US1–US3 are done. Then T027, then T028.

## Parallel Examples

- After T002: T003, T005 and T006 (different files).
- During US1: T012 (`gateKit.ts`) alongside T008–T011 (`sprites.ts`/`registry.ts`).
- After T008: T018 and T019 (US2) alongside the rest of US1.
- Polish: T024, T025 and T026 together.

## Implementation Strategy

- **MVP**: Phases 1–3 (US1). The hero renders in colour, the gates hold, and the goldens are
  recorded. The amendment (T023) must ship in the same PR as US1, because Principle III is
  violated without it.
- **Incremental**: then US2 (authoring safety), then US3 (model contract), then polish.
- One PR for the whole spec, as with 013–018.
