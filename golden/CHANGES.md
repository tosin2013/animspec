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
| 2026-10-11 | graph | graph@quiet, graph@mid, graph@loud (3 added) | new graph primitive added: directed node/edge network with packet pulses | — | both |
| 2026-10-12 | spectrum | spectrum@quiet, spectrum@mid, spectrum@loud (3 added) | new spectrum primitive added: labeled semantic axis with a signal-positioned marker | — | both |
| 2026-10-17 | diagram-build | diagram-build@quiet, diagram-build@mid, diagram-build@loud (3 added) | new diagram-build primitive added: labeled node-and-edge diagram revealed stepwise from frame coords/labels | — | both |
| 2026-10-17 | chapter-card | chapter-card@quiet, chapter-card@mid, chapter-card@loud (3 added) | new chapter-card primitive added: editorial title card with a deterministic fade/hold rhythm | — | both |
| 2026-10-18 | caption | caption:asis-outline-bottom@*, caption:upper-none-top@*, caption:asis-solid-center-1@*, caption:maxlines-2@*, caption:white-bg@* (15 added) | reference cases for the non-default caption styles (case/box/position/maxLines) added in PR #48, so a later change cannot alter them silently; caption:white-bg pins the palette.bg/fg change from that PR — captions under a non-default palette now colour from the palette (Principle III) instead of literal black/white | — | both |
| 2026-10-18 | type-reveal | type-reveal@quiet, type-reveal@mid, type-reveal@loud (changed from blank to label reveal), type-reveal:mid-sentence@*, type-reveal:complete-hold@*, type-reveal:lines-left@* (9 added) | new type-reveal primitive added: sequential word/line text reveal with an accent emphasis span; default layer reveals the active label, named cases pin the schedule, hold, emphasis and line mode (spec 012, issue #23) | 012 | both |
