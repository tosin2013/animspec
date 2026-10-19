# Research: Per-layer signal bindings

## R1. Bindings evaluate in the interpreter, from the sanitized spec

The interpreter (`drawSpec`) is the only place that sees `(sanitized spec, frame, seed)`
together. Sanitize time has no frame; draw time has no validator.

**Decision**: `drawSpec` applies binds per layer just before the primitive's draw, via a
registry-owned `applyBindings`. The sanitized spec is never mutated — each layer gets a
shallow per-frame view (a ~10-key copy), so no state crosses frames.

## R2. The registry owns bind validation and clamping

Bind keys must be declared numeric params and driven values must land inside registry
bounds — both live in the registry (Principle II: one source of truth). A second
hand-maintained table of bindable params would drift.

**Decision**: `sanitizeBind(def, raw)` and `applyBindings(...)` live in
`src/primitives/registry.ts`. `sanitizeLayer` uses the first (silent drop of malformed
binds); `validateAnimSpec` uses the same helper to report drops as errors — one
implementation, two consumers.

## R3. Stacking: override the static value, document the interaction

A binding replaces the static param value per frame. A primitive's *internal* signal read
for the same quantity (`rig` with `drive: "amplitude"`, `emitter`'s energy density) still
applies on top — the validator cannot police it in general without a hand-maintained
exceptions table, and the issue's own determinism clause ("no smoothing state") keeps the
model stateless either way.

**Decision**: override + document (maintainer's clarified choice). The schema description
and vocabulary text carry the caveat.

## R4. The spawn of `osc`: both waveforms, seeded phase

The issue's example (`period: 4.2, duty: 0.05, out: [1, 0]`) is a blink clock; a sine
covers smooth idle motion.

**Decision**: `wave: "pulse" | "sine"` (default pulse). Pulse: `out[0]`, flipping to
`out[1]` for `duty` of each `period` seconds. Sine: `out[0] + (out[1] − out[0]) ×
(0.5 + 0.5 × sin(2πt/period + phase))`. Phase = `mulberry32(mixSeed(seed,
hash(layerIndex, paramName)))() × τ` — deterministic per render, distinct across layers
and params. `duty` is ignored by sine.

## R5. `label:<n>` deferred

SignalFrame labels are strings (provenance/text). A numeric-label channel would need its
own contract (a typed array or a parsing convention), which is scope the v1 doesn't need —
the `.asft` track is the data path for real signals.

**Decision**: v1 `from` = `amplitude | energy | band:<n> | osc`. A future version can add
`label:<n>` (or a numeric frame field) without breaking anything: unknown sources are
dropped binds, and dropped binds are already a first-class reported outcome.

## R6. Malformed binds drop; layers never do

Today an invalid param value is clamped or defaulted, and an unknown layer type is
dropped and reported. A malformed bind sits between those: the layer is fine without it.

**Decision**: a malformed bind is dropped (the layer keeps static params) and
`validateAnimSpec` reports it as an error string — the same voice as every other
rejection. A layer is never dropped because its bind was malformed.

## R7. No new dependency, no new export

Evaluation uses `mulberry32`/`mixSeed` (already in `src/rng.ts`) and plain math. No new
public function is required: bindings ride the existing `drawSpec`/`validateAnimSpec`
surface and the schema update is generated.

**Decision**: zero new exports, zero new dependencies, `NOTICE` unchanged.
