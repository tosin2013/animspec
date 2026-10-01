# Research: Complete the Primitive Vetting Gates

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-30

Every decision below was checked by running a throwaway prototype against the 29 real
primitives. Figures are from a developer laptop; they are evidence for the decisions, not
committed limits.

## R1. Detecting file and network access while drawing

**Decision**: Two layers.

1. A static rule, added to the existing source scan: nothing under `src/` may import a file,
   network, process or worker module (`fs`, `path`, `net`, `http`, `https`, `dns`, `dgram`,
   `child_process`, `worker_threads`, with or without the `node:` prefix), nor reference
   `fetch(`, `XMLHttpRequest`, `WebSocket` or `process.cwd`.
2. A runtime guard in the new gate script: file and network entry points are wrapped while a
   primitive draws, and any call is attributed to that primitive and fails the gate.

**Rationale**: The static rule catches code paths the gate never executes. The runtime guard
catches access through a helper or dependency, and is what lets a deliberately bad fixture
primitive be rejected by name. The prototype guard caught `led` calling `existsSync` and
`readFileSync`. It did not catch `sprite`, which only reaches the icon loader when its
character name is not a built-in, a combination the generic probe set does not produce; the
static rule covers that case.

**Alternatives considered**:

- Node's permission model: process-wide, so it would also block the gate reading its own
  sources and golden file.
- Static rule only: cannot reject a fixture defined outside `src/`, and misses indirect access.
- Runtime guard only: misses unexecuted branches, as the `sprite` case shows.

**Known limit**: access made inside native code is invisible to both layers. The canvas
library loads system fonts this way. See F1 below.

## R2. Drawing icons without file access

**Decision**: Generate every icon bitmap ahead of time into a committed data module, and make
the icon lookup a pure in-memory read. A generator script produces the data; a freshness check
in the verify suite regenerates it in memory and fails if the committed file is stale.

