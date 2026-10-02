# Validation Record: Reference Frames Match on Every Machine

Outcomes recorded as the feature is implemented. The quickstart steps are added here when the
polish phase runs them.

## T023: the first build on the real x64 machine (2026-10-01)

Run 36949558398 on branch `002-cross-machine-frames` at `661dd95`, Linux x64. **Passed**, in
36 seconds.

| Gate | Verdict |
| --- | --- |
| type check, registry, validator | passed |
| determinism: reference set `x64`, 144 cases, hashes match `golden/x64` | passed |
| vetting gates: purity, palette, reactivity, budget | 29/29 each, fixtures 5/5 |

What this settles:

- **The open assumption holds.** The x64 reference set was recorded in an emulated container
  on an arm64 Mac. The real x64 build machine reproduces all 144 cases byte for byte,
  including every text case in all three shipped fonts.
- **Text no longer depends on machine fonts.** The runner's fonts differ from both the Mac's
  and the container's, and the text cases still match.
- **This is the first green build of the repository.**
- **It is also the first verdict from the real build machine on the vetting gates**, which
  feature 001 could only check in containers because the build used to stop at the
  determinism gate. Slowest primitive there: `rain` at 11.9 ms against a 50 ms limit.

Also verified locally before the push: the determinism gate passes in `linux/amd64` and
`linux/arm64` containers with only the stock image's fonts installed.
