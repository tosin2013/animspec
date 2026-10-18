# Quote / testimonial wall

## Scenario

A testimonials or reviews page: each quote is a `quote-card` — the passage, a rule, and
its attribution — pre-rendered as deterministic images so the page stays fast and the
typography is identical everywhere.

## Example prompt

```text
Build a quote-wall generator + page.

1. quotes.js (Node 22+, ESM): take an array of { quote, attribution } objects
   and render each as a 960x420 PNG with drawSpec from "animspec", using
   { background: "black", layers: [{ type: "quote-card", quote: <q>,
   attribution: <a>, reveal: false, quoteSize: 34, attrSize: 20 }] }, with a
   distinct seed per card. Validate every spec and log result.dropped.
2. Emit quotes.json (file names + alt text) and index.html: a responsive grid
   of the cards with alt text, lazy-loaded.

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

- `quotes.js` — the batch renderer; `cards/` — one PNG per quote; `quotes.json` + `index.html`.

## What to check

- Long quotes wrap inside the card and never clip the attribution.
- Re-running regenerates identical PNGs (the seeds are recorded in quotes.json).
- A quote with characters the shipped fonts lack still renders (see the user guide's
  missing-glyphs note) — audit a few before publishing.
