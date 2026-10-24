# Changelog

Every published version of `animspec`, newest first. Each version is one git tag (`v<version>`)
and one npm release; see [RELEASING.md](RELEASING.md). The vocabulary version that each
package version ships is listed because a render manifest that records the package version
also pins the vocabulary it was drawn with. Intended changes to the reference frames are
logged separately in [golden/CHANGES.md](golden/CHANGES.md).

## Unreleased (vocabulary 15)

Image assets (spec 022, #108, #109). No existing reference frame moved.

- `image`: a declared, digest-pinned image asset (spec `assets`: id, sha256, size), placed,
  fitted, cropped, flipped, faded, tiled and scrolled; in the art's own colours in creative
  mode, or mapped to the palette. Hosts pass decoded bitmaps; `checkAssets` verifies bytes.
- The command-line renderer loads `<id>.png` next to the spec (or `--assets <dir>`), refuses a
  missing or mismatched asset with exit 5, records digests in the manifest, and gains
  `--creative`.
- Constitution 5.0.0: Principles III and IV amended for image assets. The finish chain (#90)
  is decided as Motion Studio's; post-process effects stay out of scope.
- A `parallax-forest` showcase loop.

## 0.7.0 — 2026-10-24 (vocabulary 14)

Palette roles and retro looks: sprite format v2 with the `hero` character (spec 020, #103), a
second pattern tone (spec 019, #97), and ordered-dither scenes (spec 021, #107), with Game Boy,
SNES and DOS adventure showcase loops. No existing reference frame moved.

- A spec may carry a `roles` map of named colours (up to 16), used only in creative mode.
  Outside creative mode every role falls back to a grey, so output stays monochrome.
- `sprite` gains `hero`, a 16 × 20 character whose ten parts (hair, skin, eyes, gold trim,
  cloak, boots and more) take their colours from `roles`. Built-in characters may now
  declare a per-letter palette (format v2, up to 32 × 48); `mascot`, `bot` and `ghost` are
  unchanged.
- `sanitizeRoles` is exported. `npm run verify` now checks that built-in characters are
  well-formed, and the palette gate accepts mixes of the background with a declared role.
- `grid` and `checker` patterns: the letter `b` draws a second tone, coloured by `roles.fg2` in
  creative mode and mid grey otherwise (spec 019, #97). Patterns without `b` are unchanged.
- `dither`: an ordered (Bayer) dither gradient through up to six palette roles in a region,
  for DOS/VGA-style skies, ground, props and UI bars (spec 021, #107). `caption` gains
  `margin`, and a spec may declare `pixelAspect` (recorded in the command-line manifest, never
  changing a pixel). A `dos-adventure` showcase loop shows the look.
- Constitution 4.0.0: Principle III now reads "palette roles" instead of only background,
  foreground and accent. Constitution 4.1.0: the palette
  gate accepts a role mixed with both background and foreground, as it does the accent.
  Constitution 4.2.0: `pixelAspect` joins the format.

## 0.6.0 — 2026-10-23 (vocabulary 13)

Designed grids, a showcase page, and stricter gallery checks. No existing reference frame moved.

- `grid` and `checker`: a `pattern` param, one letter per cell with rows split by `/`
  (`.` off, `#` foreground, `a` accent, `~` lit by the spectrum), so designed patterns such
  as quilts, mosaics and boards can be authored (#96). A `breaks` param turns or shifts
  single cells, for example `"3,2 r15; 0,4 dx0.25"` (#101). Both default to empty, so no
  existing frame moved. Problems are reported by the validator, and the layer still renders.
- Site: a [showcase page](https://tosin2013.github.io/animspec/showcase) for the params and
  spec options the default-layer gallery cannot show (0.4.0 and 0.5.0 additions), generated
  by `npm run showcase:generate`.
- `npm run verify` now fails when a committed gallery thumbnail or showcase still is stale,
  not only when it is missing. Constitution 3.2.0.

## 0.5.0 — 2026-10-23 (vocabulary 12)

Two format additions; the vocabulary is unchanged and no existing reference frame moved.

- Camera shake: `camera.shake = { amp, freq }`, a seeded, closed-form tremble (`amp` up to
  0.05 of the frame, `freq` up to 5 per second, default 3), scaled by `depth` under
  parallax (#87). A camera without a shake renders exactly as before.
- Camera keyframe `x`/`y` now run from -1 to 2 instead of 0 to 1, so a camera can travel
  one and a half screens from the centre (#111). Cameras inside 0..1 are unchanged.
- **Intended change**: a spec stored without validation, with a camera keyframe outside
  0..1, used to be clamped to 0..1 when validated; it now renders at its stated position
  (within -1..2). Specs stored after validation already hold clamped values and do not
  change. Constitution 2.16.0.
- Transparent background: `background: "transparent"` with an optional `ink` (`"light"`, the
  default, or `"dark"`). Frames carry alpha; laid over black (light) or white (dark) they equal
  the solid render, for every primitive. `animspec render --png` writes RGBA PNGs and `--raw`
  carries alpha (#100). Constitution 3.1.0.
- Cross-type reference checks now include alpha, and a pixel that is not fully opaque is
  compared by its colour weighted by alpha. Opaque pixels are compared as before, so no
  existing result changed. Constitution 3.0.0 (Principle I).
- **Intended change**: a spec stored without validation with `background: "transparent"` used
  to draw on black; it now draws transparent. Validated specs hold `"black"` and do not change.

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
