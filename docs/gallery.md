---
title: Gallery
---

One card per primitive, every frame drawn by the committed library from the
same fixed seed while the signal sweeps quiet to loud and back. The
[vocabulary page](/vocabulary) carries the full param tables: each card here
is a picture and a name, the vocabulary is the reference.

Vocabulary version 19 · 43 primitives ·
rendered with `npm run loops:generate`

<div class="cards">
  <figure class="card">
    <img src="/loops/grid.gif" alt="grid: matrix grid of cells lit by the frequency spectrum, or drawn from a `pattern` of rows split by / (. off, # fg, a accent, ~ spectrum); `breaks` like '3,2 r15; 5,1 dx0.5' rotate or shift single cells" loading="lazy">
    <figcaption>
      <h3>grid<span class="tier">core</span></h3>
      <p>matrix grid of cells lit by the frequency spectrum, or drawn from a `pattern` of rows split by / (. off, # fg, a accent, ~ spectrum); `breaks` like '3,2 r15; 5,1 dx0.5' rotate or shift single cells</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/barcode.gif" alt="barcode: dense scrolling vertical barcode of the signal" loading="lazy">
    <figcaption>
      <h3>barcode<span class="tier">core</span></h3>
      <p>dense scrolling vertical barcode of the signal</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/checker.gif" alt="checker: a checkerboard whose squares flip with the spectrum, or follow a `pattern` of rows split by / tiled across the squares (. off, # fg, a accent, ~ spectrum); `breaks` like '3,2 r15; 5,1 dx0.5' rotate or shift single squares" loading="lazy">
    <figcaption>
      <h3>checker<span class="tier">core</span></h3>
      <p>a checkerboard whose squares flip with the spectrum, or follow a `pattern` of rows split by / tiled across the squares (. off, # fg, a accent, ~ spectrum); `breaks` like '3,2 r15; 5,1 dx0.5' rotate or shift single squares</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/dither.gif" alt="dither: an ordered (Bayer) dither gradient through up to six palette roles in a rectangular region — dithered skies, ground, props and UI bars for DOS/VGA-style scenes; exact colours, no blending" loading="lazy">
    <figcaption>
      <h3>dither<span class="tier">contrib</span></h3>
      <p>an ordered (Bayer) dither gradient through up to six palette roles in a rectangular region — dithered skies, ground, props and UI bars for DOS/VGA-style scenes; exact colours, no blending</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/image.gif" alt="image: a declared image asset (spec `assets`: id + sha256), placed, fitted, cropped, flipped, faded and optionally tiled and scrolled for backgrounds and parallax; in the art's own colours in creative mode, or mapped to the palette; nearest-sampled at whole pixels in pixel mode" loading="lazy">
    <figcaption>
      <h3>image<span class="tier">contrib</span></h3>
      <p>a declared image asset (spec `assets`: id + sha256), placed, fitted, cropped, flipped, faded and optionally tiled and scrolled for backgrounds and parallax; in the art's own colours in creative mode, or mapped to the palette; nearest-sampled at whole pixels in pixel mode</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/bars.gif" alt="bars: vertical magnitude-spectrum bars; whole pixels in pixel mode" loading="lazy">
    <figcaption>
      <h3>bars<span class="tier">core</span></h3>
      <p>vertical magnitude-spectrum bars; whole pixels in pixel mode</p>
      <p class="meta">signal-bars · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/hbars.gif" alt="hbars: horizontal magnitude bars growing from the left edge; whole pixels in pixel mode" loading="lazy">
    <figcaption>
      <h3>hbars<span class="tier">core</span></h3>
      <p>horizontal magnitude bars growing from the left edge; whole pixels in pixel mode</p>
      <p class="meta">signal-bars · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/versus-bars.gif" alt="versus-bars: two opposed arcade health bars with damage tails, read from the frame's coords (coords[0] left, coords[1] right: x = health, y = damage tail, 0..1); without coords they show the low and high spectrum halves; whole-pixel edges, angled ends as pixel steps" loading="lazy">
    <figcaption>
      <h3>versus-bars<span class="tier">contrib</span></h3>
      <p>two opposed arcade health bars with damage tails, read from the frame's coords (coords[0] left, coords[1] right: x = health, y = damage tail, 0..1); without coords they show the low and high spectrum halves; whole-pixel edges, angled ends as pixel steps</p>
      <p class="meta">signal-bars · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/radial.gif" alt="radial: a circular/polar spectrum radiating from the center" loading="lazy">
    <figcaption>
      <h3>radial<span class="tier">core</span></h3>
      <p>a circular/polar spectrum radiating from the center</p>
      <p class="meta">signal-bars · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/wave.gif" alt="wave: an oscilloscope/seismograph line of the signal" loading="lazy">
    <figcaption>
      <h3>wave<span class="tier">core</span></h3>
      <p>an oscilloscope/seismograph line of the signal</p>
      <p class="meta">signal-line · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/lissajous.gif" alt="lissajous: a Lissajous curve traced from the waveform" loading="lazy">
    <figcaption>
      <h3>lissajous<span class="tier">core</span></h3>
      <p>a Lissajous curve traced from the waveform</p>
      <p class="meta">signal-line · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/particles.gif" alt="particles: a rotating ring of squares sized by the spectrum; whole pixels in pixel mode" loading="lazy">
    <figcaption>
      <h3>particles<span class="tier">core</span></h3>
      <p>a rotating ring of squares sized by the spectrum; whole pixels in pixel mode</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/orbits.gif" alt="orbits: concentric counter-rotating rings of points" loading="lazy">
    <figcaption>
      <h3>orbits<span class="tier">core</span></h3>
      <p>concentric counter-rotating rings of points</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/dots.gif" alt="dots: a scattered star-field of points keyed to the spectrum (deterministic)" loading="lazy">
    <figcaption>
      <h3>dots<span class="tier">core</span></h3>
      <p>a scattered star-field of points keyed to the spectrum (deterministic)</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/shape.gif" alt="shape: a reactive polygon at center, radius pulsing with amplitude" loading="lazy">
    <figcaption>
      <h3>shape<span class="tier">core</span></h3>
      <p>a reactive polygon at center, radius pulsing with amplitude</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/rings.gif" alt="rings: concentric expanding circles that pulse with the beat; whole pixels in pixel mode" loading="lazy">
    <figcaption>
      <h3>rings<span class="tier">core</span></h3>
      <p>concentric expanding circles that pulse with the beat; whole pixels in pixel mode</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/spiral.gif" alt="spiral: a spiral of points winding out from the center" loading="lazy">
    <figcaption>
      <h3>spiral<span class="tier">core</span></h3>
      <p>a spiral of points winding out from the center</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/scan.gif" alt="scan: sweeping scanlines revealed where the signal is high" loading="lazy">
    <figcaption>
      <h3>scan<span class="tier">core</span></h3>
      <p>sweeping scanlines revealed where the signal is high</p>
      <p class="meta">motion · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/flash.gif" alt="flash: a full-frame flash/invert on loud moments (beat)" loading="lazy">
    <figcaption>
      <h3>flash<span class="tier">core</span></h3>
      <p>a full-frame flash/invert on loud moments (beat)</p>
      <p class="meta">motion · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/sweep.gif" alt="sweep: a bright vertical bar sweeping across the frame" loading="lazy">
    <figcaption>
      <h3>sweep<span class="tier">core</span></h3>
      <p>a bright vertical bar sweeping across the frame</p>
      <p class="meta">motion · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/noise.gif" alt="noise: deterministic seeded digital noise gated by energy" loading="lazy">
    <figcaption>
      <h3>noise<span class="tier">core</span></h3>
      <p>deterministic seeded digital noise gated by energy</p>
      <p class="meta">motion · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/caption.gif" alt="caption: a closed-caption box of the active text/label, with optional case, box style and position" loading="lazy">
    <figcaption>
      <h3>caption<span class="tier">core</span></h3>
      <p>a closed-caption box of the active text/label, with optional case, box style and position</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/rain.gif" alt="rain: Matrix-style digital rain of the active text characters" loading="lazy">
    <figcaption>
      <h3>rain<span class="tier">core</span></h3>
      <p>Matrix-style digital rain of the active text characters</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/text.gif" alt="text: the active label as large centered text" loading="lazy">
    <figcaption>
      <h3>text<span class="tier">core</span></h3>
      <p>the active label as large centered text</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/crosshair.gif" alt="crosshair: a coordinate crosshair + numeric read-out (data-screen)" loading="lazy">
    <figcaption>
      <h3>crosshair<span class="tier">core</span></h3>
      <p>a coordinate crosshair + numeric read-out (data-screen)</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/led.gif" alt="led: an LED dot-matrix sign: scrolling text or a named pixel icon (car, coffee, heart, home, music, ...), with an animated effect that reacts to the audio (glow/pulse/blink/equalize/sparkle/wipe)" loading="lazy">
    <figcaption>
      <h3>led<span class="tier">core</span></h3>
      <p>an LED dot-matrix sign: scrolling text or a named pixel icon (car, coffee, heart, home, music, ...), with an animated effect that reacts to the audio (glow/pulse/blink/equalize/sparkle/wipe)</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/sprite.gif" alt="sprite: an animated chunky-pixel character (built-in mascot/bot/ghost, or any named pixel icon) that walks/bounces/orbits, faces its direction of travel, switches to an idle/jump pose, and hops on the beat — a composable actor, quantizes with the retro palette; `hero` is a 16-bit-era character whose parts (outline, hair, hair-light, skin, eyes, gold, cloak, cloak-shade, tunic, boots) take colours from the spec's `roles` in creative mode" loading="lazy">
    <figcaption>
      <h3>sprite<span class="tier">extended</span></h3>
      <p>an animated chunky-pixel character (built-in mascot/bot/ghost, or any named pixel icon) that walks/bounces/orbits, faces its direction of travel, switches to an idle/jump pose, and hops on the beat — a composable actor, quantizes with the retro palette; `hero` is a 16-bit-era character whose parts (outline, hair, hair-light, skin, eyes, gold, cloak, cloak-shade, tunic, boots) take colours from the spec's `roles` in creative mode</p>
      <p class="meta">sprite · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/rig.gif" alt="rig: a layered cut-out character (head, eyes, mouth, torso, arms) in a built-in vector rig — host, bot or cel — posed by named scalars, with the mouth driven by the signal for talking hosts and characters" loading="lazy">
    <figcaption>
      <h3>rig<span class="tier">contrib</span></h3>
      <p>a layered cut-out character (head, eyes, mouth, torso, arms) in a built-in vector rig — host, bot or cel — posed by named scalars, with the mouth driven by the signal for talking hosts and characters</p>
      <p class="meta">sprite · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/tetris.gif" alt="tetris: a Game Boy-style tetromino playfield: a stacked block terrain and falling pieces that speed up with the beat — pairs with the gameboy palette" loading="lazy">
    <figcaption>
      <h3>tetris<span class="tier">extended</span></h3>
      <p>a Game Boy-style tetromino playfield: a stacked block terrain and falling pieces that speed up with the beat — pairs with the gameboy palette</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/mesh3d.gif" alt="mesh3d: a rotating 3D wireframe projected to the 2D canvas: a spectrum terrain (waterfall) or a point-cloud globe (uses map coords when present) — driven by the signal" loading="lazy">
    <figcaption>
      <h3>mesh3d<span class="tier">core</span></h3>
      <p>a rotating 3D wireframe projected to the 2D canvas: a spectrum terrain (waterfall) or a point-cloud globe (uses map coords when present) — driven by the signal</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/plasma.gif" alt="plasma: a flowing demoscene plasma field (grayscale; colorize with a palette such as neon or pico8)" loading="lazy">
    <figcaption>
      <h3>plasma<span class="tier">extended</span></h3>
      <p>a flowing demoscene plasma field (grayscale; colorize with a palette such as neon or pico8)</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/gridhorizon.gif" alt="gridhorizon: a Tron/synthwave perspective grid receding to a horizon with a sun — pairs with the neon palette" loading="lazy">
    <figcaption>
      <h3>gridhorizon<span class="tier">extended</span></h3>
      <p>a Tron/synthwave perspective grid receding to a horizon with a sun — pairs with the neon palette</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/tunnel.gif" alt="tunnel: a rotating demoscene tunnel: concentric rings rushing outward with rotating spokes" loading="lazy">
    <figcaption>
      <h3>tunnel<span class="tier">extended</span></h3>
      <p>a rotating demoscene tunnel: concentric rings rushing outward with rotating spokes</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/graph.gif" alt="graph: a directed network of nodes and edges with packet pulses travelling along the signal" loading="lazy">
    <figcaption>
      <h3>graph<span class="tier">contrib</span></h3>
      <p>a directed network of nodes and edges with packet pulses travelling along the signal</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/spectrum.gif" alt="spectrum: a labeled semantic axis: two pole labels, an optional title, and a marker the signal positions" loading="lazy">
    <figcaption>
      <h3>spectrum<span class="tier">contrib</span></h3>
      <p>a labeled semantic axis: two pole labels, an optional title, and a marker the signal positions</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/diagram-build.gif" alt="diagram-build: a labeled node-and-edge diagram built stepwise on a deterministic frame schedule, from frame coords/labels" loading="lazy">
    <figcaption>
      <h3>diagram-build<span class="tier">contrib</span></h3>
      <p>a labeled node-and-edge diagram built stepwise on a deterministic frame schedule, from frame coords/labels</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/chapter-card.gif" alt="chapter-card: an editorial title card — kicker, rule, title and optional subtitle — with a deterministic fade/hold rhythm" loading="lazy">
    <figcaption>
      <h3>chapter-card<span class="tier">contrib</span></h3>
      <p>an editorial title card — kicker, rule, title and optional subtitle — with a deterministic fade/hold rhythm</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/type-reveal.gif" alt="type-reveal: kinetic text reveal: the layer's own words (or lines) appear one by one on a frame schedule and then hold, with an optional accent emphasis span" loading="lazy">
    <figcaption>
      <h3>type-reveal<span class="tier">contrib</span></h3>
      <p>kinetic text reveal: the layer's own words (or lines) appear one by one on a frame schedule and then hold, with an optional accent emphasis span</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/hud-score.gif" alt="hud-score: arcade HUD read-outs from the frame's labels: shooter = 1UP score, HI-SCORE and CREDIT (labels: score, hi-score, credits); versus = a centre timer and two names (labels: timer, left, right); the emphasised item inverts on loud frames" loading="lazy">
    <figcaption>
      <h3>hud-score<span class="tier">contrib</span></h3>
      <p>arcade HUD read-outs from the frame's labels: shooter = 1UP score, HI-SCORE and CREDIT (labels: score, hi-score, credits); versus = a centre timer and two names (labels: timer, left, right); the emphasised item inverts on loud frames</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/ticker.gif" alt="ticker: a scrolling news ticker: the frame's labels joined by separators, scrolling right to left in one band; the item crossing the centre turns accent when the signal is loud (`led` scrolls dot-matrix text instead)" loading="lazy">
    <figcaption>
      <h3>ticker<span class="tier">contrib</span></h3>
      <p>a scrolling news ticker: the frame's labels joined by separators, scrolling right to left in one band; the item crossing the centre turns accent when the signal is loud (`led` scrolls dot-matrix text instead)</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/quote-card.gif" alt="quote-card: a centered quotation with an attribution line beneath it and an optional thin rule — the quote revealing word by word, the attribution appearing once it completes" loading="lazy">
    <figcaption>
      <h3>quote-card<span class="tier">contrib</span></h3>
      <p>a centered quotation with an attribution line beneath it and an optional thin rule — the quote revealing word by word, the attribution appearing once it completes</p>
      <p class="meta">text · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/emitter.gif" alt="emitter: a seeded particle emitter: petals, sparks, dust, snow or embers spawn from an edge or the centre and fall, drift or burst on the signal — a stateless closed form, so any frame renders alone; opaque whole-pixel squares in pixel mode" loading="lazy">
    <figcaption>
      <h3>emitter<span class="tier">contrib</span></h3>
      <p>a seeded particle emitter: petals, sparks, dust, snow or embers spawn from an edge or the centre and fall, drift or burst on the signal — a stateless closed form, so any frame renders alone; opaque whole-pixel squares in pixel mode</p>
      <p class="meta">geometry · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/loops/figure.gif" alt="figure: minimal schematic human silhouettes in a row, cluster or split arrangement — stand, walk, sit, point, fallen or grouped — with a highlightable figure and staggered reveal, for thought-experiment staging" loading="lazy">
    <figcaption>
      <h3>figure<span class="tier">contrib</span></h3>
      <p>minimal schematic human silhouettes in a row, cluster or split arrangement — stand, walk, sit, point, fallen or grouped — with a highlightable figure and staggered reveal, for thought-experiment staging</p>
      <p class="meta">structure · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>
    </figcaption>
  </figure>
</div>
