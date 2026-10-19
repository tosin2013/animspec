# Plan: Per-layer signal bindings

## Summary

Add an optional per-layer `bind` map to the AnimSpec format: `{ from, in?, out?, curve?,
wave?, period?, duty? }` drives any declared **numeric** param from a SignalFrame feature
(`amplitude`, `energy`, `band:<n>`) or from a seeded oscillator of `t` (`osc`, pulse or
sine). Evaluated per frame in the interpreter before the primitive's draw, clamped to the
registry bounds; malformed binds are dropped and reported; specs without `bind` render
byte-identically. `VOCABULARY_VERSION` is untouched (a format change, not a vocabulary
change); the constitution baseline is amended (MINOR) in the same change.

## Approach

1. **Registry** (`src/primitives/registry.ts` — the params/bounds owner, Principle II):
   - `sanitizeBind(def, raw)` — validates a raw bind against the primitive's declared
     numeric params and the `from`/mapping grammar; returns `{ bind }` or `{ error }`.
   - `sanitizeLayer` preserves a valid bind, drops a malformed one (layer survives).
   - `applyBindings(layer, def, frame, seed, layerIndex)` — returns a per-frame view of
     the layer with driven values overridden (a shallow copy; the sanitized spec is never
     mutated), values clamped to registry bounds; static values are the fallback when a
     bind cannot evaluate (`band:<n>` past the band count).
   - `buildJsonSchema` gains the `bind` shape on layer items (generic shape; per-key
     param enforcement stays in the validator).
2. **Interpreter** (`src/specInterpreter.ts`): `drawSpec` calls `applyBindings` per layer
   (the only change there); everything downstream is unchanged.
3. **Validator** (`src/specValidator.ts`): collects bind errors per layer via
   `sanitizeBind` and reports them in `errors` (same voice as today).
4. **Gates**: bind rejection + preservation cases join `verify-spec-validator.ts`; a
   bound-render determinism section joins `verify-determinism.ts` (a bound `rig` differs
   quiet vs loud; chunk-vs-whole byte equality with binds active).
5. **Governance**: constitution amendment (format entry + gates row + version MINOR) in
   the same change.

## Gates and golden hashes

- **Touched**: `verify:validator` gains bind cases; `verify:determinism` gains the
  bound-spec determinism check; `verify:package` sees no new exports (bindings are
  evaluated inside `drawSpec`/`sanitizeLayer` — no new public function). The purity scan
  is untouched and green.
- **Golden render hashes**: **no movement**. Specs without `bind` take the identical
  code path (the evaluation is a no-op without a bind map), and the golden cases carry no
  binds.

## Constitution Check (Principle VII)

- **Boundary change**: yes — the AnimSpec contract gains an optional per-layer field (a
  new promise: numeric params can be signal-driven from the spec). The baseline's "The
  format" entry and the Quality Gates table are amended in the same change that ships it
  (FR-011). Principle V holds: bind-free specs render byte-identically, and bindings are
  part of the saved contract.
- **Principles**: I (pure per-frame evaluation; chunk equality gated), II (bind keys and
  clamps from registry declarations), IV (malformed binds dropped and reported; layers
  never dropped over binds), VI (checks inside the one offline verify), VII (this spec).

## Out of scope

`label:<n>` sources (deferred), smoothing/state across frames, binding enum/boolean/
string params, primitive draw changes, bind-editing UI.

## Tasks

See `tasks.md`.
