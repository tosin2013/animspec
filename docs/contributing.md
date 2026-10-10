---
title: Contributing
---

# Contributing

Thanks for wanting to contribute to `animspec`. This library is a deterministic, declarative
animation vocabulary; its whole promise is that the same spec, signal and seed always produce
the same frame. These rules keep that promise intact as the vocabulary grows.

## Before you start

- **Sign the CLA.** Outside contributions require a signed Contributor Licence Agreement —
  see [CLA.md](CLA.md). Your pull request cannot merge until you are on the signature list.
- **Open an issue first** (from the *Primitive proposal* template) so the idea can be discussed
  before you write code.

## The new-primitive rule

A new primitive must **draw something no existing primitive can draw by changing its params**.
Otherwise the change is a new param or enum value on the existing primitive.

- Adding a primitive is **one registry entry** in `src/primitives/registry.ts` — `type`,
  `category`, `description`, `tier`, `params`, and `draw`.
- A contribution starts as tier `contrib` unless the style review says otherwise.
- An `extended` primitive must be added to at least one kit in the same change.

## The style review

Every primitive, new or changed, is reviewed against four questions:

1. Does it use negative space rather than fill the frame?
2. Does one signal drive what you see?
3. Does every element carry information?
4. Does it work in pure black and white?

## The gates

Run `npm run verify`. It must pass, including the four vetting gates (purity, palette,
reactivity, budget) that every primitive passes automatically. A primitive that fails any gate
is not merged.

## The proposal path

1. Open an issue from the *Primitive proposal* template (or claim a `good first primitive`).
2. Implement one registry entry.
3. Run `npm run verify` — all green.
4. Sign the CLA.
5. Open the pull request; CI runs automatically and the CLA gate must pass.

## Agent-assisted proposals

A maintainer may assign an accepted proposal to the Copilot agent instead of step 2.
The agent follows the procedure in `.github/skills/primitive-proposal/` (driven by
`AGENTS.md`): it refuses duplicates and incomplete proposals with a precise comment, and
an eligible one becomes a draft pull request with every generated output, which still
needs `npm run verify` green. A CI guard checks that the change stays inside the allowed
set, and the licence rule is met through the signer of record: the maintainer who
assigned the proposal. The human steps stay: approve and run the workflows, review the
style answers and the loop, and merge.
