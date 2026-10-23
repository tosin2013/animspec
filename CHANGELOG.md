# Changelog

Every published version of `animspec`, newest first. Each version is one git tag (`v<version>`)
and one npm release; see [RELEASING.md](RELEASING.md). The vocabulary version that each
package version ships is listed because a render manifest that records the package version
also pins the vocabulary it was drawn with. Intended changes to the reference frames are
logged separately in [golden/CHANGES.md](golden/CHANGES.md).

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
