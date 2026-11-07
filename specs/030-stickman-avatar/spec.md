# Feature Specification: Stickman, the Default Avatar

**Feature Branch**: `feature/030-stickman-avatar`

**Created**: 2026-11-07

**Status**: Shipped in 0.11.0

**Input**: The maintainer's review of the Stickman Lab preview (2026-11-06/07). Maintainer decisions (2026-11-07):

- A new core-tier primitive `stickman` becomes animspec's house mascot. It is offered to models by default and used across the docs, showcase and examples. `figure`, `rig` and `sprite` are unchanged.
- It interacts with other layers in all four ways:
  - pointing or looking at a target;
  - speaking the frame's label;
  - moving where the host's data says;
  - reacting to the signal.
- All six lab styles are kept: classic (the default), bold, outline, chibi, pixel and accent joints.
- Several stickmen can share a scene in two ways: one layer per figure, or a crowd of up to 12 in one layer (`count`, `arrangement`, `highlight`). A crowd isn't in lockstep: each figure gets a seeded phase and size.

## User Scenarios & Testing *(mandatory)*

animspec's people today are block silhouettes (`figure`), a talking cut-out (`rig`) and pixel characters (`sprite`). None of them can run, kick, fall or gesture at the rest of the frame. The Stickman Lab preview showed that an articulated stick figure, posed by joint angles that are pure functions of time, does all of that, reads at any size, and fits every palette.

### User Story 1 - An avatar that acts (Priority: P1)

An author writes `{ type: "stickman", action: "run" }`. A stick figure runs in place on the ground line. Changing `action` to `walk`, `jump`, `punch`, `kick`, `hit`, `fall`, `ko`, `wave` or `dance` changes the motion, and every frame renders alone.

**Why this priority**: This is the avatar itself.

**Independent Test**: Render each action at three moments and check three things: the moments differ (the action animates), each action differs from the others, and the same frame renders identically twice and in any order.

**Acceptance Scenarios**:

1. **Given** each action, **When** frames are rendered, **Then** the figure animates as a closed-form cycle in time, standing on the ground line `y`.
2. **Given** `fall`, **When** frames are rendered, **Then** the figure tips over once and stays down. **Given** `ko`, **Then** it lies on the ground.
3. **Given** `travel` other than 0, **When** frames are rendered, **Then** the figure moves across the frame at that rate, wrapping at the edges, facing its direction of travel.
4. **Given** `facing: "left"`, **When** a frame is rendered, **Then** the figure is mirrored.

---

### User Story 2 - Interacting with the rest of the frame (Priority: P1)

An author puts a `stickman` beside a `line-chart` and sets `action: "point"` with `targetX`/`targetY` on the chart's newest point. With `speech: true`, the frame's label appears in a speech bubble above the figure. A host game or simulation sets `from: "coords"`, so the figure stands wherever `coords[index]` says. A loud frame makes it hop.

**Why this priority**: This is what makes it an avatar rather than a decoration.

**Independent Test**: Render `point` at two targets and check that the hand ends nearer each target. Render with `speech` and two labels and check that the bubble changes. Render with `from: "coords"` at two coords and check that the figure moves. Render a quiet and a loud frame with `drive: "beat"` and check that the figure hops on the loud one.

**Acceptance Scenarios**:

1. **Given** `point`, `present` or `reach` with a target, **When** a frame is rendered, **Then** the front hand ends within one forearm length of the line from the shoulder towards the target. The figure faces the target unless `facing` says otherwise.
2. **Given** `look`, **When** a frame is rendered, **Then** the head turns towards the target.
3. **Given** `speech: true` and a label, **When** a frame is rendered, **Then** a bubble with the label, cut to 40 characters, sits above the figure's head with a tail towards it. Without a label, there is no bubble.
4. **Given** `from: "coords"` and `index`, **When** a frame is rendered, **Then** the figure stands at `coords[index]`, with `x` from the coordinate and its ground at `y`. If the index is missing, the params' `x`/`y` are used.
5. **Given** `drive: "level"` (the default), **When** quiet and loud frames are rendered, **Then** the figure's bob grows with the signal. **Given** `drive: "beat"`, **Then** it hops on loud frames. **Given** `drive: "none"`, **Then** the signal changes nothing.
6. **Given** a `bind` on a numeric param (`x`, `scale`, `speed`, `targetX` and so on), **When** frames are rendered, **Then** the param follows the bound source, as with every primitive.

