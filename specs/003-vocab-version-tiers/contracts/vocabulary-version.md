# Contract: Vocabulary Version

## In a spec

```json
{
  "vocabulary": 1,
  "background": "black",
  "layers": [{ "type": "grid" }, { "type": "wave" }]
}
```

`vocabulary` is the version of the vocabulary the spec was written against. It is optional
on the way in and always present on the way out of validation.

## Validation

| Spec says | Result | Reported in `errors` |
| --- | --- | --- |
| no `vocabulary` | the library's current version | nothing |
| an integer from 1 to the current version | kept as is | nothing |
| an integer above the current version | the current version | `vocabulary N is newer than this library (M); recorded as M` |
| anything else (a string, a fraction, 0, a negative number, `null`) | the current version | `vocabulary dropped (not a valid version)` |

The spec stays valid in every case. Layers the library does not know are dropped and listed
in `dropped`, exactly as before.

A spec validated once and validated again later, on the same or a newer library, keeps the
version it was first given.

## Rendering

The interpreter does not read `vocabulary`. A spec renders the same frames with or without
it, and with any value.

## For models and tools

- The generated JSON schema does not list `vocabulary`. A model is not asked for it.
- The current version is exported from the library's public surface as `VOCABULARY_VERSION`.
- The version and its history are in `VOCABULARY.md`.

## For maintainers: raising the version

The version must rise by one in the same change as any of these:

- a primitive is added;
- a param, or an allowed value of a param, is added, removed or changed;
- a param's bounds or default change;
- a primitive changes tier, or a legacy primitive's replacement changes.

Steps:

1. Make the change in the registry.
2. Raise `VOCABULARY_VERSION` by one.
3. Run `npm run vocab:record -- "<one-line summary>"`.
4. Commit the registry, `golden/vocabulary.json` and `VOCABULARY.md` together.

`npm run vocab:record` adds no entry when the vocabulary has not changed (it only refreshes
`VOCABULARY.md`), refuses a raised version with an unchanged vocabulary, and refuses to
overwrite the entry of a version that already has one.

## What `npm run verify` reports

| Situation | Output |
| --- | --- |
| vocabulary matches the record for the current version | `PASS  vocabulary matches the record for version N` |
| vocabulary changed, version not raised | `FAIL  vocabulary differs from version N; raise VOCABULARY_VERSION and run npm run vocab:record` followed by the primitives that differ |
| version raised, not recorded | `FAIL  no record for version N; run npm run vocab:record` |
| `VOCABULARY.md` out of date | `FAIL  VOCABULARY.md is stale; run npm run vocab:record` |

## Not covered

- How a primitive draws. A drawing change is caught by the reference frames, not the version.
- Specs written against a vocabulary from which a primitive has since been removed. Nothing
  has been removed; this is decided by the feature that first removes a primitive.
