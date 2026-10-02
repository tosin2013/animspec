# Golden-file intended changes

Every intended change to `golden/hashes.json` needs an entry here — moved hashes and added
reference cases alike. One row per change. A golden update without a matching entry is
rejected in review.

| date | primitive | cases | reason | spec | set |
|------|-----------|-------|--------|------|-----|
| 2026-10-01 | led, sprite | icon:* (12 added) | reference cases added to prove icon output is unchanged by the loader rewrite; no rendering change | 001 | arm64 |
| 2026-10-01 | flash | flash:full (3 added) | reference case added so the full-strength inversion is covered before flash is changed; no rendering change | 001 | arm64 |
| 2026-10-01 | flash | flash@loud | now honours reducedFlicker with a soft wash; full-strength accent mode washes instead of inverting, which produced the accent's complement | 001 | arm64 |
| 2026-10-01 | sweep | sweep@quiet, sweep@loud | moved only with the clock; bar width now follows loudness. sweep@mid is unchanged because the width factor is exactly 1 at the mid level | 001 | arm64 |
| 2026-10-01 | gridhorizon | gridhorizon@quiet, gridhorizon@loud | moved only with the clock; the sun's radius now follows loudness. gridhorizon@mid is unchanged because the radius factor is exactly 1 at the mid level | 001 | arm64 |
| 2026-10-01 | all | x64 set recorded for the first time; frames stored for both sets | one reference set per processor type; no rendering change | 002 | both |
