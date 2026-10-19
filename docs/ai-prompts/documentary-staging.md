# Documentary staging (thought experiments)

## Scenario

A documentary or video-essay page that stages a thought experiment — the trolley problem, a
voting dilemma, a historical decision: schematic human silhouettes appear one by one in two
groups, a question hangs over them, and the accent light lands on the figure the argument
is about. The figures are anonymous on purpose; the names and the question carry the
information.

## Example prompt

```text
Build a thought-experiment staging page.

1. stage.js (Node 22+, ESM): render a 4-second scene at 640x360 with drawSpec
   from "animspec", seed 9, using two layers:
   - { type: "type-reveal", text: "who will act?", framesPerUnit: 8,
       fontSize: 44, y: 0.2 } — the question types in at the top;
   - { type: "figure", count: 6, stance: "stand", arrangement: "split",
       highlight: <see below>, labels: true, reveal: 0.35 } — three figures
     left (track A), three right (track B), names from the frame labels
     ["Ana", "Ben", "Cal", "Dot", "Eli", "Fay"], appearing one by one.
   The highlight is 0 while the figures appear; from frame 66 it sweeps
   1..6 in order (highlight = 1 + floor((i - 66) / 9) % 6).
2. Encode the frames to an animated GIF (or WebM) and build index.html that
   plays it beside the dilemma text and a "whose side are you on?" pair of
   buttons.

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

- `stage.js` — the scene renderer (schedule, highlight sweep, encoding).
- `figure-dilemma.gif` + `index.html` — the staged dilemma beside its text.

## What to check

- Figures appear one by one on the reveal schedule; the same seed replays it exactly.
- The highlight lands on a different figure each sweep step (in creative mode it is
  visibly the accent colour; in mono the label list is what changes).
- The question layer reveals once and holds — it never resets mid-scene.

## See it working

![figure dilemma demo](/demo/figure-dilemma.gif)
