# Contract: Contributing

The content of `CONTRIBUTING.md` — the rules every contribution follows. It is the human-facing
rendering of the constitution; it is not a new source of truth.

## The new-primitive rule

A new primitive must draw something no existing primitive can draw by changing its params.
Otherwise the change is a new param or enum value on the existing primitive.

- Adding a primitive is one registry entry (`type`, `category`, `description`, `tier`, `params`,
  `draw`).
- A contribution starts as tier `contrib` unless the style review says otherwise.
- An `extended` primitive must be added to at least one kit in the same change.

## The style review

Every primitive, new or changed, is reviewed against four questions:

1. Does it use negative space rather than fill the frame?
2. Does one signal drive what you see?
3. Does every element carry information?
4. Does it work in pure black and white?

## The proposal path

1. Open an issue from the primitive-proposal template (or claim a `good first primitive` issue).
2. Implement one registry entry.
3. Run `npm run verify`; it must pass, including all four vetting gates.
4. Sign the CLA (required before an outside contribution merges).
5. Open the pull request; CI runs automatically and the CLA gate must pass.
