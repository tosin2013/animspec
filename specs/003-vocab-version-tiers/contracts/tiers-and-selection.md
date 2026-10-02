# Contract: Tiers and Selection

## Tiers

| Tier | Bar | Offered to a model |
| --- | --- | --- |
| `core` | strict review | with no kit chosen, with any kit, and as extras |
| `extended` | approved, more stylistic | only through a kit that lists it |
| `contrib` | passes the automated gates; look not guaranteed | only when the caller names it |
| `legacy` | replaced; kept so old specs render identically | never |

Every primitive has exactly one tier, readable from its registry entry on the public
surface and listed in `VOCABULARY.md`.

Tiers limit what a model is **offered**. They do not limit what a spec may **contain**:
`validateAnimSpec` and `drawSpec` accept a primitive of any tier.

## Selection

```ts
select(kit?, breadth?, seed?)                  // the primitives offered
selectDetailed(kit?, breadth?, seed?, named?)  // { primitives, refused }
```

`select` keeps its shape and behaves as it does today, except for which primitives are
eligible. To name primitives, call `selectDetailed`.

| Request | Offered |
| --- | --- |
| no kit, or `auto` | core only: one from each category that has a core primitive, then more core primitives up to the target (12 to 20, by breadth) |
| a kit | the kit's own list, then up to 6 extra core primitives, by breadth |
| any | `caption`, always |

If there are fewer core primitives than the target, the selection is the core primitives
there are. It is never filled from another tier.

### Named primitives

| The caller names | Result |
| --- | --- |
| a core primitive | offered |
| a contrib primitive | offered |
| an extended primitive the chosen kit lists | offered (it already is) |
| an extended primitive the chosen kit does not list, or with no kit | refused: `extended; offered only through its kit` |
| a legacy primitive | refused: `legacy; replaced by <type>` |
| a type that does not exist | refused: `not a primitive` |

A refused name does not affect the rest of the selection. Naming is available only through
`selectDetailed`, which returns every refused name with its reason.

### Guarantees

- The same kit, breadth, seed and named list give the same selection, in the same order.
- No selection contains a legacy primitive.
- No selection contains a contrib primitive the caller did not name.
- No selection contains an extended primitive from outside the chosen kit.

## Descriptions for a model

`buildVocabPrompt(selection)` and `buildJsonSchema(selection)` describe exactly the
primitives they are given. Anything shown to a model must be built from a selection.

Called with no argument, both describe the whole registry, every tier included. That form
describes what the validator accepts and is not for showing to a model.

## Replacing a primitive

1. Add the replacement as a new registry entry, with its own type name and tier.
2. Change the old entry's tier to `legacy` and set `replacedBy` to the new type. Change
   nothing else in it.
3. Remove the old type from every kit; add the new one where it belongs.
4. Raise the version and record it (see [vocabulary-version.md](vocabulary-version.md)).

The old primitive's reference frames stay and are still compared on every run. If any of
them moves, the replacement was made over the old primitive, not beside it.

## What `npm run verify` checks

| Rule | Failure names |
| --- | --- |
| every primitive has a valid tier | the primitive |
| a kit lists only existing, core or extended primitives | the kit and the primitive |
| every extended primitive is listed by a kit | the primitive |
| a legacy primitive names an existing replacement | the primitive |
| replacements end at a primitive that is not legacy | the primitive where the chain fails |
| `caption` is core | `caption` |
| the validator and interpreter do not read tiers | the file |
| across 1,000 selections with no kit: core only | the first offending selection |
| across 1,000 selections per kit: no contrib, no legacy, no extended from outside the kit | the kit and the first offending selection |

Each rule is also run against a fixture that breaks it, and the run fails if the rule does
not catch its fixture.

## For primitive authors

- Give every new entry a `tier`. A contribution starts as `contrib` unless the style review
  says otherwise.
- A `contrib` or `legacy` primitive passes the same gates as every other primitive.
- An `extended` primitive must be added to at least one kit in the same change.
