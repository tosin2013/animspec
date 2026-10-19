# Feature Specification: Per-layer signal bindings

**Feature Branch**: `feature/013-signal-bindings`

**Created**: 2026-10-18

**Status**: Draft

**Input**: Issue #71 — drive any numeric param of any layer from a SignalFrame feature via
an optional per-layer `bind` map, so one mechanism covers lip-sync (`rig.mouthOpen` ←
amplitude), beat-sync (`emitter.burst`, `rings` size ← beat energy) and idle motion
(seeded oscillator → `eyeOpen`). A spec-level change, deliberately not a primitive
proposal; the maintainer directed it through spec kit.

## User Scenarios & Testing

### User Story 1 - A spec drives a param from the signal (Priority: P1)

A spec author writes a layer with a `bind` map — e.g. a `rig` whose `mouthOpen` follows
the frame's amplitude, or an `emitter` whose density follows energy — and the interpreter
evaluates the binding every frame: read the feature, map it through `in`/`out` (linear or
smooth), clamp to the target param's registry bounds, and draw with the driven value. The
layer's static param value is the documented fallback and is overridden each frame.

**Why this priority**: the binding is the feature; everything else is its guardrails.

**Independent Test**: render a bound layer at a quiet and a loud frame with the same
seed — the driven param differs exactly as the mapping predicts, while an unbound layer is
unchanged.

**Acceptance Scenarios**:

1. **Given** `{ type: "rig", bind: { mouthOpen: { from: "amplitude", out: [0, 1] } } }`,
   **When** rendered at amplitude 0.2 and 0.8, **Then** the mouth opening is 0.2 and 0.8.
2. **Given** a bind with `in: [0.05, 0.6]` and `out: [-8, 8]`, `curve: "smooth"`,
   **When** the feature is at the edges of `in`, **Then** the driven value is clamped to
   `out`, and mid-range follows the smooth curve.
3. **Given** `from: "band:3"`, **When** rendered, **Then** the driven value comes from
   `frame.values[3]`.
4. **Given** an `osc` bind with `period: 4.2`, `duty: 0.05`, `wave: "pulse"`,
   **When** rendered across frames, **Then** the value holds `out[0]` and flips to
   `out[1]` for a twentieth of each 4.2 s cycle, at a phase seeded from the render seed —
   and with `wave: "sine"` it follows a smooth oscillation instead.

### User Story 2 - Bad binds are dropped loudly; good specs render unchanged (Priority: P1)

A spec is untrusted input. A bind to an unknown param, a non-numeric param, an unknown
`from` form, or a malformed map is dropped — the layer renders with its static params and
the validator reports the drop. A spec with no `bind` renders byte-identically to today.

**Why this priority**: the format only stays trustworthy if its new field has the same
validate-and-report discipline as everything else.

**Independent Test**: feed the validator specs with each malformed bind — each is
reported and the layer survives with static params; render a bind-free spec — its bytes
match today's.

**Acceptance Scenarios**:

1. **Given** a bind to a param that does not exist or is an enum/boolean/string,
   **When** validated, **Then** the bind is dropped with a reported error and the layer
   renders with its static value.
2. **Given** a bind with an unknown `from`, a malformed `in`/`out`, a non-positive osc
   `period`, or a `duty` outside 0..1, **When** validated, **Then** the bind is dropped
   and reported.
3. **Given** a pre-bindings spec, **When** rendered by the new interpreter, **Then** the
   bytes are identical to today's output.

### User Story 3 - The contract is published where models and hosts read it (Priority: P2)

The JSON schema describes the `bind` shape, the vocabulary/prompt text notes that numeric
params can be bound, and the constitution records the format change.

**Why this priority**: the feature is only usable once the contract is visible.

**Independent Test**: the generated schema validates a spec with binds; the docs and
amendment ship in the same change.

**Acceptance Scenarios**:

1. **Given** the generated JSON schema, **When** a spec with a well-formed bind is
   checked, **Then** it passes; a bind with a non-numeric target fails.
2. **Given** the merged change, **Then** the constitution's format entry and gates table
   include the bindings, with the version bumped.

### Edge Cases

- **Bind to a param the primitive drives internally** (e.g. `rig.mouthOpen` with
  `drive: "amplitude"`): the binding overrides the static value each frame, and the
  primitive's internal drive still applies on top — documented stacking, the author's to
  avoid (v1 rule; the validator does not police it).
- **`band:<n>` past the track's band count**: the bind cannot evaluate — the static
  param value applies for that frame.
- **Osc phase**: seeded from the render seed, the layer index and the param name, so two
  layers bound to `osc` drift apart deterministically.
- **`in` omitted**: defaults to `[0, 1]`. **`out` omitted**: defaults to the param's
  registry bounds.
- **`curve`**: `linear` (default) or `smooth` (smoothstep of the normalised position).
- **Zero-length or reversed `in`/`out`**: malformed — bind dropped and reported.

## Requirements

### Functional Requirements

**Format and evaluation**

- **FR-001**: A layer MAY carry an optional `bind` map: keys are declared **numeric**
  param names of that layer's primitive; values are binding objects
  `{ from, in?, out?, curve?, wave?, period?, duty? }`. Enum, boolean and string params
  cannot be bound in v1.
- **FR-002**: `from` is `amplitude`, `energy`, `band:<n>` (an index into the frame's
  `values`), or `osc` (a deterministic oscillator of `t`). `label:<n>` is **deferred**:
  frame labels are strings, and a numeric-label channel would need a contract of its own.