**Rationale**: It removes file access from drawing and removes the dependency on the working
directory (the README's first known limitation). It also moves the SVG rasteriser and the icon
font out of the runtime dependencies, leaving the canvas library as the only one.

**Evidence**:

- 1,036 icons at the two heights in use (11 rows for `led`, 14 for `sprite`) pack to about
  121 KB.
- Rasterising all of them takes about 69 ms when the rasteriser is told not to load system
  fonts, against about 117 s with its default. Output was identical on a 40-icon sample at
  both heights. So the freshness check is affordable inside `npm run verify`.
- The cost today is about 56 ms on the first draw of each icon, inside `draw`.

**Alternatives considered**:

- Load and rasterise at import time: still file access, and slow at start-up.
- A preload call the caller must make before drawing: changes the public contract and moves
  the burden to every user.
- Resolve the icon folder relative to the module instead of the working directory: fixes the
  folder problem but keeps file access inside `draw`.

**Consequences**: The icon lookup supports exactly the generated heights (11 and 14). It is
internal, not part of the public surface, and no caller uses another height. The licence
notice must say that bitmaps derived from the icon font ship in the package.

## R3. Checking "palette only"

**Decision**: A pixel complies if it lies inside the triangle formed by the background,
foreground and accent colours in RGB space, within a tolerance of 2 per channel. The gate
renders every probe layer on both backgrounds, in monochrome and with two different probe
accents (pure red and pure blue), at the three reference signal levels, alone and layered over
accent-coloured primitives.

**Rationale**: The canvas blends in byte space, so softened edges and translucent fills land
on straight lines between palette colours and stay inside the triangle. Two probe accents
mean a hard-coded hue cannot pass both. In monochrome the triangle collapses to the grey line,
which is the "works in pure black and white" rule.

**Evidence**: Across 148 probe layers, both backgrounds and three levels, every primitive
passes alone. One layered case fails: `flash` over accent colour produces the accent's
complement (for example `214,255,255` over red), because it inverts with a `difference`
blend. The hard-coded greys in `grid`, `tetris`, `led`, `sprite`, `caption` and `plasma` all
pass, as the spec's reading of the rule intends.

**Alternatives considered**:

- Exact match to the three colours: rejects every antialiased edge.
- A source rule banning colour literals: stricter than the spec's reading, would force
  rewrites of six compliant primitives and change their output.

## R4. Keeping `flash` on palette

**Decision**: Three cases when the loudness threshold is exceeded.

| Setting | Behaviour | Output change |
| --- | --- | --- |
| `reducedFlicker` on | soft foreground wash, 25% opacity | changes (`flash@loud` golden hash) |
| `reducedFlicker` off, monochrome | full inversion, as today | none, byte-identical |
| `reducedFlicker` off, accent | strong foreground wash, 85% opacity | changes (no golden case) |

**Rationale**: Inversion is exact and on-palette only when the palette is grey. A full-frame
inversion on every loud frame is the one effect in the vocabulary that ignored
`reducedFlicker`, which constitution Principle III requires it to honour. It cannot simply
skip the effect under `reducedFlicker`, as `tetris` does for its field flash, because the
gates render with `reducedFlicker` on and `flash` would then fail the reactivity gate.

**Coverage**: the existing golden cases all render with `reducedFlicker` on, so today nothing
covers the full inversion. A `flash:full` reference case is added first, with the old code, so
the "unchanged" claim is checked by a hash.

**Alternatives considered**:

- Per-pixel palette-aware inversion: about 2 million pixels of arithmetic per loud frame at
  full HD, in a primitive that today is one draw call.
- A wash in every case: simpler, but changes the full-strength monochrome output for no gain.

**Out of scope**: the interpreter's `image` layer has the same inversion. It is not a
primitive and its content is supplied by the caller.

## R5. Checking "responds to the signal"

**Decision**: Hold the frame index and time fixed and vary only the signal. For each
primitive, with its validated default layer, compare a near-silent and a loud frame, and
compare two different labels, at each of the three reference times. The primitive passes if
any comparison differs.

**Rationale**: Today's informational check compares frames taken at different times, so a
primitive that only animates with the clock looks reactive. Clarified in the spec: time does
not count as signal.

**Evidence**: Under the strict check, `caption`, `text` and `rain` pass on label. `sweep` and
`gridhorizon` fail: they depend only on time.

**Probe levels**: near-silent 0.02 and loud 0.95 for the level comparison; mid 0.5 for the
label comparison.

**Consequence (FR-022)**: `sweep` and `gridhorizon` are changed so loudness affects them.

- `sweep`: bar width scales with amplitude.
- `gridhorizon`: the sun's radius pulses with amplitude.

Both are small, single-signal changes in keeping with the style rubric. Four golden hashes
change (the quiet and loud cases of each) and are recorded as intended; the mid-level cases do not move, because both loudness factors are exactly 1 at level 0.5.

## R6. Speed budget

**Decision**: At 1920×1080, with each primitive's validated default layer and the loud
reference frame:

- Count drawing operations on the main context (`fillRect`, `strokeRect`, `clearRect`, `fill`,
  `stroke`, `fillText`, `strokeText`, `drawImage`, `putImageData`). Fail above 3,000.
- Time the draw as the median of five runs after one warm-up. Report it for every primitive.
  Fail above 50 ms.

**Rationale**: The count is exact, so it never flakes. Medians were steady within a run
(`rain` 4.39 to 4.53 ms over eight repeats) but moved about 35% between runs on the same
laptop, and a shared build machine is slower again; a 50 ms ceiling is roughly ten times the
slowest compliant primitive.

**Evidence** (operations per full-HD frame): `plasma` 32,400; `rain` 1,377; `checker` 648;
`grid` 502; `barcode` 439; `led` 330; all others lower. Only `plasma` is over.

**Known limit**: operations on an off-screen canvas created inside `draw` are not counted.
The time check covers that cost.

## R7. Bringing `plasma` within budget

**Decision**: Compute the field into a small off-screen image, one pixel per 8×8 block, and
scale it up with one nearest-neighbour draw.

**Evidence**: Byte-identical to the current output at 320×180, 1280×720, 1920×1080 and an
odd size (333×201), at all three reference levels. Operations drop from 32,400 to 1; time
drops from 22 to 30 ms down to about 1.9 ms.

**Rationale**: No golden hash moves, so this is not an intended rendering change.

**Alternatives considered**: larger blocks (28 px to get under 3,000) would visibly coarsen
the effect and change every hash.

## R8. Structure of the gates

**Decision**: One new script, `scripts/verify-gates.ts`, runs the four new gates over every
primitive and prints one result line per primitive and gate, then a summary count. Shared
probe and measurement helpers live in `scripts/lib/gateKit.ts`. The gates take a list of
primitive definitions, so the same functions run against a small set of deliberately bad
fixture primitives first, as a self-test that each rule really rejects a violation.

**Rationale**: A single script can report "N of 29 pass every gate", which separate scripts
chained with `&&` cannot. Existing scripts are not restructured; they run earlier in the same
chain, so reaching the summary means they passed.

**Alternatives considered**: one script per gate (no aggregate summary; four more entries in
the chain); adding a test framework (a new dependency for something the existing plain-script
style already handles).

## R9. Probe layers

**Decision**: For each primitive, the probes are its validated default layer plus
one-at-a-time variations: every other enum value, each boolean flipped, each number at its
minimum and maximum, and each string set to a known icon name and to an unknown name. That is
148 layers today. Purity and palette gates use all probes; reactivity and speed use the
default layer only.

**Rationale**: Derived from the registry, so new primitives are covered with no setup
(FR-003). Layers pass through `sanitizeLayer` first, because that is what a real spec goes
through.

## R10. Recording intended changes

**Decision**: A plain log, `golden/CHANGES.md`, with one entry per change to the golden file:
date, primitive, which reference cases moved or were added, and why. That includes additive
reference cases with no rendering change. Updating the golden file without a matching entry
is a review failure.

**Rationale**: Satisfies FR-019 and the constitution's rule that a golden update must say
which hashes moved and why, without new tooling.

## Findings outside this feature's scope

- **F1. Golden hashes are machine-specific.** Verified on 2026-10-01: the existing suite, run
  on the Linux build machine (ubuntu-24.04, x64), failed the golden comparison. The gate
  prints only the first eight mismatches: all three `bars` cases, all three `hbars` cases and
  two `radial` cases. None of those draws text, and all use fractional coordinates, so the
  cause is at least partly how edges are rasterised on a different processor or build of the
  canvas library, not only fonts. The full list of affected primitives is not yet known.
  Separately, text primitives use whatever font the machine substitutes for `monospace` (311
  families are registered on the reference laptop and none has that name), which is a second,
  independent source of difference. The registry and validator gates passed, two renders on
  the same machine were byte-identical, and the whole job took 17 seconds. This contradicts
  Principle I's "every machine" and needs its own spec before public build triggers are
  switched on.
- **F2. Golden cases render unvalidated layers.** The reference cases pass a bare
  `{ type }` layer, which skips defaults. For `led` and `sprite` this renders differently from
  a validated default layer, because their boolean defaults (`scroll`, `jump`) are `true`. The
  new gates use validated layers. Switching the golden cases is a separate change, since it
  moves those two primitives' reference hashes without any rendering change.
