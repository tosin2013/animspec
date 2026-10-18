# Spec sandbox

## Scenario

A playground page for learning the format: edit a spec as JSON, see the rendered frame
update, and read exactly what the validator dropped or clamped — the fastest way to
understand what `validateAnimSpec` does with imperfect input.

## Example prompt

```text
Build a spec sandbox host + page.

1. server.js (Node 22+, ESM): a POST /render endpoint that takes a raw spec
   JSON object, runs it through validateAnimSpec, and returns three things:
   the sanitized spec, result.dropped, and the rendered 960x540 frame as PNG
   (drawSpec on a @napi-rs/canvas canvas, seed from the query string).
2. index.html: a JSON editor pre-filled with a two-layer example, a Render
   button, a canvas, and a "validator report" panel that lists result.dropped
   and the sanitized spec side by side.
3. Include three starter specs: a valid one, one with an unknown layer type,
   and one with out-of-range params.

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

- `server.js` — the validate-and-render endpoint.
- `index.html` — editor, canvas, and the side-by-side validator report.

## What to check

- The unknown-layer starter shows the drop in the report and still renders the rest.
- The out-of-range starter shows the clamped values in the sanitized spec.
- The endpoint never trusts the posted spec — validation is the only gate.