- **FR-003**: Evaluation happens per frame in the interpreter, before the primitive's
  draw: read the feature from the current SignalFrame (`osc` from `t`), normalise by `in`
  (default `[0, 1]`), apply `curve` (`linear`, or `smooth` = smoothstep), map through
  `out`, and clamp to the target param's registry bounds. The static sanitized value is
  the fallback when a bind cannot evaluate.
- **FR-004**: `osc` supports both waveforms: `wave: "pulse"` (default — the value holds
  `out[0]` and takes `out[1]` for `duty` of each `period` seconds) and `wave: "sine"`
  (a smooth oscillation between `out[0]` and `out[1]` with the given `period`; `duty`
  unused). The phase is seeded from the render seed, the layer index and the param name.
- **FR-005**: Stacking rule: a binding **overrides the static param value** each frame;
  a primitive's own internal signal read for the same quantity still applies on top.
  Documented in the schema description and the vocabulary text — the spec author avoids
  stacking, the validator does not police it in v1.

**Validation**

- **FR-006**: `sanitizeLayer` preserves a well-formed `bind` map and drops a malformed
  one (unknown or non-numeric target param, unknown `from`, non-2-element or
  non-numeric `in`/`out`, unknown `curve`/`wave`, non-positive `period`, `duty` outside
  0..1); `validateAnimSpec` reports every dropped bind as an error, in the same voice as
  today's reports. Layers are never dropped for their binds.
- **FR-007**: `from: "band:<n>"` with `n` beyond the frame's band count cannot evaluate;
  the static value applies for that frame (no error — the track shape is legitimate to
  vary).

**Contract**

- **FR-008**: The generated JSON schema describes the `bind` shape and rejects
  non-numeric bind targets structurally; the vocabulary text notes that numeric params
  can be bound from the signal.
- **FR-009**: Determinism: bindings are a pure function of `(frame, seed, bind)`; no
  state crosses frames. A spec without `bind` renders byte-identically to today, and a
  bound spec rendered in chunks matches the whole render.
- **FR-010**: The verify suite gains bind coverage: validator rejection cases, a
  bound-render mapping check (quiet vs loud), and chunk-vs-whole equality with binds
  active.
- **FR-011**: The constitution baseline is amended in the same change: the format entry
  gains per-layer signal bindings, the gates table gains the bind checks, version bumped
  (the vocabulary version is untouched — this is a format change, not a vocabulary
  change).

### Key Entities

- **Binding**: `{ from, in?, out?, curve?, wave?, period?, duty? }` — the mapping from
  one SignalFrame feature to one numeric param.
- **Feature source**: `amplitude` | `energy` | `band:<n>` | `osc` — what the binding
  reads each frame.
- **Driven param**: the declared numeric param whose value the binding replaces per
  frame, always within its registry bounds.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A bound `rig` lip-syncs: the mouth opening follows amplitude through the
  mapping at every reference frame.
- **SC-002**: Every malformed-bind case (unknown param, non-numeric target, unknown
  `from`, malformed `in`/`out`, bad `period`/`duty`) is dropped and reported; the layer
  still renders with static params.
- **SC-003**: A bound spec rendered in chunks is byte-identical to the whole render.
- **SC-004**: A pre-bindings spec renders byte-identically to today (no golden hash
  moves).
- **SC-005**: The generated schema accepts well-formed binds and structurally rejects
  non-numeric targets; `npm run verify` passes end to end.

## Boundaries

### Outcome

- **For a spec author**: one mechanism to drive any numeric param from the signal —
  lip-sync, beat-sync and idle motion without per-primitive hard-wiring.
- **For the project**: the format gains its first per-layer reactive field with the same
  validate-and-report discipline as the rest of the contract.

### In scope

- The optional `bind` map in the AnimSpec format: sources, mapping, curves, waveforms,
  validation, per-frame evaluation, and the schema/prompt surface.
- Verify coverage: rejection cases, mapping checks, chunk-vs-whole equality with binds.
- The constitution baseline amendment this feature requires.

**Boundary change**: yes — the AnimSpec contract gains an optional field, a new promise
to hosts and model authors ("numeric params can be signal-driven from the spec"). The
baseline's "The format" entry and the Quality Gates table are amended in the same change
that ships it.

### Out of scope

- **`label:<n>` bindings**: frame labels are strings; a numeric-label channel is
  deferred to a future version. Held by: nobody, for now.
- **Smoothing/state across frames**: hosts pre-smooth the track. Held by: the caller.
- **Binding enum/boolean/string params**: v1 is numeric-only. Held by: nobody, for now.
- **Primitive changes**: no primitive's draw is altered; internal signal reads stack with
  bindings per FR-005's documented rule.
- **A visual UI for editing binds**: hosts own their tools.

### External dependencies

- **None.** Evaluation uses the frame, `t`, the render seed and existing math.

### Assumptions

- Osc phase and band indices are resolved per layer/param at evaluation time from data
  the interpreter already holds.
- Hosts that want smoothed or filtered drives pre-process the track (the format stays
  stateless).
- The stacking rule (override + documented stacking) is acceptable v1 behaviour; a
  validator-level guard can arrive later without a format change.

### Non-negotiable constraints

- **Principle I**: a bound frame is a pure function of `(spec, frame, seed)` — evaluation
  reads the current frame, `t` and the seed only; chunk renders are byte-identical.
- **Principle II**: bind keys and clamps come from the registry declarations — the
  registry stays the single source of truth for what can be bound and within what bounds.
- **Principle IV**: specs are untrusted — malformed binds are dropped and reported;
  layers never disappear over their binds.
- **Principle V**: specs without `bind` render byte-identically; saved bound specs keep
  rendering (bindings are part of the saved contract).
- **Principle VI**: all new checks run inside the one offline `npm run verify`.
- **Principle VII**: this spec names the contract change; the baseline is amended in the
  same change that ships it.
