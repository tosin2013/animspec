---
title: animspec
---

# animspec

Deterministic, declarative animation. An `AnimSpec` (JSON) plus a `SignalFrame`
(audio, data or text reduced to numbers) renders to a frame, and the same spec,
signal and seed always produce the same frame.

![A wave loop drawn by the library: twelve frames, the signal swept quiet to loud and back, from one fixed seed.](/loops/wave.gif)

Every moving pixel on this site was drawn by the committed library from a fixed
seed, and any machine can regenerate it byte for byte.

## The promise

| Situation | Guarantee |
| --- | --- |
| Same spec, signal and seed, on two machines of the same processor type | byte-identical frames |
| Same spec, signal and seed, on arm64 and on x64 | every colour channel of every pixel within 8 out of 255 |
| Any other processor type, or Windows | no guarantee; reported as unsupported |

The supported processor types are arm64 and x64. The operating system is not
part of the promise: macOS and Linux agree on the same processor type.

## Install

```bash
npm install animspec
```

Node.js 22 or later, ESM only.

## Quick start

Validate a spec, build a signal frame, draw it:

```ts
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec, validateAnimSpec, type SignalFrame } from "animspec";

const { spec } = validateAnimSpec({
  background: "black",
  layers: [{ type: "grid" }, { type: "wave" }],
});

const frame: SignalFrame = {
  index: 0,
  t: 0,
  values: new Float64Array(64).fill(0.5),
  spectrum: new Float64Array(64).fill(0.25),
  amplitude: 0.5,
  energy: 0.4,
};

const dims = { width: 1280, height: 720 };
const ctx = createCanvas(dims.width, dims.height).getContext("2d");
drawSpec(ctx, dims, frame, spec!, {
  reducedFlicker: true,
  creative: false,
  seed: 1,
});
```

The [user guide](/user-guide) walks through the whole path: writing specs,
building `SignalFrame`s, rendering options, validating model output and
choosing fonts.

## Where to go

- [Gallery](/gallery): every primitive in the vocabulary, animating
- [User guide](/user-guide): install, write a spec, render frames, troubleshoot
- [Vocabulary](/vocabulary): every primitive, its params, its tier
- [Design document](/DESIGN_DOC): the architecture, the ADRs, the gates
- [npm](https://www.npmjs.com/package/animspec) and
  [GitHub](https://github.com/tosin2013/animspec)