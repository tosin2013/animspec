# Contract: Primitive Vetting Gates

What a contributor can rely on when they run `npm run verify`. This is the interface between
a primitive author and the project.

## Command

```bash
npm run verify          # everything; the only command a contributor needs
npm run verify:gates    # only the four gates in this contract
```

- Runs offline. Needs no network, database or service.
- Exit code `0` when every primitive passes every gate; non-zero otherwise.
- Same verdict on repeated runs of unchanged code.

## Rules a primitive must meet

| Gate | Rule | Checked with | Fails when |
| --- | --- | --- | --- |
| `purity` | `draw` performs no file or network access, and does not depend on the working directory | every probe layer, with file and network entry points guarded; icon layers rendered again from a different working directory; plus a static scan of `src/` | any guarded call happens during `draw`, the icon renders differ between directories, or `src/` imports an IO module or reads `process.cwd` |
| `palette` | every pixel is a mix of background, foreground and accent | every probe layer; both backgrounds; monochrome and two probe accents; three signal levels; alone and layered over accent colour | any pixel falls outside the palette triangle by more than 2 per channel |
| `reactivity` | output changes with the signal at a fixed moment | the default layer at three fixed times; near-silent against loud; one label against another | every comparison is identical |
| `budget` | cheap enough to layer | the default layer at 1920×1080 on a loud frame | more than 3,000 drawing operations, or more than 50 ms |

**A whole composition has its own budget** (added in 0.4.0, issue #93). The `composition`
gate draws four specs at the validator's 12-layer cap through the interpreter, at 1920×1080
on the loud frame: the two 12-layer reference composites, the dark one under a parallax
camera, and the twelve primitives with the most drawing operations stacked together. It
fails when any case exceeds 12,000 drawing operations (exact) or 200 ms (median of five).

**grid's solid mode is checked exactly** (added in 0.4.0, issue #98): with `solid: true`
every pixel must be exactly the background, foreground or accent, with no mix.

**Clock movement is not reactivity.** A primitive that only animates with time fails
`reactivity`.

**Text counts as signal.** A primitive whose picture depends on the label passes
`reactivity` on that basis.

**Shades of grey are palette colours.** Softened edges, translucent fills and greys between
background and foreground pass `palette`.

## Output

One line per failing result, then a per-gate tally, then the summary.

Example with two failing primitives (counts as of 0.4.0, 38 primitives):

```text
vetting gates (38 primitives, 331 probes)
  ok    icon data is up to date
  ok    fixtures: each gate rejects its rule-breaking fixtures (5/5)
  ok    grid solid: every pixel is exactly bg, fg or accent
  FAIL  budget      plasma   32400 ops (allowed ≤ 3000) — default layer, 1920x1080, loud
  FAIL  palette     flash    pixel 214,255,255 (allowed: mix of bg/fg/accent) — layered, black bg, accent red, loud
  ok    purity      38/38
  FAIL  palette     37/38
  ok    reactivity  38/38
  FAIL  budget      37/38
  info  time per 1080p frame (ms): rain 4.5, plasma 4.2, grid 2.8, ...
  info  drawing operations per 1080p frame: rain 1377, checker 648, grid 502, ...
  ok    composition 4/4  (≤ 12000 ops, ≤ 200 ms per 1080p frame)
  info  composition per 1080p frame: composite:layers12-dark 3044 ops 14.4 ms; ...

36/38 primitives pass every gate
vetting gates FAILED (2 result(s))
```

On success the last two lines are `N/N primitives pass every gate` (38/38 as of 0.4.0) and
`vetting gates passed`.

**Guarantees about the output**:

- A failing line always names the gate, the primitive, what was measured, what is allowed,
  and the case that produced it.
- The time of every primitive is printed on every run, pass or fail.
- The summary count is the number of primitives with no failing result across all four gates.

## Fixture self-test

Before judging real primitives, each gate is run against its deliberately rule-breaking
fixtures (one each, two for `purity`: a file read and a network connection). Guarded network
calls are recorded and blocked, never forwarded, so the suite stays offline. If a gate fails to reject its fixture, the run fails with:

```text
  FAIL  fixtures: <gate> did not reject <fixture>
```

This is what makes a passing run meaningful.

## Adding a primitive

No registration with the gates is needed. A new registry entry is picked up automatically,
and its probes are derived from its declared params.

## Changing what a primitive draws

1. Run `npm run golden:update`.
2. Add an entry to `golden/CHANGES.md` naming the primitive, the cases that moved, and why.

Adding a reference case without changing any rendering follows the same two steps.

A golden update without a matching entry is rejected in review.

## Not covered by these gates

- File access made inside native code, such as the canvas library loading system fonts.
- Whether `reducedFlicker` is honoured. That is checked in review.
- Whether reference hashes match on a different machine. They currently do not on the Linux
  build machine; see `specs/ROADMAP.md`.
- Drawing operations on an off-screen canvas created inside `draw` (covered by time only).
- Behaviour at maximum param values for `reactivity` and `budget`.
- The human style review.