---

### User Story 3 - Crowds in one layer (Priority: P2)

An author writes `{ type: "stickman", action: "dance", count: 8, arrangement: "cluster", highlight: 3 }`. Eight figures dance in a seeded cluster, each slightly out of step and slightly different in size. The third is drawn in the accent. With `from: "coords"`, figure *i* stands at `coords[index + i]`, so a host simulation moves the whole group from one layer.

**Why this priority**: Group scenes (an audience, a team, a protest, a dance floor) would otherwise use up the 12-layer limit on figures alone.

**Independent Test**: Render `count: 8` and check that there are eight figures in distinct places. Check that their poses differ at the same moment (they aren't in lockstep), and that the same seed gives the same crowd. Render with `highlight` and check that exactly one figure draws in the accent. Render with `from: "coords"` and 8 coordinates, and check that each figure stands at its own coordinate.

**Acceptance Scenarios**:

1. **Given** `count: n` (1–12) and `arrangement: "row"`, **When** a frame is rendered, **Then** n figures stand evenly spaced across the arrangement width, centred on `x`.
2. **Given** `arrangement: "cluster"`, **When** a frame is rendered, **Then** the figures stand in a seeded, jittered row around `x`, nearer ones lower and larger, and drawn back to front.
3. **Given** `arrangement: "split"`, **When** a frame is rendered, **Then** two groups face each other across `x`.
4. **Given** a crowd, **When** frames are rendered, **Then** each figure's action runs with its own seeded phase offset (up to one cycle) and its own size (±8%). The same seed always gives the same crowd. `count: 1` is exactly a single figure.
5. **Given** `highlight: k` (1-based; 0 means none), **When** a frame is rendered in creative mode, **Then** figure k draws in the accent and the rest in `colour`.
6. **Given** a crowd with `speech: true`, **When** a frame is rendered, **Then** only one figure speaks: the highlighted one, or else the first.
7. **Given** a crowd with a target action, **When** a frame is rendered, **Then** every figure aims at the same target.

---

### User Story 4 - Styles and colours (Priority: P2)

An author picks `style` (classic, bold, outline, chibi, pixel, joints) and `colour` (fg, accent, fg2), so a narrator, a hero and a crowd can be told apart in black and white or in colour.

**Independent Test**: Render each style and check that the six frames differ. Render the pixel style, or any style under `pixelMode`, on a solid background, and check that every pixel is a palette colour. Render two figures in `fg` and `accent` in creative mode, and check that they draw in their own colours.

**Acceptance Scenarios**:

1. **Given** each style, **When** a frame is rendered, **Then** the six styles differ:
   - **classic**: thin limbs and a solid head;
   - **bold**: heavy limbs;
   - **outline**: a hollow head;
   - **chibi**: a large head;
   - **pixel**: whole-pixel limbs and head;
   - **joints**: accent head, hands and feet, with joint dots.
2. **Given** the pixel style, or `pixelMode` with any style, **When** a frame is rendered on a solid background, **Then** every pixel the figure draws is exactly a palette colour.
3. **Given** `profile: "gameboy-dmg"` and the pixel style, **When** a frame is rendered, **Then** the figure is drawn only in DMG greens.
4. **Given** `colour: "accent"` or `"fg2"`, **When** a frame is rendered in creative mode, **Then** the figure draws in that role. In monochrome, `accent` is the foreground and `fg2` is mid grey.

---

### User Story 5 - The house mascot (Priority: P2)

Models see `stickman` in the default (core) vocabulary and in the `data-viz`, `minimal` and `arcade` kits. The gallery shows it. The showcase gains three loops:
- **a presenter**: pointing at a line chart while speaking a label;
- **a fight**: two figures in a `sequence` of clips;
- **a dance**: a single-layer crowd that hops on the beat, with one highlighted dancer.

The user guide's examples use it.

**Acceptance Scenarios**:

1. **Given** the vocabulary, **When** a model is shown the core primitives, **Then** `stickman` is among them, with every action and style described.
2. **Given** the showcase, **When** it is generated, **Then** the presenter, fight and dance loops render from the library.

### Edge Cases

- **Target behind the figure**: it turns to face the target (unless `facing` is set), so pointing never folds the arm through the body.
- **Target out of reach**: the arm points along the line towards it, fully extended.
- **Very small scale**: limbs are at least 1 pixel wide and the head at least 2 pixels, so the figure stays visible.
- **Long labels**: cut to 40 characters. The bubble stays inside the frame by shifting sideways.
- **Coordinates outside 0..1**: clamped.
- **Transparent background**: the figure is opaque in its palette colour and passes the transparency gate.
- **Twelve figures in one spec**: within the composition budget.
- **Twelve crowd layers of twelve figures**: 144 figures, still within the composition budget (each figure is about a dozen draw operations).
- **A crowd with `from: "coords"` and too few coordinates**: figures without a coordinate fall back to their arrangement position.
- **`highlight` above `count`**: no figure is highlighted.
- **Several layers versus one crowd**: both are supported. Use layers when figures need different actions, and a crowd when they share one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The vocabulary MUST gain `stickman` in the `core` tier (category `sprite`). Its params MUST be scalar and pass the shared param rules.
- **FR-002**: `action` MUST offer `idle`, `walk`, `run`, `jump`, `punch`, `kick`, `hit`, `fall`, `ko`, `wave`, `dance`, `point`, `present`, `reach` and `look`. Each MUST pose the skeleton as a closed-form function of time and params only.
- **FR-003**: Position and size MUST come from `x`, `y` (the ground line), `scale` and `facing` (`right`, `left`, `auto`), and optionally from `travel` (frame widths per second, wrapping). `speed` MUST scale the action's tempo.
- **FR-004**: Target actions MUST aim at `targetX`/`targetY`.
- **FR-005**: `speech: true` MUST draw the frame's label in a speech bubble, in palette colours, cut to 40 characters.
- **FR-006**: `from: "coords"` with `index` MUST take the position from `coords[index]`, falling back to the params when it is absent.
- **FR-007**: `drive` (`level`, `beat`, `none`) MUST set the signal reaction. Every numeric param MUST be bindable.
- **FR-008**: `style` MUST offer `classic` (default), `bold`, `outline`, `chibi`, `pixel` and `joints`. `thickness` and `headScale` MUST refine any style.
- **FR-009**: `colour` MUST offer `fg` (default), `accent` and `fg2`, using the palette roles (spec 019/020 rules).
- **FR-010**: Under `pixelMode`, every style MUST draw whole-pixel limbs and head (spec 026). The pixel style always does.
- **FR-011**: `stickman` MUST join the `data-viz`, `minimal` and `arcade` kits.
- **FR-015**: `count` (1–12, default 1) MUST draw that many figures in one layer, placed by `arrangement` (`row`, `cluster`, `split`).
- **FR-016**: Each crowd figure MUST take a seeded phase offset and size variation from the layer seed, so the same seed gives the same crowd. `count: 1` MUST equal a single figure with no variation.
- **FR-017**: `highlight` (0–12) MUST draw that figure in the accent. With `speech`, only one figure speaks.
- **FR-018**: With `from: "coords"`, crowd figure *i* MUST read `coords[index + i]`, falling back to its arrangement position when that entry is absent.
- **FR-012**: It MUST pass the purity, palette, reactivity, budget and transparency gates at its defaults, and stay within the cross-type tolerance.
- **FR-013**: No existing reference frame MAY move. The vocabulary version MUST rise by one.
- **FR-014**: The user guide MUST document `stickman` as the default avatar. The showcase MUST gain the presenter, fight and dance loops. The gallery MUST show it with a demo.

### Key Entities

- **Crowd**: up to 12 stickmen in one layer, sharing an action, each with a seeded phase and size, placed by an arrangement.
- **Stickman**: an articulated figure.
  - **Body**: a head, a torso, and two arms and two legs, each with a joint.
  - **Pose**: joint angles chosen by `action` at the frame's time.
  - **Placement**: position from params or `coords`.
  - **Look**: `style` and `colour`.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of existing reference frames are byte-identical in both sets.
- **SC-002**: Each of the 15 actions animates (frames at three moments differ), and all 15 are distinct.
- **SC-003**: Pointing at two different targets aims the arm at each: the hand lies within 8° of the shoulder-to-target direction.
- **SC-004**: The pixel style, and any style under `pixelMode`, draws 0 off-palette pixels on a solid background.
- **SC-005**: Twelve stickmen in one spec, and twelve 12-figure crowd layers, stay within the composition budget.
- **SC-007**: A crowd of 8 shows 8 figures whose poses differ at the same moment, and a repeat render with the same seed is byte-identical.
- **SC-006**: The verify command passes offline within the CI budget.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For authors, models and hosts**: an expressive default avatar that acts, gestures at the rest of the frame, speaks, and moves with host data or the signal.

### In scope

- The `stickman` primitive: its actions, params and styles.
- Kit membership.
- Checks, reference cases, a gallery demo, three showcase loops and the user guide.

**Boundary change**: none. This is a new primitive under the existing rules, and `coords`, `labels`, `bind`, `pixelMode` and profiles are existing contracts.

### Out of scope

- **Physics, collision, or one figure reacting to another by itself**: these would need state across frames (Principle I). Interaction is choreographed by clips, data or binds.
- **The action chosen from frame data**: a later spec.
- **Replacing `figure`**: it stays core and unchanged.
- **Faces, hands with fingers, and costumes**: later, if asked for.
- **A frame-level finish (CRT and so on)**: Motion Studio's (#90).

### External dependencies

- None.

### Non-negotiable constraints

- **Principle I**: pure, frame-order independent, within the cross-type tolerance.
- **Principle II**: params and descriptions live in the registry.
- **Principle III**: palette roles only.
- **Principle IV**: labels and coords are clamped and cut.
- **Principle V**: no existing frame moves.
- **Principle VI**: one offline verify command.
- **Principle VII**: no boundary change.

## Assumptions

- **The skeleton** follows the Stickman Lab:
  - proportions: torso 1.9 units, upper and lower arm 0.95 and 0.9, thigh and shin 1 each, head radius 0.48 × `headScale`;
  - one unit is a sixth of the figure's height (`scale` × frame height).
- **Default layer**: `action: idle`, classic style, foreground colour, `drive: level`, centred and standing on `y: 0.86`.
- **Action tempos at `speed: 1`**:
  - walk 1.4 Hz;
  - run 2.2 Hz;
  - one jump every 1.3 s;
  - jabs every 0.9 s;
  - kicks every 1.1 s;
  - one fall over 1.1 s, then held.
- **The beat hop** triggers at amplitude ≥ 0.6, as `hud-score`'s emphasis does.
- **Crowd placement** follows `figure`'s arrangements:
  - **row**: evenly spaced across 70% of the width;
  - **cluster**: a jittered row, with slots evenly spaced over 80% of the width, each figure up to half a slot off its slot and ±4% of the height off the ground line, scaled 85–100% by depth;
  - **split**: two halves facing each other.
- **Crowd variation**: each figure's phase offset is seeded uniformly over one cycle, and its size over ±8%, both from the layer seed and the figure index.
- **Scope source**: the Stickman Lab preview and the maintainer decisions of 2026-11-07.
