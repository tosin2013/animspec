---
title: Showcase
---

# Showcase

The [gallery](/gallery) draws every primitive with its default params. This page shows what
the defaults hide: params and spec options added since, each drawn by the committed library
from the spec under its picture (seed 12345). Moving examples loop one second at 30 frames
per second; transparent examples sit on a checkerboard so the alpha is visible.

Rendered with `npm run showcase:generate`

## Added in 0.8.0

<div class="cards">
  <figure class="card">
    <img src="/showcase/shot-list.gif" alt="Shot list" loading="lazy">
    <figcaption>
      <h3>Shot list</h3>
      <p>A <code>sequence</code> of four clips in one spec: a title, a dithered night scene (wipe in), the hero (iris in) and an end card (fade in). Each clip animates from its own first frame; any frame renders alone.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;roles&quot;: {
  &quot;boots&quot;: &quot;#5a3418&quot;,
  &quot;cloak&quot;: &quot;#2d4a8c&quot;,
  &quot;cloak-shade&quot;: &quot;#1a2c55&quot;,
  &quot;eyes&quot;: &quot;#1e6b3a&quot;,
  &quot;gold&quot;: &quot;#e0b030&quot;,
  &quot;hair&quot;: &quot;#8a4a20&quot;,
  &quot;hair-light&quot;: &quot;#d08850&quot;,
  &quot;outline&quot;: &quot;#201010&quot;,
  &quot;skin&quot;: &quot;#f0c8a0&quot;,
  &quot;tunic&quot;: &quot;#a02828&quot;,
  &quot;s0&quot;: &quot;#000014&quot;,
  &quot;s1&quot;: &quot;#281444&quot;,
  &quot;s2&quot;: &quot;#6c3468&quot;,
  &quot;d0&quot;: &quot;#a06438&quot;,
  &quot;d1&quot;: &quot;#d8a868&quot;
 },
 &quot;sequence&quot;: [
  {
   &quot;from&quot;: 0,
   &quot;to&quot;: 8,
   &quot;layers&quot;: [
    {
     &quot;type&quot;: &quot;text&quot;
    }
   ]
  },
  {
   &quot;from&quot;: 8,
   &quot;to&quot;: 16,
   &quot;layers&quot;: [
    {
     &quot;type&quot;: &quot;dither&quot;,
     &quot;colors&quot;: &quot;s0,s1,s2&quot;,
     &quot;y1&quot;: 0.7,
     &quot;drive&quot;: &quot;none&quot;
    },
    {
     &quot;type&quot;: &quot;dither&quot;,
     &quot;colors&quot;: &quot;d0,d1&quot;,
     &quot;y0&quot;: 0.7,
     &quot;drive&quot;: &quot;none&quot;
    }
   ],
   &quot;transition&quot;: {
    &quot;type&quot;: &quot;wipe&quot;,
    &quot;frames&quot;: 4,
    &quot;direction&quot;: &quot;left&quot;
   }
  },
  {
   &quot;from&quot;: 16,
   &quot;to&quot;: 24,
   &quot;layers&quot;: [
    {
     &quot;type&quot;: &quot;dither&quot;,
     &quot;colors&quot;: &quot;d1,d0,s2&quot;,
     &quot;y1&quot;: 0.7,
     &quot;drive&quot;: &quot;none&quot;
    },
    {
     &quot;type&quot;: &quot;dither&quot;,
     &quot;colors&quot;: &quot;s1,s0&quot;,
     &quot;y0&quot;: 0.7,
     &quot;drive&quot;: &quot;none&quot;
    },
    {
     &quot;type&quot;: &quot;sprite&quot;,
     &quot;character&quot;: &quot;hero&quot;,
     &quot;motion&quot;: &quot;static&quot;,
     &quot;scale&quot;: 4,
     &quot;y&quot;: 0.6,
     &quot;reactive&quot;: false
    }
   ],
   &quot;transition&quot;: {
    &quot;type&quot;: &quot;iris&quot;,
    &quot;frames&quot;: 4
   }
  },
  {
   &quot;from&quot;: 24,
   &quot;to&quot;: 30,
   &quot;layers&quot;: [
    {
     &quot;type&quot;: &quot;caption&quot;,
     &quot;box&quot;: &quot;outline&quot;,
     &quot;position&quot;: &quot;center&quot;
    }
   ],
   &quot;transition&quot;: {
    &quot;type&quot;: &quot;fade&quot;,
    &quot;frames&quot;: 4
   }
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/sheet-walk.gif" alt="Sprite sheet walk" loading="lazy">
    <figcaption>
      <h3>Sprite sheet walk</h3>
      <p>An 8-frame walk-cycle sheet played by <code>image</code> with <code>sheetCols: 8</code> and <code>fps: 8</code>: the frame is a closed form of time, so any frame renders alone. The ground scrolls beneath.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;roles&quot;: {
  &quot;soil&quot;: &quot;#6a4a2a&quot;,
  &quot;grass&quot;: &quot;#3a8a2a&quot;
 },
 &quot;assets&quot;: {
  &quot;walk&quot;: {
   &quot;sha256&quot;: &quot;9c29d0267a97a9b0fde7e4437e6249643f98e64cdf77fec0d63bcd551b3ee0d5&quot;,
   &quot;width&quot;: 256,
   &quot;height&quot;: 40
  },
  &quot;ground&quot;: {
   &quot;sha256&quot;: &quot;139d9d18324ee765983b674ebec862c6d85556482dff003a3cf11c5a3dca1b54&quot;,
   &quot;width&quot;: 64,
   &quot;height&quot;: 180
  }
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;grass,soil&quot;,
   &quot;y0&quot;: 0.78,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;image&quot;,
   &quot;asset&quot;: &quot;ground&quot;,
   &quot;fit&quot;: &quot;none&quot;,
   &quot;x&quot;: 0,
   &quot;y&quot;: 0,
   &quot;anchor&quot;: &quot;top-left&quot;,
   &quot;wrap&quot;: &quot;x&quot;,
   &quot;scrollX&quot;: 0.2,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;image&quot;,
   &quot;asset&quot;: &quot;walk&quot;,
   &quot;sheetCols&quot;: 8,
   &quot;fps&quot;: 8,
   &quot;fit&quot;: &quot;none&quot;,
   &quot;scale&quot;: 3,
   &quot;x&quot;: 0.5,
   &quot;y&quot;: 0.86,
   &quot;anchor&quot;: &quot;bottom&quot;,
   &quot;drive&quot;: &quot;none&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/parallax-forest.gif" alt="Parallax forest" loading="lazy">
    <figcaption>
      <h3>Parallax forest</h3>
      <p>Four declared image assets (<code>assets</code>, pinned by sha256) wrap and scroll at four speeds with <code>wrap</code> and <code>scrollX</code>; the hero walks in front. The art keeps its own colours in creative mode.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;roles&quot;: {
  &quot;boots&quot;: &quot;#5a3418&quot;,
  &quot;cloak&quot;: &quot;#2d4a8c&quot;,
  &quot;cloak-shade&quot;: &quot;#1a2c55&quot;,
  &quot;eyes&quot;: &quot;#1e6b3a&quot;,
  &quot;gold&quot;: &quot;#e0b030&quot;,
  &quot;hair&quot;: &quot;#8a4a20&quot;,
  &quot;hair-light&quot;: &quot;#d08850&quot;,
  &quot;outline&quot;: &quot;#201010&quot;,
  &quot;skin&quot;: &quot;#f0c8a0&quot;,
  &quot;tunic&quot;: &quot;#a02828&quot;
 },
 &quot;assets&quot;: {
  &quot;sky&quot;: {
   &quot;sha256&quot;: &quot;48c82ff3921e8fe7a9f4e9a73d197a95784ef73fb9d4f0d5d6e5231c9f599404&quot;,
   &quot;width&quot;: 320,
   &quot;height&quot;: 180
  },
  &quot;mountains&quot;: {
   &quot;sha256&quot;: &quot;fdad037c5bea251875d3ea4632643028adce2647ccda534e0c11cc46206655b4&quot;,
   &quot;width&quot;: 320,
   &quot;height&quot;: 180
  },
  &quot;trees&quot;: {
   &quot;sha256&quot;: &quot;096f17fbeac2b3bd01762cbdc203282894dbc7474400ba7212518ea6a7f213d6&quot;,
   &quot;width&quot;: 160,
   &quot;height&quot;: 180
  },
  &quot;ground&quot;: {
   &quot;sha256&quot;: &quot;139d9d18324ee765983b674ebec862c6d85556482dff003a3cf11c5a3dca1b54&quot;,
   &quot;width&quot;: 64,
   &quot;height&quot;: 180
  }
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;image&quot;,
   &quot;asset&quot;: &quot;sky&quot;,
   &quot;fit&quot;: &quot;none&quot;,
   &quot;x&quot;: 0,
   &quot;y&quot;: 0,
   &quot;anchor&quot;: &quot;top-left&quot;,
   &quot;wrap&quot;: &quot;x&quot;,
   &quot;scrollX&quot;: 0,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;image&quot;,
   &quot;asset&quot;: &quot;mountains&quot;,
   &quot;fit&quot;: &quot;none&quot;,
   &quot;x&quot;: 0,
   &quot;y&quot;: 0,
   &quot;anchor&quot;: &quot;top-left&quot;,
   &quot;wrap&quot;: &quot;x&quot;,
   &quot;scrollX&quot;: 0.05,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;image&quot;,
   &quot;asset&quot;: &quot;trees&quot;,
   &quot;fit&quot;: &quot;none&quot;,
   &quot;x&quot;: 0,
   &quot;y&quot;: 0,
   &quot;anchor&quot;: &quot;top-left&quot;,
   &quot;wrap&quot;: &quot;x&quot;,
   &quot;scrollX&quot;: 0.2,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;image&quot;,
   &quot;asset&quot;: &quot;ground&quot;,
   &quot;fit&quot;: &quot;none&quot;,
   &quot;x&quot;: 0,
   &quot;y&quot;: 0,
   &quot;anchor&quot;: &quot;top-left&quot;,
   &quot;wrap&quot;: &quot;x&quot;,
   &quot;scrollX&quot;: 0.5,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;sprite&quot;,
   &quot;character&quot;: &quot;hero&quot;,
   &quot;motion&quot;: &quot;static&quot;,
   &quot;scale&quot;: 3,
   &quot;x&quot;: 0.35,
   &quot;y&quot;: 0.62,
   &quot;reactive&quot;: false
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
</div>

## Added in 0.7.0

<div class="cards">
  <figure class="card">
    <img src="/showcase/dos-adventure.gif" alt="DOS adventure" loading="lazy">
    <figcaption>
      <h3>DOS adventure</h3>
      <p>Ordered Bayer <code>dither</code> bands for the sky, sand, props and the UI bar; the hero walks; the verb and parser line sit in the bar with <code>caption.margin</code>. <code>pixelAspect: 1.2</code> records the Mode 13h pixel shape.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;pixelAspect&quot;: 1.2,
 &quot;accent&quot;: &quot;#0000a8&quot;,
 &quot;roles&quot;: {
  &quot;boots&quot;: &quot;#5a3418&quot;,
  &quot;cloak&quot;: &quot;#2d4a8c&quot;,
  &quot;cloak-shade&quot;: &quot;#1a2c55&quot;,
  &quot;eyes&quot;: &quot;#1e6b3a&quot;,
  &quot;gold&quot;: &quot;#e0b030&quot;,
  &quot;hair&quot;: &quot;#8a4a20&quot;,
  &quot;hair-light&quot;: &quot;#d08850&quot;,
  &quot;outline&quot;: &quot;#201010&quot;,
  &quot;skin&quot;: &quot;#f0c8a0&quot;,
  &quot;tunic&quot;: &quot;#a02828&quot;,
  &quot;s0&quot;: &quot;#000014&quot;,
  &quot;s1&quot;: &quot;#281444&quot;,
  &quot;s2&quot;: &quot;#6c3468&quot;,
  &quot;d0&quot;: &quot;#a06438&quot;,
  &quot;d1&quot;: &quot;#d8a868&quot;,
  &quot;glow&quot;: &quot;#38fc38&quot;
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;s0,s1,s2&quot;,
   &quot;x0&quot;: 0,
   &quot;y0&quot;: 0,
   &quot;x1&quot;: 1,
   &quot;y1&quot;: 0.556,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;d0,d1&quot;,
   &quot;x0&quot;: 0,
   &quot;y0&quot;: 0.556,
   &quot;x1&quot;: 1,
   &quot;y1&quot;: 0.7,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;accent&quot;,
   &quot;x0&quot;: 0,
   &quot;y0&quot;: 0.7,
   &quot;x1&quot;: 1,
   &quot;y1&quot;: 1,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;outline&quot;,
   &quot;x0&quot;: 0.694,
   &quot;y0&quot;: 0.244,
   &quot;x1&quot;: 0.763,
   &quot;y1&quot;: 0.611,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;cloak-shade&quot;,
   &quot;x0&quot;: 0.694,
   &quot;y0&quot;: 0.244,
   &quot;x1&quot;: 0.713,
   &quot;y1&quot;: 0.611,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;cloak&quot;,
   &quot;x0&quot;: 0.1875,
   &quot;y0&quot;: 0.511,
   &quot;x1&quot;: 0.269,
   &quot;y1&quot;: 0.644,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;bg&quot;,
   &quot;x0&quot;: 0.197,
   &quot;y0&quot;: 0.528,
   &quot;x1&quot;: 0.259,
   &quot;y1&quot;: 0.6,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;glow&quot;,
   &quot;x0&quot;: 0.203,
   &quot;y0&quot;: 0.544,
   &quot;x1&quot;: 0.231,
   &quot;y1&quot;: 0.55,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;dither&quot;,
   &quot;colors&quot;: &quot;glow&quot;,
   &quot;x0&quot;: 0.203,
   &quot;y0&quot;: 0.561,
   &quot;x1&quot;: 0.244,
   &quot;y1&quot;: 0.567,
   &quot;drive&quot;: &quot;none&quot;
  },
  {
   &quot;type&quot;: &quot;sprite&quot;,
   &quot;character&quot;: &quot;hero&quot;,
   &quot;motion&quot;: &quot;bounce&quot;,
   &quot;speed&quot;: 3.141592653589793,
   &quot;scale&quot;: 3,
   &quot;y&quot;: 0.66,
   &quot;reactive&quot;: false
  },
  {
   &quot;type&quot;: &quot;caption&quot;,
   &quot;box&quot;: &quot;none&quot;,
   &quot;margin&quot;: 0,
   &quot;maxLines&quot;: 2
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/game-boy.gif" alt="Game Boy level" loading="lazy">
    <figcaption>
      <h3>Game Boy level</h3>
      <p>The four DMG greens from palette roles alone: the sky is a <code>b</code>-filled checker in <code>roles.fg2</code>, the bricks are accent cells, and the hero's parts take the darker greens.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;background&quot;: &quot;white&quot;,
 &quot;accent&quot;: &quot;#306230&quot;,
 &quot;roles&quot;: {
  &quot;fg2&quot;: &quot;#9bbc0c&quot;,
  &quot;outline&quot;: &quot;#0f380f&quot;,
  &quot;hair&quot;: &quot;#306230&quot;,
  &quot;hair-light&quot;: &quot;#8bac0f&quot;,
  &quot;skin&quot;: &quot;#8bac0f&quot;,
  &quot;eyes&quot;: &quot;#0f380f&quot;,
  &quot;gold&quot;: &quot;#8bac0f&quot;,
  &quot;cloak&quot;: &quot;#306230&quot;,
  &quot;cloak-shade&quot;: &quot;#0f380f&quot;,
  &quot;tunic&quot;: &quot;#306230&quot;,
  &quot;boots&quot;: &quot;#0f380f&quot;
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;checker&quot;,
   &quot;pattern&quot;: &quot;b&quot;,
   &quot;size&quot;: 40
  },
  {
   &quot;type&quot;: &quot;grid&quot;,
   &quot;solid&quot;: true,
   &quot;pattern&quot;: &quot;................/................/................/................/................/.........aaa..../................/................/aaaaaaaaaaaaaaaa/aaaaaaaaaaaaaaaa&quot;
  },
  {
   &quot;type&quot;: &quot;sprite&quot;,
   &quot;character&quot;: &quot;hero&quot;,
   &quot;motion&quot;: &quot;bounce&quot;,
   &quot;speed&quot;: 3.141592653589793,
   &quot;scale&quot;: 5,
   &quot;y&quot;: 0.8,
   &quot;reactive&quot;: false
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/snes.gif" alt="SNES level" loading="lazy">
    <figcaption>
      <h3>SNES level</h3>
      <p>The same level in 16-bit colour: a sky-blue <code>roles.fg2</code>, brick accent cells, white clouds from <code>#</code> cells, and the hero in full <code>roles</code> colour.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;background&quot;: &quot;black&quot;,
 &quot;accent&quot;: &quot;#c84c0c&quot;,
 &quot;roles&quot;: {
  &quot;boots&quot;: &quot;#5a3418&quot;,
  &quot;cloak&quot;: &quot;#2d4a8c&quot;,
  &quot;cloak-shade&quot;: &quot;#1a2c55&quot;,
  &quot;eyes&quot;: &quot;#1e6b3a&quot;,
  &quot;gold&quot;: &quot;#e0b030&quot;,
  &quot;hair&quot;: &quot;#8a4a20&quot;,
  &quot;hair-light&quot;: &quot;#d08850&quot;,
  &quot;outline&quot;: &quot;#201010&quot;,
  &quot;skin&quot;: &quot;#f0c8a0&quot;,
  &quot;tunic&quot;: &quot;#a02828&quot;,
  &quot;fg2&quot;: &quot;#5c94fc&quot;
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;checker&quot;,
   &quot;pattern&quot;: &quot;b&quot;,
   &quot;size&quot;: 40
  },
  {
   &quot;type&quot;: &quot;grid&quot;,
   &quot;solid&quot;: true,
   &quot;pattern&quot;: &quot;................/..##........##../.####......####./................/................/.........aaa..../................/................/aaaaaaaaaaaaaaaa/aaaaaaaaaaaaaaaa&quot;
  },
  {
   &quot;type&quot;: &quot;sprite&quot;,
   &quot;character&quot;: &quot;hero&quot;,
   &quot;motion&quot;: &quot;bounce&quot;,
   &quot;speed&quot;: 3.141592653589793,
   &quot;scale&quot;: 5,
   &quot;y&quot;: 0.8,
   &quot;reactive&quot;: false
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/two-tone-quilt.png" alt="Two-tone quilt" loading="lazy">
    <figcaption>
      <h3>Two-tone quilt</h3>
      <p><code>b</code> cells take the second tone, <code>roles.fg2</code>, next to <code>#</code> and the accent; in monochrome they draw mid grey.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;accent&quot;: &quot;#c8963e&quot;,
 &quot;roles&quot;: {
  &quot;fg2&quot;: &quot;#d8c8a0&quot;
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;grid&quot;,
   &quot;solid&quot;: true,
   &quot;pattern&quot;: &quot;##.a.##/#b...b#/..###../#b...b#/##.a.##&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/hero-roles.gif" alt="hero: palette roles" loading="lazy">
    <figcaption>
      <h3>hero: palette roles</h3>
      <p>The v2 <code>hero</code> walking, each part in the colour the spec's <code>roles</code> map gives it (creative mode).</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;roles&quot;: {
  &quot;boots&quot;: &quot;#5a3418&quot;,
  &quot;cloak&quot;: &quot;#2d4a8c&quot;,
  &quot;cloak-shade&quot;: &quot;#1a2c55&quot;,
  &quot;eyes&quot;: &quot;#1e6b3a&quot;,
  &quot;gold&quot;: &quot;#e0b030&quot;,
  &quot;hair&quot;: &quot;#8a4a20&quot;,
  &quot;hair-light&quot;: &quot;#d08850&quot;,
  &quot;outline&quot;: &quot;#201010&quot;,
  &quot;skin&quot;: &quot;#f0c8a0&quot;,
  &quot;tunic&quot;: &quot;#a02828&quot;
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;sprite&quot;,
   &quot;character&quot;: &quot;hero&quot;,
   &quot;scale&quot;: 6,
   &quot;speed&quot;: 1.4,
   &quot;reactive&quot;: false
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/hero-mono.png" alt="hero: monochrome" loading="lazy">
    <figcaption>
      <h3>hero: monochrome</h3>
      <p>Without creative mode the same character falls back to the legacy greys and reads in pure black and white.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;roles&quot;: {
  &quot;boots&quot;: &quot;#5a3418&quot;,
  &quot;cloak&quot;: &quot;#2d4a8c&quot;,
  &quot;cloak-shade&quot;: &quot;#1a2c55&quot;,
  &quot;eyes&quot;: &quot;#1e6b3a&quot;,
  &quot;gold&quot;: &quot;#e0b030&quot;,
  &quot;hair&quot;: &quot;#8a4a20&quot;,
  &quot;hair-light&quot;: &quot;#d08850&quot;,
  &quot;outline&quot;: &quot;#201010&quot;,
  &quot;skin&quot;: &quot;#f0c8a0&quot;,
  &quot;tunic&quot;: &quot;#a02828&quot;
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;sprite&quot;,
   &quot;character&quot;: &quot;hero&quot;,
   &quot;motion&quot;: &quot;static&quot;,
   &quot;scale&quot;: 6,
   &quot;y&quot;: 0.55
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
</div>

## Added in 0.6.0

<div class="cards">
  <figure class="card">
    <img src="/showcase/quilt-pattern.png" alt="Quilt pattern" loading="lazy">
    <figcaption>
      <h3>Quilt pattern</h3>
      <p><code>pattern</code> draws exactly the authored cells: <code>.</code> empty, <code>#</code> foreground, <code>a</code> accent. With <code>solid</code>, every pixel is one of the three.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;accent&quot;: &quot;#c8963e&quot;,
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;grid&quot;,
   &quot;solid&quot;: true,
   &quot;pattern&quot;: &quot;##.a.##/#.....#/..###../#.....#/##.a.##&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/break-it-once.png" alt="Break it once" loading="lazy">
    <figcaption>
      <h3>Break it once</h3>
      <p><code>breaks: &quot;3,2 r15&quot;</code> turns one block about its centre; every other cell stays put.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;accent&quot;: &quot;#c8963e&quot;,
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;grid&quot;,
   &quot;solid&quot;: true,
   &quot;pattern&quot;: &quot;##.a.##/#.....#/..###../#.....#/##.a.##&quot;,
   &quot;breaks&quot;: &quot;3,2 r15&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/checker-pattern.gif" alt="Patterned checker" loading="lazy">
    <figcaption>
      <h3>Patterned checker</h3>
      <p>A checker <code>pattern</code> tiles from the top-left; <code>~</code> squares still flip with the signal.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;accent&quot;: &quot;#c8963e&quot;,
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;checker&quot;,
   &quot;size&quot;: 30,
   &quot;pattern&quot;: &quot;#.~/.a./~.#&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
</div>

## Added in 0.5.0

<div class="cards">
  <figure class="card">
    <img src="/showcase/camera-shake.gif" alt="Camera shake" loading="lazy">
    <figcaption>
      <h3>Camera shake</h3>
      <p>A seeded tremble on a static camera: <code>shake: { amp: 0.03, freq: 4 }</code>.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;camera&quot;: {
  &quot;move&quot;: &quot;static&quot;,
  &quot;from&quot;: {
   &quot;frame&quot;: 0,
   &quot;zoom&quot;: 1,
   &quot;x&quot;: 0.5,
   &quot;y&quot;: 0.5
  },
  &quot;shake&quot;: {
   &quot;amp&quot;: 0.03,
   &quot;freq&quot;: 4
  }
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;grid&quot;
  },
  {
   &quot;type&quot;: &quot;wave&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/camera-shake-parallax.gif" alt="Shake under parallax" loading="lazy">
    <figcaption>
      <h3>Shake under parallax</h3>
      <p>Each layer shakes by its depth: the horizon at depth 0 stays still, the figures at depth 1 shake fully.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;camera&quot;: {
  &quot;move&quot;: &quot;parallax&quot;,
  &quot;from&quot;: {
   &quot;frame&quot;: 0,
   &quot;zoom&quot;: 1,
   &quot;x&quot;: 0.5,
   &quot;y&quot;: 0.5
  },
  &quot;to&quot;: {
   &quot;frame&quot;: 29,
   &quot;zoom&quot;: 1,
   &quot;x&quot;: 0.5,
   &quot;y&quot;: 0.5
  },
  &quot;shake&quot;: {
   &quot;amp&quot;: 0.04,
   &quot;freq&quot;: 3
  }
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;gridhorizon&quot;,
   &quot;depth&quot;: 0
  },
  {
   &quot;type&quot;: &quot;figure&quot;,
   &quot;count&quot;: 3,
   &quot;depth&quot;: 1
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/camera-pan-wide.gif" alt="Wide pan" loading="lazy">
    <figcaption>
      <h3>Wide pan</h3>
      <p>A pan from <code>x: 0.5</code> to <code>x: 1.5</code>, past the old 0..1 range, over parallax layers.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;camera&quot;: {
  &quot;move&quot;: &quot;parallax&quot;,
  &quot;from&quot;: {
   &quot;frame&quot;: 0,
   &quot;zoom&quot;: 1,
   &quot;x&quot;: 0.5,
   &quot;y&quot;: 0.5
  },
  &quot;to&quot;: {
   &quot;frame&quot;: 29,
   &quot;zoom&quot;: 1,
   &quot;x&quot;: 1.5,
   &quot;y&quot;: 0.5
  }
 },
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;gridhorizon&quot;,
   &quot;depth&quot;: 0.3
  },
  {
   &quot;type&quot;: &quot;figure&quot;,
   &quot;count&quot;: 3,
   &quot;depth&quot;: 1
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card transparent">
    <img src="/showcase/transparent-light.png" alt="Transparent, light ink" loading="lazy">
    <figcaption>
      <h3>Transparent, light ink</h3>
      <p><code>background: &quot;transparent&quot;</code>: the black lifted out to alpha, shown over a checkerboard.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;background&quot;: &quot;transparent&quot;,
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;grid&quot;
  },
  {
   &quot;type&quot;: &quot;wave&quot;
  },
  {
   &quot;type&quot;: &quot;figure&quot;,
   &quot;count&quot;: 3
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card transparent">
    <img src="/showcase/transparent-dark.png" alt="Transparent, dark ink" loading="lazy">
    <figcaption>
      <h3>Transparent, dark ink</h3>
      <p><code>ink: &quot;dark&quot;</code>: drawn as on white with the white lifted out, for print over light paper.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;background&quot;: &quot;transparent&quot;,
 &quot;ink&quot;: &quot;dark&quot;,
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;grid&quot;
  },
  {
   &quot;type&quot;: &quot;wave&quot;
  },
  {
   &quot;type&quot;: &quot;figure&quot;,
   &quot;count&quot;: 3
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card transparent">
    <img src="/showcase/transparent-accent.png" alt="Transparent with an accent" loading="lazy">
    <figcaption>
      <h3>Transparent with an accent</h3>
      <p>An accent colour in creative mode on a transparent background.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;background&quot;: &quot;transparent&quot;,
 &quot;accent&quot;: &quot;#ff2d2d&quot;,
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;rings&quot;
  },
  {
   &quot;type&quot;: &quot;wave&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
</div>

## Added in 0.4.0

<div class="cards">
  <figure class="card">
    <img src="/showcase/grid-solid.png" alt="grid: solid" loading="lazy">
    <figcaption>
      <h3>grid: solid</h3>
      <p><code>solid: true</code> lights cells at full opacity on whole pixels, so every pixel is exactly bg, fg or accent.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;grid&quot;,
   &quot;solid&quot;: true
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/thickness.png" alt="Line thickness" loading="lazy">
    <figcaption>
      <h3>Line thickness</h3>
      <p><code>thickness</code> in pixels: <code>rings</code> at 8 and <code>wave</code> at 20.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;rings&quot;,
   &quot;thickness&quot;: 8
  },
  {
   &quot;type&quot;: &quot;wave&quot;,
   &quot;thickness&quot;: 20
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/figure-stances.png" alt="figure: wave and cheer" loading="lazy">
    <figcaption>
      <h3>figure: wave and cheer</h3>
      <p>The <code>wave</code> stance in a row, and <code>cheer</code> in an outlined cluster placed with <code>x</code>, <code>y</code> and <code>scale</code>.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;figure&quot;,
   &quot;count&quot;: 2,
   &quot;stance&quot;: &quot;wave&quot;,
   &quot;x&quot;: 0.3,
   &quot;y&quot;: 0.55,
   &quot;scale&quot;: 0.45
  },
  {
   &quot;type&quot;: &quot;figure&quot;,
   &quot;count&quot;: 3,
   &quot;stance&quot;: &quot;cheer&quot;,
   &quot;arrangement&quot;: &quot;cluster&quot;,
   &quot;style&quot;: &quot;outline&quot;,
   &quot;x&quot;: 0.75,
   &quot;y&quot;: 0.6,
   &quot;scale&quot;: 0.4
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/rig-wave.png" alt="rig: wave" loading="lazy">
    <figcaption>
      <h3>rig: wave</h3>
      <p>The host rig's <code>wave</code> pose.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;rig&quot;,
   &quot;pose&quot;: &quot;wave&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/rig-present.png" alt="rig: present" loading="lazy">
    <figcaption>
      <h3>rig: present</h3>
      <p>The host rig's <code>present</code> pose.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;rig&quot;,
   &quot;pose&quot;: &quot;present&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
  <figure class="card">
    <img src="/showcase/rig-reach.png" alt="rig: reach" loading="lazy">
    <figcaption>
      <h3>rig: reach</h3>
      <p>The bot rig's <code>reach</code> pose.</p>
      <details><summary>Spec</summary><pre v-pre>{
 &quot;layers&quot;: [
  {
   &quot;type&quot;: &quot;rig&quot;,
   &quot;rig&quot;: &quot;bot&quot;,
   &quot;pose&quot;: &quot;reach&quot;
  }
 ]
}</pre></details>
    </figcaption>
  </figure>
</div>
