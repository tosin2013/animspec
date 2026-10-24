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
| 2026-10-18 | quote-card | quote-card@quiet, quote-card@mid, quote-card@loud, quote-card:reveal-rule@*, quote-card:no-rule-static@* (9 added) | new quote-card primitive added: centered quotation with attribution line, optional rule and an optional word-by-word reveal (issue #26) | — | both |
| 2026-10-18 | rig | rig@quiet, rig@mid, rig@loud, rig:bot-talking@*, rig:cel-cheer@*, rig:host-shrug-none@* (12 added) | new rig primitive added: layered cut-out character (host/bot/cel rigs) posed by named scalars with a signal-driven mouth (issue #68) | — | both |
| 2026-10-18 | emitter | emitter@quiet, emitter@mid, emitter@loud, emitter:petals-top@*, emitter:embers-burst@*, emitter:sparks-center@* (12 added) | new emitter primitive added: seeded closed-form particle system (petal/spark/dust/snow/ember) with sources, ballistic motion, energy-driven density and an energy-threshold burst (issue #69) | — | both |
| 2026-10-18 | figure | figure@quiet, figure@mid, figure@loud, figure:split-highlight@*, figure:row-walking@*, figure:fallen-outline@*, figure:reveal@* (15 added) | new figure primitive added: schematic human silhouettes in row/cluster/split arrangements with stances, accent highlight and staggered reveal (issue #70) | — | both |
| 2026-10-23 | rig | rig:host-wave@*, rig:host-present@*, rig:bot-reach@* (9 added) | vocabulary 12: the wave, present and reach poses (issue #89); existing rig cases unchanged | — | both |
| 2026-10-23 | figure | figure:offset-small@*, figure:row-wave@*, figure:cluster-cheer@* (9 added) | vocabulary 12: x, y and scale params (issue #88) and the wave and cheer stances (issue #89); defaults reproduce the existing figure cases | — | both |
| 2026-10-23 | grid | grid:solid@*, grid:solid-gridlines@* (6 added) | vocabulary 12: the solid param, lit cells at full opacity on whole pixels (issue #98); the default path is unchanged | — | both |
| 2026-10-23 | rings, shape, radial, lissajous, graph, wave | rings:thick@*, shape:thick@*, radial:thick@*, lissajous:thick@*, graph:thick@*, wave:thick@* (18 added) | vocabulary 12: the thickness param in pixels, defaulting to each primitive's earlier fixed width; wave's thickness maximum raised from 8 to 32 (issue #99) | — | both |
| 2026-10-23 | camera (spec-level) | camera:shake-static@* (3 added) | camera shake on a static camera over grid and wave: seeded, closed-form in frame.t (issue #87); no existing case moved | 016 | both |
| 2026-10-23 | camera (spec-level) | camera:parallax-shake@* (3 added) | camera shake under parallax: gridhorizon at depth 0 stays still, figure at depth 1 shakes by the full amount (issue #87) | 016 | both |
| 2026-10-23 | camera (spec-level) | camera:pan-wide@* (3 added) | a pan from x 0.5 to x 1.5, past the old 0..1 range (issue #111); in-range cameras unchanged | 016 | both |
| 2026-10-23 | background (spec-level) | background:transparent-light@* (3 added) | transparent background, light ink, over grid, wave and figure: the black lifted out to alpha (issue #100); no existing case moved | 017 | both |
| 2026-10-23 | background (spec-level) | background:transparent-dark@* (3 added) | transparent background, dark ink, same layers: the white lifted out to alpha (issue #100) | 017 | both |
| 2026-10-23 | background (spec-level) | background:transparent-accent@* (3 added) | transparent background, light ink, with an accent in creative mode; cross-type checked under constitution 3.0.0 (non-opaque pixels compared by colour weighted by alpha) | 017 | both |
| 2026-10-23 | grid | grid:pattern-quilt@* (3 added) | vocabulary 13: the `pattern` param draws the 7 × 5 quilt from issue #96, empty cells empty; the default (no pattern) is unchanged | 018 | both |
| 2026-10-23 | grid | grid:pattern-solid@* (3 added) | the quilt with `solid` and an accent in creative mode: every pixel bg, fg or accent (#96) | 018 | both |
| 2026-10-23 | grid | grid:pattern-breaks@* (3 added) | the solid quilt broken once: cell 3,2 turned 15°, cell 0,4 shifted a quarter cell, filled row by row (issue #101) | 018 | both |
| 2026-10-23 | checker | checker:pattern@* (3 added) | vocabulary 13: a 2 × 2 `pattern` (# a / ~ .) tiled across the squares; the default is unchanged | 018 | both |
