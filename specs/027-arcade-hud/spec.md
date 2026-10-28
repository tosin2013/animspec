# Feature Specification: Arcade HUD

**Feature Branch**: `feature/027-arcade-hud`

**Created**: 2026-10-28

**Status**: Implemented (0.9.0)

**Input**: Issues #106 (Capcom CPS II versus stage: a data-bound versus HUD) and #105 (MAME-era arcade: HUD text conventions and the vertical "tate" profile), planned for 0.9.0. Maintainer decisions (2026-10-28):

- The data-bound HUD is two new primitives in one spec: `versus-bars` and `hud-score`. They go through spec kit rather than the single-primitive proposal path, because there are two of them.
- The CRT, scanline and aperture-grille finish stays out of scope. It belongs to Motion Studio (decided on #90).
- The 384×224 and 224×288 render sizes are the host's width and height. They become documented profiles and showcase examples, not code.
- The mirrored second fighter uses what exists: `sprite.faceLeft` and `image.flip`.

## User Scenarios & Testing *(mandatory)*

Both host tests from #105 and #106 hand-drew their HUDs every frame:
- two health bars that drain from gold to a red damage tail, plus a centre timer (CPS II);
- 1UP, HI-SCORE and CREDIT read-outs (a vertical shooter).

The renderer could not draw them from data, so the values were baked into strings per frame. The use cases are documentary "claim vs counterclaim" versus scenes, and HUD-as-information-design chapter frames.

### User Story 1 - Data-bound versus bars (Priority: P1)

An author adds a `versus-bars` layer. The host puts each side's health and damage-tail values in the frame's `coords`. Two opposed bars drain toward the centre as the values fall, with the recent damage shown as a tail.

**Why this priority**: This is #106's acceptance sketch and the part that can't be drawn today.

**Independent Test**: Render a `versus-bars` layer at two data states (`coords` of `[{x:1,y:1},{x:1,y:1}]` and `[{x:0.4,y:0.6},{x:0.8,y:0.8}]`). Check that each bar's fill length, and its tail length, follow the values.

**Acceptance Scenarios**:

1. **Given** a frame with `coords[0] = {x: 0.4, y: 0.6}`, **When** it is rendered, **Then** the left bar's fill covers 40% of its length from the outer edge, and its tail covers the next 20% (from 40% to 60%).
2. **Given** `coords[1]`, **When** it is rendered, **Then** the right bar mirrors the left: its fill grows from the right edge toward the centre.
3. **Given** a tail value below the fill value, **When** it is rendered, **Then** no tail shows. The tail is never drawn under the fill.
4. **Given** values outside 0..1, **When** they are rendered, **Then** they are clamped to 0..1.
5. **Given** a frame with no `coords`, **When** it is rendered, **Then** the bars show the signal: the left fill follows the low half of the spectrum and the right fill follows the high half, with no tail. A default layer still reacts.
6. **Given** a solid background, **When** any frame is rendered, **Then** every pixel is exactly the background, the foreground, the accent or the mid grey. The angled ends are whole-pixel steps, so no edge blends.

---

### User Story 2 - Arcade HUD text from data (Priority: P2)

An author adds a `hud-score` layer, and the host puts the values in the frame's `labels`.
- In the `shooter` layout: 1UP score top-left, HI-SCORE top-centre, CREDIT bottom-right.
- In the `versus` layout: the timer top-centre, and the two names under the bars.

**Why this priority**: This is #105's HUD convention, and the versus timer from #106. Values are data, not baked strings.

**Independent Test**: Render `hud-score` with labels `["12340", "50000", "2"]` in the shooter layout. Change the labels and check that the text changes.

**Acceptance Scenarios**:

1. **Given** the `shooter` layout and labels `[score, hiScore, credits]`, **When** a frame is rendered, **Then** `1UP` and the score sit top-left, `HI-SCORE` and its value top-centre, and `CREDIT <n>` bottom-right.
2. **Given** the `versus` layout and labels `[timer, name1, name2]`, **When** a frame is rendered, **Then** the timer sits top-centre and the names sit left and right just below the versus bars' default position.
3. **Given** a missing label, **When** a frame is rendered, **Then** that value is left blank. Captions such as `1UP` still draw. Nothing is invented.
4. **Given** a loud frame (amplitude at least 0.6) with `drive: "level"`, **When** it is rendered, **Then** the emphasised item (`1UP` in shooter, the timer in versus) draws inverted (background-coloured text on a foreground box), so the emphasis shows in black and white too.
5. **Given** `drive: "none"`, **When** frames are rendered, **Then** no emphasis is drawn and the signal changes nothing.

---

### User Story 3 - Documented arcade profiles (Priority: P3)

An author who wants the CPS II versus stage or a vertical shooter finds a documented profile: the render size, `pixelMode` (spec 026), `pixelAspect`, and a worked spec. Two showcase loops show them.

**Why this priority**: It turns #105 and #106 into a recipe without new code.

**Independent Test**: The user guide has a "Style profiles" section with both profiles. The showcase page shows `cps2-versus` and `tate-shooter` loops rendered by the library.

**Acceptance Scenarios**:

1. **Given** the user guide, **When** an author reads "Style profiles", **Then** they find CPS II (384×224, versus stage, a mirrored second fighter via `faceLeft` or `flip: "x"`) and arcade tate (224×288), each with a spec. They also find a note that the CRT finish belongs to Motion Studio.
2. **Given** the showcase, **When** it is generated, **Then** `cps2-versus` shows two fighters, draining bars and a timer, driven by frame data that changes over the loop. `tate-shooter` shows a starfield and the shooter HUD.

### Edge Cases

- **More than two `coords`**: only the first two are read.
- **One `coords` entry**: the right bar falls back to full (1). The left bar reads the entry.
- **Long labels**: each value is cut to 12 characters. The timer is cut to 3.
- **Very small frames** (224×288 portrait): positions and sizes are fractions of the frame, with a minimum text size that keeps text readable.
- **Transparent background**: both draw opaque palette pixels and pass the transparency gate.
- **Camera**: both are ordinary layers and move with the camera. A HUD author sets `depth: 0` under parallax to pin them.
- **Pixel mode**: `versus-bars` is already whole-pixel. `hud-score` text is antialiased like every text primitive, and pixel mode does not change it (spec 026 lists the primitives it covers).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The vocabulary MUST gain `versus-bars` (category `signal-bars`) and `hud-score` (category `text`), both in the `contrib` tier.
- **FR-002**: `versus-bars` MUST read the left side's fill and tail from `coords[0].x` and `coords[0].y`, and the right side's from `coords[1]`, each clamped to 0..1.
- **FR-003**: Without `coords`, `versus-bars` MUST draw the signal (low and high spectrum halves) with no tail.
- **FR-004**: `versus-bars` MUST draw a frame outline, the fill in the foreground, and the tail in the accent in creative mode or the mid grey otherwise. Every edge MUST be whole pixels, including the angled ends.
- **FR-005**: `versus-bars` params: `y`, `height`, `gap` (the centre gap for the timer), `angle` (slant of the outer ends, 0 for square), `tail` (boolean), and `drive` (`level`: the damage tail flashes to the foreground on loud frames, a hit, so it shows in black and white too; `none`: static).
- **FR-006**: `hud-score` MUST read its values only from `labels`, by position, according to `layout` (`shooter` or `versus`). Captions (`1UP`, `HI-SCORE`, `CREDIT`) are fixed text, and `captions: false` hides them.
- **FR-007**: `hud-score` params: `layout`, `size` (text height as a fraction of the frame), `captions` (boolean), and `drive` (`level`: inverted emphasis on loud frames; `none`: static).
- **FR-008**: Both MUST draw with palette roles only (bg, fg, accent, and the mid grey), and MUST be pure functions of spec, signal and seed. They carry no state between frames, and every tail value comes from data.
- **FR-009**: Both MUST pass every vetting gate (purity, palette, reactivity, budget, transparency) at their defaults, and the cross-type tolerance.
- **FR-010**: The vocabulary version MUST rise from 17 to 18.
- **FR-011**: The user guide MUST document both primitives and the two style profiles. The showcase MUST gain the `cps2-versus` and `tate-shooter` loops.
- **FR-012**: Reference cases MUST pin `versus-bars` at two data states and without data, and `hud-score` in both layouts with and without labels.

### Key Entities

- **Versus bars**: two opposed health bars. Their data are the first two frame coordinates: `x` is the fill, `y` is the damage tail.
- **HUD read-out**: positioned arcade text whose values are the frame's labels, in an order fixed by the layout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical in both sets.
- **SC-002**: At the two data states, each bar's fill and tail length match the value within one pixel.
- **SC-003**: A solid `versus-bars` frame has 0 pixels outside {bg, fg, accent, mid grey}.
- **SC-004**: Changing only the labels changes a `hud-score` frame. Changing only the signal, with `drive: "none"`, does not.
- **SC-005**: Both primitives pass every gate, and the verify command passes offline within the CI budget.
- **SC-006**: The #106 versus scene and the #105 shooter HUD can be built from one spec each, with no per-frame host drawing.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For a spec author, a model or a host**: arcade HUDs whose values come from frame data, and documented CPS II and tate profiles.

### In scope

- Two primitives, their params, descriptions, checks, reference cases, gallery thumbnails and loops.
- The user guide's style profiles and two showcase loops.

**Boundary change**: none. New primitives join the vocabulary under the existing rules. Reading `coords` and `labels` is already part of the `SignalFrame` contract. No new field, export, output, dependency or service.

### Out of scope

- **CRT, scanline and aperture-grille finishes**: Motion Studio's (#90).
- **Palette profiles** (#102): a later spec.
- **A damage tail that lags by itself over time**: it would need state across frames (Principle I). The host supplies the tail value.
- **A running timer computed from time**: the host supplies the number as a label.
- **New sprite params for mirroring**: `faceLeft` and `image.flip` already cover it.
- **Pixel-mode text**: text stays antialiased.

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure, frame-order independent, within the cross-type tolerance.
- **Principle II**: the registry is the source of the params and descriptions.
- **Principle III**: palette roles only.
- **Principle IV**: labels and coords are untrusted. They are clamped and cut, never interpreted.
- **Principle V**: no existing frame moves.
- **Principle VI**: one offline verify command.

## Assumptions

- **Coordinate convention**: `x` is the fill and `y` is the tail, both 0..1 where 1 is full health. This matches how other primitives read `coords` as normalised pairs.
- **Signal fallback**: low and high spectrum halves for the two bars keep the default layer reactive for the gallery and the reactivity gate.
- **Loud threshold**: amplitude 0.6 for the `hud-score` emphasis, and energy 0.7 for the `versus-bars` hit flash.
- **Captions** are English arcade conventions (`1UP`, `HI-SCORE`, `CREDIT`) and are not translated.
- **Defaults**: `y` 0.06, `height` 0.045, `gap` 0.12, `angle` 8°, `tail` true, `layout` `shooter`, `size` 0.05, `captions` true, `drive` `level`.
- **Scope source**: issues #105 and #106 and their triage comments, the #90 decision, spec 026, and the maintainer decisions of 2026-10-28.
