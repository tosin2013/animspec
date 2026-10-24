# Changelog

Every published version of `animspec`, newest first. Each version is one git tag (`v<version>`)
and one npm release; see [RELEASING.md](RELEASING.md). The vocabulary version that each
package version ships is listed because a render manifest that records the package version
also pins the vocabulary it was drawn with. Intended changes to the reference frames are
logged separately in [golden/CHANGES.md](golden/CHANGES.md).

## Unreleased (vocabulary 12)

- Camera shake: `camera.shake = { amp, freq }`, a seeded, closed-form tremble (`amp` up to
  0.05 of the frame, `freq` up to 5 per second, default 3), scaled by `depth` under
  parallax (#87). A camera without a shake renders exactly as before.
- Camera keyframe `x`/`y` now run from -1 to 2 instead of 0 to 1, so a camera can travel
  one and a half screens from the centre (#111). Cameras inside 0..1 are unchanged.
- **Intended change**: a spec stored without validation, with a camera keyframe outside
  0..1, used to be clamped to 0..1 when validated; it now renders at its stated position
  (within -1..2). Specs stored after validation already hold clamped values and do not
  change. Constitution 2.16.0.

## 0.4.0 — 2026-10-23 (vocabulary 12)

Every new param defaults to the earlier behaviour: no existing reference frame moved.

- `figure`: `x`, `y` and `scale` params, and the `wave` and `cheer` stances (#88, #89).
- `rig`: the `wave`, `present` and `reach` poses (#89).
- `grid`: `solid`, lit cells at full opacity on whole pixels, so every pixel is exactly
  bg, fg or accent (#98).
- `thickness` (line width in pixels) on `radial`, `lissajous`, `shape`, `rings` and `graph`;
  `wave`'s thickness now goes up to 32 (#99).
- A whole-composition budget gate: specs at the 12-layer cap, with a camera, stay within
  12,000 drawing operations and 200 ms per 1080p frame (#93). Constitution 2.15.0.
- `buildJsonSchema()` and `buildVocabPrompt()` without a selection throw a clear error;
  there is still no full-vocabulary default (#112).
- README links are absolute, so they work on the npm page (#112).
- This changelog (#86).
- Toolchain: TypeScript 7 (#10); Dependabot pull requests that change only the manifest and
  lockfile are exempt from the CLA check.

## 0.3.0 — 2026-10-18 (vocabulary 11)

- New primitives: `rig`, `emitter` and `figure`.
- Per-layer signal `bind` map: drive any numeric param from a SignalFrame feature (spec 013).
- Spec-level `camera` (pan, zoom, push, parallax) with per-layer `depth` (spec 014).
- `SignalFrame` `viseme` and `beat`, with an optional ASFT extras chunk (spec 015).
- The CLI streams with bounded memory.
- The AI-prompting guide and `llms.txt`.

## 0.2.1 — 2026-10-18 (vocabulary 8)

- Packaging fix: the `animspec` bin is declared at the top level again. 0.2.0 shipped the CLI
  file but did not expose the command on install.

## 0.2.0 — 2026-10-18 (vocabulary 8)

- New primitives: `type-reveal` and `quote-card`.
- The SignalFrame track format with its per-frame reader (`readSignalTrackHeader`,
  `readSignalFrame`, `indexSignalTrackSidecar`) (specs 008, 011).
- The `animspec render` command-line renderer: frame ranges, raw RGBA or PNG (spec 010).
- The Copilot primitive agent path: `AGENTS.md`, the `primitive-proposal` skill and the agent
  PR guard (spec 007).
- Frame-order gates extended to fresh processes.
- `@napi-rs/canvas` 1.0.11.

## 0.1.4 — 2026-10-17 (vocabulary 3)

- Documented frame-order independence: chunked and parallel renders are safe.
- The embedding guide: worker model, pixel format, reproducibility manifests, model authoring.
- The community site on GitHub Pages, with the animated gallery (spec 006).

## 0.1.3 — 2026-10-09

- Publishing fixes: provenance needs the repository URL; OIDC trusted publishing on npm 11.
- First version of the user guide.

## 0.1.2 — 2026-10-09

- First published version: the `AnimSpec` format, the reference interpreter, the primitive
  registry with tiers and a vocabulary version, the validator, deterministic selection,
  shipped fonts, and one reference set per processor type (specs 001 to 005).
