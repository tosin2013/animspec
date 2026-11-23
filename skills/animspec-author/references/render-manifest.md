# Render manifest: the handoff record

Every render you deliver leaves `render-manifest.json` beside its frames. It is
enough for a downstream tool (a studio or director that adds audio and
sequences segments) to mux sound at the right offset without reading the spec.

## 1. Capture the CLI manifest

`animspec render` prints a manifest as its last JSON line on stderr:
`version`, `vocabulary`, `canvas`, `arch`, `width`, `height`, `start`, `end`,
`seed`, `frames` and `creative`, plus (from animspec 0.12.0) `fps`,
`specSha256` and `signalSha256`, and `pixelAspect`, `assets`, `plugins` or
`clips` when the spec uses them.

```bash
npx animspec render spec.json --signal track.asft --seed 42 \
  --width 1280 --height 720 --png frames/ 2> render.log
grep '"manifest"' render.log | tail -1 > render-manifest.cli.json
```

## 2. Write `render-manifest.json`

Copy every field of the CLI manifest, then add the ones only you know:

| Field | Source |
|---|---|
| `kit`, `selectionSeed` | the kit and selection seed from step 2 of SKILL.md |
| `fps` | the CLI manifest (0.12.0+); on older versions, the fps you encoded the track with |
| `specSha256`, `signalSha256` | the CLI manifest (0.12.0+); on older versions `sha256sum spec.json track.asft` |
| `framePattern`, `outDir` | `%06d.png`, `frames/` |
| `segmentOffset` | supplied by the caller (clip clocks are relative); echo it back, or `0` |
| `cues[]` | the frames where labels change, beat or viseme markers, and each `sequence` clip's `from`/`to` |
| `visuallyVerified` | `true` or `false`, per rule 8 of SKILL.md |
| `substitutions[]` | every deliberate substitution (what was wanted, what you used); `[]` if none |

## 3. Report it

Rule 8 of SKILL.md: report each render by its `render-manifest.json`. It
carries the kit, both seeds, the frame count, the dimensions and the digests
of the inputs.
