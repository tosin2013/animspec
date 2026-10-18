# Kinetic-type landing page

## Scenario

A landing page whose headline builds word by word as the visitor arrives — a
`type-reveal` sentence with the load-bearing term in the accent colour, held after it
completes, then content fades in around it.

## Example prompt

```text
Build a kinetic-type hero for a landing page.

1. hero.js (Node 22+, ESM): render 90 frames at 1280x720 with drawSpec from
   "animspec", using this spec: { background: "black", layers: [{ type:
   "type-reveal", text: "the interface is the argument", framesPerUnit: 8,
   emphasisStart: 2, emphasisEnd: 3, fontSize: 72, y: 0.5 }] }, seed 42.
   Frame i is the pure function of i — render them in any order.
2. Encode the frames to a WebM (pipe raw RGBA to ffmpeg) and also write a
   single poster PNG of frame 89.
3. index.html: autoplay the muted loop as the hero background, show the poster
   as the fallback image, and fade the page content in after the text holds.

Hard rules:
- animspec runs in Node.js 22+ only (never import it in the browser).
- Always validate model/spectator input with validateAnimSpec before drawing,
  and surface result.dropped to the user.
- Deterministic: the same spec + signal + seed must give identical frames.
  Seed all randomness from the seed; never use Math.random or Date.
- Draw with the palette only (palette.bg / palette.fg / palette.accent).
- The host owns: canvas creation, audio → SignalFrame, file writing, playback.
```

## What it yields

- `hero.js` — the render script (or an `animspec render` invocation with a track file).
- `hero.webm` + `poster.png`, and a landing page that plays them.

## What to check

- The emphasis words are the argument's load-bearing term, not decoration.
- Frame 89 of the video is the held full block and matches the poster.
- Re-running the script reproduces the video byte-for-byte (same seed).
