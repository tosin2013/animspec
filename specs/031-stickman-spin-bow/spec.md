# Feature Specification: Stickman Spin, Bow and Off-Frame Position

**Feature Branch**: `feature/031-stickman-spin-bow`

**Created**: 2026-11-23

**Status**: Shipped in 0.12.0

**Input**: Issues #179 (no spin or bow) and #182 (`x: 0` clips the figure; nothing can start
off-frame), both from the animspec-author cold-start stickman test (MSG-1832). Maintainer
decisions (2026-11-23):

- Add `spin` and `bow` to `stickman`'s actions.
- Widen `stickman.x` to -0.5..1.5, so a figure can stand off-frame and walk in. Document `x`
  as the figure's centre.

This extends spec 030.

## User Scenarios & Testing *(mandatory)*

A presenter has two gestures that bookend a piece: turning to a new visual, and the closing
bow. The cold-start test had to substitute `dance` for a spin and `idle` for a bow. Its walk-in
bound `x` from 0, so the first frame showed half a figure, because `x` is the centre and could
not go below 0.

### User Story 1 - A closing bow (Priority: P1)

**Acceptance Scenarios**:

1. **Given** `action: "bow"`, **When** frames are rendered, **Then** the figure bows from the
   hips and rises again every second (down 35%, hold 30%, up 35%). Its arms hang straight
   down whatever the lean, its legs stay straight, and at the bottom it is lower than when
   standing.

### User Story 2 - A spin (Priority: P1)

**Acceptance Scenarios**:

1. **Given** `action: "spin"`, **When** frames are rendered, **Then** the figure makes one
   full turn in place every 1.2 s. In 2D this shows as the figure narrowing edge-on (never
   below 12% of its width), turning round, and widening again, with a small hop at the
   half-turn.
2. **Given** `facing: "left"`, **When** frames are rendered, **Then** it turns the other way.
   The raised arm sweeps across the body in the opposite direction.

### User Story 3 - Standing off-frame (Priority: P1)

**Acceptance Scenarios**:

1. **Given** `x: -0.3`, **When** a frame is rendered, **Then** nothing of the figure is
   drawn.
2. **Given** a bind on `x` from -0.2 to 0.5, **When** frames are rendered, **Then** the
   figure walks in from fully off-frame.
3. **Given** `from: "coords"` and a coordinate with `x: -0.2`, **When** a frame is rendered,
   **Then** the figure stays off-frame. It is no longer clamped to the edge.

### Edge Cases

- **A crowd centred off-frame**: its figures can be partly or wholly off-frame, as placed.
- **`travel`**: still wraps between -0.1 and 1.1, unchanged.
- **Values beyond -0.5 or 1.5**: clamped by the validator.

## Requirements *(mandatory)*

- **FR-001**: `stickman.action` MUST gain `bow` and `spin`. Both MUST be closed-form functions
  of time, and every other action MUST render exactly as before.
- **FR-002**: `spin`'s direction MUST follow `facing`.
- **FR-003**: `stickman.x` MUST accept -0.5..1.5. With `from: "coords"`, `x` MUST be clamped
  to the same range (`y` stays 0..1).
- **FR-004**: The `x` description and the user guide MUST say `x` is the figure's centre,
  that values near 0 or 1 show half the figure, and how to walk in from off-frame.
- **FR-005**: The vocabulary version MUST rise to 24.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of existing reference frames are byte-identical in both sets.
- **SC-002**: `bow` and `spin` each animate, and differ from the other 15 actions.
- **SC-003**: At the quarter turn, `spin` is less than half as wide as when facing.
- **SC-004**: `x: -0.3` draws 0 pixels, and a walk-in bind reaches a visible figure.

## Boundaries *(mandatory, constitution Principle VII)*

- **Outcome**: the presenter gestures (turn, bow) and entrances and exits from off-frame.
- **In scope**: the two actions, the wider `x` range for params and coords, checks, reference
  cases and docs.
- **Boundary change**: none.
- **Out of scope**:
  - a true 3D turn;
  - camera rotation (a more general alternative #179 mentions; not needed for these
    gestures);
  - choosing an action from frame data (still later, as in spec 030).
- **External dependencies**: None.
- **Non-negotiable constraints**: Principles I–VII.
  - **Principle V, recorded exception**: a saved spec whose raw `x` (or coords `x`) was
    outside 0..1 used to be clamped to the frame edge, and now renders at the value it
    asked for, off-frame. No reference case used such values. This is the same kind of
    exception as spec 016's wider camera range.

## Assumptions

- **Tempos at speed 1**: a bow every 1 s, a spin every 1.2 s.
- **The spin is a horizontal scale** of the posed figure about its `x` (`cos(2πu)`, at least
  0.12 in magnitude). The head stays round.
- **Scope source**: issues #179 and #182, and the maintainer decisions of 2026-11-23.
