# Pull request description

Every agent pull request description has these seven sections, in this order. Keep each
short and factual. The maintainer reads this page to decide whether to merge, so it
must stand alone.

```markdown
## Proposal

Fixes #<issue>. Verdict: build. Assigned by @<maintainer>.

## New-primitive rule

Why no existing primitive can draw this by changing its params, naming the closest
candidates checked and why each falls short.

## Style review

1. **Negative space**: <how it uses negative space rather than filling the frame>
2. **One signal**: <how one signal drives what you see>
3. **Every element carries information**: <how>
4. **Pure black and white**: <that it works, and how it was checked>

## Outputs

The generated files in this pull request: the registry entry, the vocabulary record and
`VOCABULARY.md`, the reference cases for both processor types with the
`golden/CHANGES.md` row, `gallery/<type>.png`, `loops/<type>.gif`, and the site outputs.

## Loop

![<type> loop](loops/<type>.gif)

## Verification

`npm run verify`: <result>. Pipeline steps that did not run: <none, or which and why>.

## Signer of record

@<maintainer>, who assigned the proposal.
```