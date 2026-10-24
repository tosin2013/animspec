---
title: Showcase
---

# Showcase

The [gallery](/gallery) draws every primitive with its default params. This page shows what
the defaults hide: params and spec options added since, each drawn by the committed library
from the spec under its picture (seed 12345). Moving examples loop one second at 30 frames
per second; transparent examples sit on a checkerboard so the alpha is visible.

Rendered with `npm run showcase:generate`

## Added in 0.7.0

<div class="cards">
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
