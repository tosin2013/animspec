# Chat assistant with an animated presence ("Jarvis")

## Scenario

A data/chat assistant page: the visitor asks questions in a chat box, an LLM answers, and
the answer arrives as more than text — a `rig` character speaks it (mouth driven by a
synthetic amplitude envelope), a `caption` or `type-reveal` layer reveals the key sentence,
and the page shows the transcript beside the animated presence.

**Who owns what**: the LLM call is the caller's side (any API you have); animspec renders
the assistant's presence deterministically from the reply.

## Example prompt

```text
Build a chat assistant page with an animated animspec presence.

1. server.js (Node 22+, ESM): an http server serving index.html with a POST
   /ask endpoint. The handler takes { message }, calls my LLM (read the key
   from process.env — stub the call with a fixed reply if the key is absent),
   then turns the reply into a scene:
   - amplitude: a synthetic envelope that rises while the reply "streams"
     (e.g. a smooth pseudo-envelope derived from the reply length),
   - a SignalFrame sequence whose labels carry the reply's first sentence.
2. Render the scene with drawSpec from "animspec" at 960x540 using this spec:
   { background: "black", layers: [{ type: "rig", rig: "host", pose: "talk",
   scale: 0.6, y: 0.9 }, { type: "caption", position: "top", case: "asis" }] },
   seed 5. Validate it with validateAnimSpec and log result.dropped.
3. Stream the rendered frames to the page while the reply types out in the
   transcript pane; end each turn with a manifest JSON line (seed, frames).

Hard rules:
- animspec runs in Node.js 22+ only (never import it in the browser).
- Always validate model/spectator input with validateAnimSpec before drawing,
  and surface result.dropped to the user.
- Deterministic: the same reply + seed must give identical frames. Derive the
  amplitude envelope from the reply text, never from the wall clock.
- Draw with the palette only (palette.bg / palette.fg / palette.accent).
- The host owns: canvas creation, audio → SignalFrame, file writing, playback,
  and the LLM call itself.
```

## What it yields

- `server.js` — `/ask`, the reply → scene mapping (labels + amplitude envelope), rendering.
- `index.html` — the chat transcript beside the animated presence.

## What to check

- The same reply + seed replays the identical animation (deterministic presence).
- The LLM call is stubbed cleanly when no key is configured — the page still works.
- The caption layer shows the reply text through the validator (shipped fonts only).
- Long replies scroll the transcript; the presence keeps rendering whatever arrives.
