---
name: Primitive proposal
about: Propose a new primitive for the AnimSpec vocabulary
title: "Primitive: <type>"
labels: ["good first primitive"]
---

<!-- A new primitive must draw something no existing primitive can draw by changing its params.
     If an existing primitive can do it, this is a param/enum change instead. -->

**Type**: the proposed primitive `type` name

**Category**: which category it fits (`structure`, `signal-line`, `signal-bars`, `geometry`, `motion`, `text`, `sprite`)

**What it draws**: describe the output, and why no existing primitive can produce it.

**Params**: the proposed params with their types, bounds and defaults.

**Style**: how it answers the four style questions (negative space, one signal, every element carries information, works in pure black and white).

## Rules (read before proposing)

- **Param types** are `number`, `boolean`, `enum` and `string` only. No array or object params —
  express a list of positions or labels through the frame's `coords`/`labels` fields, or reduce it
  to a count plus a seeded layout.
- **Palette only.** A primitive draws with `bg`/`fg`/`accent` (monochrome, or a named palette or the
  creative `accent`). There are no per-primitive CSS colour params.
- **Text** uses the shipped fonts only; `font` is chosen at the spec level, not per primitive.

If the idea needs structured params or colours outside the palette, it is not one primitive — it is
a spec-level change, and a maintainer decides that with spec kit, not a proposal.
