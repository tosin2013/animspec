# Data Model: Complete the Primitive Vetting Gates

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Nothing here is persisted except the icon data module, the golden file and the change log.
The rest are in-memory shapes inside the gate script.

## Probe layer

One layer handed to a primitive during a gate run.

| Field | Meaning |
| --- | --- |
| `type` | The primitive under test |
| params | The primitive's declared params, after `sanitizeLayer` |
| `variation` | Which param was varied, or `default` |

**Derivation** (from the registry, no per-primitive setup):

- the validated default layer;
- for each enum param, one layer per non-default value;
- for each boolean param, one layer with the value flipped;
- for each number param, one layer at its minimum and one at its maximum;
- for each string param, one layer with a known icon name and one with an unknown name.

**Rules**: every probe passes through `sanitizeLayer`. Purity and palette gates use all
probes. Reactivity and speed gates use the default probe only.

## Signal probe

A fixed set of `SignalFrame`s built in closed form, so they are reproducible anywhere.

| Field | Values |
| --- | --- |
| time point | the three reference times already used by the golden cases (index 0, 12, 47) |
| level | near-silent (0.02), mid (0.5) or loud (0.95); scales values, spectrum, amplitude and energy |
| label | one of two fixed strings |
| coords | three fixed positions, the same in every probe |

**Rule**: within one comparison, the time point is the same on both sides. Only level or only
label differs. Level comparisons use near-silent against loud; label comparisons are made at
the mid level.

## Palette probe

| Field | Values |
| --- | --- |
| background | black or white (foreground is the other) |
| mode | monochrome (accent equals foreground), accent red, accent blue |
| composition | the probe alone, or layered over two accent-coloured primitives |

**Rule**: a pixel complies if it lies inside the triangle of background, foreground and
accent in RGB space, within 2 per channel.

## Speed measurement

| Field | Meaning |
| --- | --- |
| `operations` | count of drawing calls on the main context for one frame |
| `milliseconds` | median of five draws after one warm-up |

**Conditions**: 1920×1080, default probe, loud signal at the last reference time.
**Limits**: operations at most 3,000 (blocking); time at most 50 ms (blocking); time is
always reported.

## Gate result

One per primitive per gate.

| Field | Meaning |
| --- | --- |
| `primitive` | the primitive's type |
| `gate` | `purity`, `palette`, `reactivity` or `budget` |
| `pass` | boolean |
| `measured` | what was observed, e.g. `32400 ops`, `pixel 214,255,255`, `readFileSync` |
| `allowed` | the limit or rule, e.g. `≤ 3000 ops`, `mix of bg/fg/accent` |
| `case` | the probe and conditions that produced the failure |

**Aggregation**: a primitive passes if all four of its results pass. The run reports
`passed / total` and exits non-zero if any result fails.

## Fixture primitive

A deliberately rule-breaking primitive definition, at least one per gate, kept outside `src/`.

| Fixture | Breaks |
| --- | --- |
| reads a file in `draw` | purity |
| opens a network connection in `draw` | purity |
| paints a fixed off-palette colour | palette |
| ignores every signal input | reactivity |
| issues tens of thousands of operations | budget |

**Rule**: the self-test fails the run if any fixture is not rejected by its own gate.

## Icon data (persisted, generated)

`src/primitives/iconData.ts`.

| Field | Meaning |
| --- | --- |
| name | icon name, lower case |
| height | 11 or 14 |
| width | bitmap width in cells |
| bits | the bitmap, row-major, packed |

**Rules**: generated only by the generator script; never edited by hand; carries a header
saying so. The freshness check regenerates in memory and compares. Custom icons in
`customIcons.ts` are separate and still take precedence over a generated icon of the same
name.

## Reference output (persisted, existing)

`golden/hashes.json`: case key to SHA-256 of raw RGBA. This feature adds 12 icon cases and 3
full-strength flash cases, and moves seven existing entries: `sweep@*`, `gridhorizon@*` and
`flash@loud`. No other existing entry may change. A case may carry its own `reducedFlicker`
value; the default stays on.

## Intended-change record (persisted, new)

`golden/CHANGES.md`, one entry per change to the golden file, including added cases.

| Field | Meaning |
| --- | --- |
| date | ISO date |
| primitive | the primitive's type |
| cases | which reference cases moved or were added |
| reason | one sentence |
| spec | the feature that required it |
