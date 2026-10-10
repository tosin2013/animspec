---
title: Contribute
---

# Contribute a primitive

The vocabulary grows one registry entry at a time, and most of it is expected
to come from outside (the roadmap's M2 milestone is 50 primitives). This page
is the short path; [CONTRIBUTING](/contributing) is the source of truth for
every rule named here.

## The one rule

A new primitive must **draw something no existing primitive can draw by
changing its params**. If an existing primitive could draw it with different
params, the change is a new param or enum value on that primitive, not a new
primitive. When you think you have a case, open a proposal first: the
discussion happens before the code.

## The four style questions

Every primitive, new or changed, is reviewed against four questions:

1. Does it use negative space rather than fill the frame?
2. Does one signal drive what you see?
3. Does every element carry information?
4. Does it work in pure black and white?

Read them with their full context in [CONTRIBUTING](/contributing).

## The path in, five steps

1. **Open a proposal issue** from the
   [primitive proposal template](https://github.com/tosin2013/animspec/issues/new?template=primitive-proposal.md&labels=good+first+primitive),
   labelled `good first primitive`. The proposal is where the style questions
   get answered early.
2. **Implement one registry entry** in
   [`src/primitives/registry.ts`](https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts):
   `type`, `category`, `description`, `tier`, `params` and `draw`. A
   contribution starts as tier `contrib`.
3. **Run `npm run verify`** and make it green. That one offline command is the
   whole quality bar: registry, validator, determinism, the four vetting gates
   (purity, palette, reactivity, budget) and package parity. A primitive that
   fails any gate is not merged.
4. **Sign the [CLA](https://github.com/tosin2013/animspec/blob/main/CLA.md).**
   Outside contributions merge only with a signed Contributor Licence
   Agreement on record, and the CLA check enforces it automatically.
5. **Open the pull request.** CI runs the same `npm run verify` plus a secret
   scan, and the CLA gate must pass.

## Before you write code

Try the vocabulary first: the [user guide](/user-guide) shows how to write a
spec and render frames, and the [vocabulary](/vocabulary) lists every
primitive with its params. Most proposals that survive review started as
someone playing with a spec that could not draw what they wanted.