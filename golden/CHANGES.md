# Golden-file intended changes

Every intended change to a reference set under `golden/<type>/` needs an entry here — moved hashes and added
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
| 2026-10-01 | caption, rain, text, crosshair, led | caption@*, rain@*, text@*, crosshair@*, led@*, composite:grid+wave+caption@*, composite:creative-accent@*, icon:led-unknown@* (24 changed) | text now drawn with the shipped default font, not a machine font | 002 | both |
| 2026-10-01 | caption | text:missing-glyphs (3 added) | guards that characters a font lacks never fall back to a machine font | 002 | both |
| 2026-10-01 | caption, rain, text, crosshair, led | font:* (30 added) | reference cases for each non-default shipped font | 002 | both |
| 2026-10-01 | led, sprite | led@quiet, led@mid, led@loud, sprite@loud | reference cases now use validated default layers; no rendering change | 002 | both |
| 2026-10-01 | multiple (12-layer composites) | composite:layers12-* (6 added) | cross-type tolerance checked at the maximum layer count | 002 | both |
