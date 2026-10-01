# Contract: Reference Frames, Verify and Refresh

What a contributor and a maintainer can rely on.

## The promise

| Situation | Guarantee |
| --- | --- |
| Same spec, signal and seed, on two machines of the same processor type | byte-identical frames |
| Same spec, signal and seed, on arm64 and on x64 | every colour channel of every pixel within 8 out of 255 |
| Any other processor type, or Windows | no guarantee; reported as unsupported |

The operating system is not part of the promise: macOS and Linux agree on the same processor
type. Intel Macs and musl-based Linux are assumed to agree and are not verified.

## Verify

```bash
npm run verify
```

- Offline. No network, no container.
- Detects the machine's processor type itself.

**What the determinism gate checks**:

| Check | Compares | Fails when |
| --- | --- | --- |
| exact | local renders against `golden/<this type>/hashes.json` | any hash differs, a case is missing, or a stale case exists |
| cross-type | local renders against `golden/<other type>/frames/*.png` | any channel of any pixel differs by more than 8 |
| stable | two renders in the same run | they differ |
| set consistency | both sets | their case keys differ, or a stored frame does not match its stored hash |

**Output on success**:

```text
  ok    reference set: arm64
  ok    two renders are byte-identical (150 cases)
  ok    hashes match golden/arm64
  ok    within tolerance of x64 (largest difference 5 of 255, allowed 8)
```

**Output on failure**: the set is named and every mismatching case is listed.

```text
  FAIL  hashes match golden/x64 — 3 case(s): bars@quiet, bars@mid, bars@loud
  FAIL  within tolerance of arm64 — radial@loud differs by 11 of 255 (allowed 8)
```

**On an unsupported processor type, or on Windows**:

```text
  FAIL  no reference set for processor type "riscv64" — exact comparison not made
  info  largest difference from arm64: 6 of 255; from x64: 2 of 255
```

## Refresh

```bash
npm run golden:update
```

For maintainers, after an intended rendering change.

- Renders the native set directly and the other set in a container for the other processor
  type. Needs Docker; the first run needs the network.
- Writes both sets to a temporary directory, runs the cross-type check on them, and only then
  replaces `golden/arm64` and `golden/x64` together.
- Prints which cases changed, per set.
- If Docker is unavailable, the container fails, or the cross-type check fails, it stops with
  an explanation and changes nothing under `golden/`.

```text
golden:update
  arm64 (native)      150 cases   3 changed: sweep@quiet, sweep@mid, sweep@loud
  x64 (container)     150 cases   3 changed: sweep@quiet, sweep@mid, sweep@loud
  cross-type          largest difference 5 of 255 (allowed 8)
  replaced golden/arm64 and golden/x64
  next: add an entry to golden/CHANGES.md
```

After a refresh, add an entry to `golden/CHANGES.md` naming the primitive, the cases, the set
(`arm64`, `x64` or `both`) and the reason.

## What moves a reference frame

| Change | Effect |
| --- | --- |
| a primitive's drawing code | that primitive's cases, usually in both sets |
| upgrading the canvas library | potentially any case; treat as a rendering change |
| replacing a font file | every text case in that font |
| adding a primitive, font or composite | new cases in both sets; existing ones unchanged |

## The automated build

One workflow, one job, on x64 Linux. It runs `npm run verify` and nothing else. It passes on
unchanged code. arm64 is verified on developer machines.
