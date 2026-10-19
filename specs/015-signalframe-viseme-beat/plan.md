# Plan: SignalFrame viseme and beat

## Summary

Add optional `viseme` (0..14 mouth-shape index) and `beat` (0..1 onset strength) to the
`SignalFrame` contract, carried by an optional ASFT chunk (header flags bit 0, trailing
`frameCount × (u8 + f32)`). The codec/reader round-trip them; `viseme`/`beat` join the
spec-013 binding sources so primitives stay unchanged. Old tracks keep working; version
stays 1; absent fields ⇒ byte-identical frames. Constitution → 2.14.0 (MINOR); vocabulary
untouched.

## Approach

1. **Types** (`src/types.ts`): `SignalFrame` gains `viseme?` / `beat?`.
2. **Codec** (`src/signalframe/index.ts`): the reserved u16 becomes flags (bit 0 = chunk);
   `encode` writes the chunk (rejecting bad values), `parseHeader` accounts for the chunk
   length and exposes the flag, `decodeSignalTrack`/`readSignalFrame` read the fields.
3. **Bindings** (`src/primitives/registry.ts`): `viseme`/`beat` join the `from` grammar and
   evaluation (numeric features; absent → static fallback).
4. **Fixture + gates**: the committed sample gains a viseme/beat frame (regenerated,
   SHA-256 re-pinned); round-trip and bound-render checks.
5. **Governance**: constitution amendment + ROADMAP row in the same change.

## Gates and golden hashes

- **Touched**: `verify:signalframe` (chunk round-trip, fixture), `verify:validator` (bind
  sources), `verify:determinism` (bound render). Purity scan and package gate unchanged
  (no new export — fields ride the existing codec/reader/bind surface).
- **Golden render hashes**: **no movement** — the golden render cases carry no
  `viseme`/`beat`, and the signal-frame fixture is byte-level, not a render hash.

## Constitution Check (Principle VII)

- **Boundary change**: yes — the SignalFrame contract and the on-disk track format gain
  optional fields; the baseline's "The format" entry and gates table are amended in the
  same change (FR-008). Version 1 stays (an additive optional chunk), so Principle V's
  saved-tracks promise holds.

## Out of scope

Computing visemes/beats, mouth-shape rendering inside primitives, a typed viseme union,
forward compatibility.

## Tasks

See `tasks.md`.
