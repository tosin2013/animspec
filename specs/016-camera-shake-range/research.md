# Research: Camera Shake and a Wider Camera Range

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-23

Decisions taken against the code at `d3d0e7c` (0.4.0 plus the spec hygiene pass).

## R1. Field names

**Decision**: `camera.shake = { amp, freq }`. `amp` is the strength (fraction of the frame),
`freq` the speed (oscillations per second).

**Rationale**: Issue #87 asks for "scalar amplitude/frequency". Short scalar names match the
rest of the camera object (`zoom`, `x`, `y`, `frame`) and read clearly in a model prompt.

**Alternatives considered**: `strength`/`speed` (the spec's plain-language words; longer, and
"speed" suggests travel, not oscillation); a single `shake: 0.02` number (no way to set the
speed).

## R2. The shake signal

**Decision**: per axis, two sines at incommensurate rates, normalised so the peak cannot
exceed `amp`:

```text
dx = amp · ( sin(2π·freq·t + φ1) + 0.5 · sin(2π·2.31·freq·t + φ2) ) / 1.5
dy = amp · ( sin(2π·freq·t + φ3) + 0.5 · sin(2π·2.31·freq·t + φ4) ) / 1.5
```

`t` is the frame's time (`frame.t`, seconds). The four phases come from one
`mulberry32(mixSeed(seed, 0x5ea4e))` stream, drawn once per render call, times 2π.

**Rationale**:

- Closed form in `t` and the seed, so any frame or chunk renders alone (FR-003, FR-005).
- Two rates with an irrational-looking ratio (2.31) give an irregular, non-repeating feel
  (FR-004); independent phases per axis keep x and y from moving in lockstep.
- With `freq` at most 5, the faster sine runs at most 2.31 × 5 ≈ 11.6 per second, below half
  of 24 fps, so it does not alias at 24 fps or above. (An earlier draft allowed 12, which put
  the faster sine at 27.7 per second and did alias.)
- Dividing by 1.5 bounds the offset by `amp`, so the stated strength is the true maximum.
- A fixed constant mixed into the seed keeps the shake's stream separate from the streams
  primitives draw from (`mixSeed` is already used that way for per-layer bindings).

**Alternatives considered**:

- Seeded value noise sampled per frame: irregular, but either needs neighbouring samples
  (still closed form, more code) or looks steppy at low speeds.
- `frame.index` instead of `frame.t`: the camera keyframes use the index, but speed "per
  second" needs time; `t` is part of the SignalFrame contract and deterministic.

## R3. Where the offset is applied

**Decision**: inside the existing per-layer camera transform in `drawSpec`, as an extra
translation in frame pixels applied before the zoom: the first `translate(w/2, h/2)`
becomes `translate(w/2 + sx, h/2 + sy)` with `sx = dx · w · k`, `sy = dy · h · k`, where
`k` is the layer's depth under `parallax` and 1 otherwise.

When there is no shake, or `amp` is 0, the shake code is not reached and the transform calls
are exactly today's, so no existing frame can move (FR-008).

**Rationale**: measuring in the frame keeps the shake the same size whatever the zoom (spec
assumption). Scaling by depth only under parallax mirrors how 014 already treats `x`/`y`
(FR-007).

**Alternative considered**: adding `dx`, `dy` to the camera point `cam.x`, `cam.y`. That
magnifies the shake with zoom and would move the parallax pivot.

## R4. Validation

**Decision** (in `sanitizeCamera`, `src/specValidator.ts`):

| Input `shake` | Result | Message in `errors` |
| --- | --- | --- |
| absent | no shake | none |
| not an object | shake dropped, camera kept | `camera shake dropped (must be an object)` |
| `amp` missing or not a finite number | shake dropped, camera kept | `camera shake dropped (amp must be a number)` |
| `freq` present but not a finite number, or ≤ 0 | shake dropped, camera kept | `camera shake dropped (freq must be a positive number)` |
| valid | `amp` clamped to 0..0.05, `freq` clamped to at most 5; `freq` defaults to 3 when absent | none |

**Rationale**: the camera already follows "drop and report"; a bad shake should not cost the
author the whole camera (FR-009). A default speed of 3 per second reads as a handheld tremble.

## R5. Wider range

**Decision**: the keyframe clamp for `x` and `y` changes from `0..1` to `-1..2`; the JSON
schema's `minimum`/`maximum` follow. The interpreter is unchanged: it never clamped.

**Rationale**: values inside 0..1 pass through the clamp unchanged before and after, so their
frames cannot move (FR-011). The only behaviour change is for out-of-range values, recorded as
intended per the clarification (FR-012).

## R6. Reference cases

**Decision**: add a small camera case table to `scripts/lib/goldenHashes.ts`, rendered at the
three reference frames: a static camera with a shake, a parallax camera with a shake over a
depth-0 and a depth-1 layer, and a pan whose `to.x` is 1.5. Recorded with `golden:update` on
both processor types, with `golden/CHANGES.md` rows.

**Rationale**: the existing camera checks in `verify-determinism.ts` compare frames within
one run; reference cases also pin the shake across machines and catch an accidental change to
the formula later. 014 shipped without camera reference cases; this adds the first ones.

## R7. Constitution and documents

**Decision**: MINOR amendment (2.16.0): the baseline's "The format" entry mentions the shake
and the -1..2 range; the camera row in the Quality Gates table adds "shake is closed-form and
chunk-stable". Spec 014's `contracts/camera.md` gains the shake and the range; the user guide's
camera section and the camera schema description follow. No scope change, no new export, no
vocabulary change.
