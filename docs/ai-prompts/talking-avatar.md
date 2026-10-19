# Talking avatar (rig)

## Scenario

An assistant or host avatar for a site: a `rig` character whose mouth tracks the visitor's
mic (or an amplitude track), whose eyes blink on a seeded schedule, and whose pose and
head tilt a host can drive per frame.

See it working — a 3-second deterministic demo (synthetic speech envelope, seeded blink,
talk → point → cheer pose sweep), rendered by
[`scripts/demo-rig.ts`](https://github.com/tosin2013/animspec/blob/main/scripts/demo-rig.ts):

![rig talking demo](/demo/rig-talking.gif)

## Example prompt

```text
Build a talking-avatar host + page.

1. server.js (Node 22+, ESM): identical plumbing to a live wallpaper, but the
   spec is { background: "black", layers: [{ type: "rig", rig: "host",
   pose: "talk", scale: 0.55, y: 0.85 }] }, seed 11, at 720x720. The frame's
   amplitude drives the mouth (drive defaults to amplitude).
2. index.html: mic button, a level meter, and three controls that send spec
   patches over the WebSocket: pose (idle/talk/point/shrug/cheer), headAngle
   (-45..45), and eyeOpen (0..1).
3. Apply patches through validateAnimSpec; show result.dropped if a patch is
   rejected.

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

- `server.js` — the render host with a spec-patch channel.
- `index.html` — the avatar, the level meter, and the pose/tilt/eye controls.

## What to check

- Silence keeps the mouth closed; a loud signal opens it (drive = amplitude).
- The seeded blink still happens with `eyeOpen` at its default, and never with 0.
- Spec patches from the page are validated, never applied raw.
