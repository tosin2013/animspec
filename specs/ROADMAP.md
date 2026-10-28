# Spec Roadmap

Which feature specs the project needs, in what order, and what each one waits on. Product
intent lives in the "AnimSpec Core — PRD"; this file only maps it onto specs. Update it when a
spec is written, shipped, or re-ordered.

Last updated: 2026-10-28 (spec 026 for 0.9.0)

## Milestones and their gates

| Milestone | Goal | Gate to pass before the next one |
| --- | --- | --- |
| M0 Extract | Code copied in, determinism gate slimmed, missing gates added | All 29 primitives pass every gate; open-source decision recorded |
| M1 Go public | Name, licence, contribution rules, gallery, npm package | The private product renders from the package with identical hashes |
| M2 50 primitives | Data-viz and text categories, first outside contributions, tiers enforced | LLM spec quality holds at 50 primitives |
| M3 v1.0 | 100 primitives, kits re-tuned, spec format v1.0 | None; growth stays open after |

The figure of 100 primitives is a horizon for v1.0, not a quota. A primitive is added only
when it passes the new-primitive rule and the gates; the count follows from that.

## Specs

| # | Spec | Milestone | Status | Write it when |
| --- | --- | --- | --- | --- |
| 001 | [Complete the primitive vetting gates](001-primitive-vetting-gates/spec.md) | M0 | Shipped 2026-10-01 and merged to `main`; first published in 0.1.2. All four gates enforced (29 of 29 primitives then, 38 of 38 as of 0.4.0); 0.4.0 added the whole-composition budget gate | Done |
| 002 | [Reference frames match on every machine](002-cross-machine-frames/spec.md) | Before M1 | Shipped: merged to `main` 2026-10-09 (PR #1) and first published in 0.1.2. Three shipped fonts, a reference set per processor type, the cross-type tolerance check and a one-command refresh | Done |
| 003 | [Vocabulary version and tiers](003-vocab-version-tiers/spec.md) (PRD F7) | Before M1 | Shipped 2026-10-09: every spec records a vocabulary version; primitives carry a tier (core, extended, contrib, legacy); replaced primitives keep rendering identically; tiers and the version are checked by the registry gate | Done |
| 004 | [Publishable npm package](004-publishable-npm-package/spec.md) (PRD F6) | M1 | Shipped 2026-10-09: the library builds to an installable package named `animspec` that reproduces the golden hashes; release and dependency-update machinery in place; the public launch is deferred to 005 | Done |
| 005 | [Go-public readiness](005-go-public-readiness/spec.md) | M1 | Shipped 2026-10-09 in 0.1.2: contribution rules and CLA gate, security policy and code of conduct, automatic CI and secret scan, and the gallery. The legal review is recorded and the repository is public | Done |
| 006 | [Community pages site](006-community-pages/spec.md) | M1 | Shipped 2026-10-09: a VitePress site on GitHub Pages with the promise, an animated gallery of every primitive, the contribution path and the rendered docs, deployed by a paths-filtered workflow; the constitution baseline amended to 2.4.0 | Written on request, right after 005 put the gallery and the contribution path in place |
| 007 | [Copilot primitive agent](007-copilot-primitive-agent/spec.md) | M2 | Implemented 2026-10-10 and shipped with 0.2.0: the agent PR guard, `AGENTS.md`, the `primitive-proposal` skill and the setup workflow. The trial (T017 to T021, issues #15 to #19) has not been run yet | Written on request, to let vocabulary grow from proposals (including the ones AnimSpec Live will raise) |
| 008 | [SignalFrame track format](008-signalframe-format/spec.md) | M1 | Shipped 2026-10-17: a documented, versioned on-disk format for a whole `SignalFrame` sequence plus a byte-level codec (`encodeSignalTrack` / `decodeSignalTrack`) and a round-trip gate; a prerequisite for the command-line renderer | Written on request, ahead of the command-line renderer so the same file feeds the library, the CLI and Motion Studio |
| 009 | [Caption params](009-caption-params/spec.md) | M1 | Shipped 2026-10-17: four optional params on `caption` (`case`, `box`, `position`, `maxLines`) with defaults that keep today's frames byte-for-byte, plus the `palette.bg`/`palette.fg` fix; a vocabulary change | Written on request, for burned-in sentence-case captions on long-form episodes |
| 010 | [Command-line renderer](010-command-line-renderer/spec.md) (PRD F5) | M1 or later | Shipped in 0.2.0 (2026-10-18), from branch `feature/010-command-line-renderer`: `animspec render` renders any half-open frame range of a spec + `.asft` track to raw RGBA on stdout or a PNG folder, with JSON reports and stable exit codes; a boundary move (image-frame writing joins the scope), baseline amended to 2.11.0 | Decided by the maintainer via issue #30, with Motion Studio as the named consumer |
| 011 | [SignalFrame per-frame reader](011-signalframe-reader/spec.md) | M1 | Shipped in 0.2.0 (2026-10-18), from branch `feature/011-signalframe-reader`: `readSignalTrackHeader` / `readSignalFrame` / `indexSignalTrackSidecar` over any byte view, the committed `golden/signalframe/sample.asft` conformance fixture pinned by SHA-256, and the sidecar unknown-field rule stated plainly; a boundary change, baseline amended to 2.10.0 | Written on request (issue #54), for Motion Studio's parallel chunk workers and its Rust writer |
| 012 | [type-reveal primitive](012-type-reveal/spec.md) | M2 | Shipped in 0.2.0 (2026-10-18): the `type-reveal` primitive (sequential word/line text reveal with an accent emphasis span) — a primitive taken through spec kit by maintainer decision to settle its text-source and emphasis decisions (issue #23) | Written on request, ahead of the data-viz/text categories |
| 013 | [Per-layer signal bindings](013-signal-bindings/spec.md) | M1 or later | Shipped in 0.3.0 (2026-10-18), from branch `feature/013-signal-bindings`: the optional per-layer `bind` map drives any numeric param from a SignalFrame feature (`amplitude`/`energy`/`band:<n>`/`osc`) — a contract change, baseline amended to 2.12.0 | Written on request (issue #71), for lip-sync, beat-sync and idle motion |
| 014 | [Camera moves and layer parallax](014-camera/spec.md) | M1 or later | Shipped in 0.3.0 (2026-10-18), from branch `feature/014-camera`: a spec-level `camera` (pan/zoom/push/parallax) with per-layer `depth` as a closed-form transform — a contract change, baseline amended to 2.13.0 | Written on request (issue #73), for Ken Burns pan/zoom and multi-plane parallax |
| 015 | [SignalFrame viseme and beat](015-signalframe-viseme-beat/spec.md) | M1 or later | Shipped in 0.3.0 (2026-10-18), from branch `feature/015-signalframe-viseme-beat`: optional `viseme`/`beat` fields on `SignalFrame`, an optional ASFT extras chunk, and the two join the binding sources — a contract change, baseline amended to 2.14.0 | Written on request (issue #72), for real lip-sync and beat-sync |
| 016 | [Camera shake and wider camera range](016-camera-shake-range/spec.md) (#87, the camera-range part of #111); amends 014 | 0.5.0 | Shipped in 0.5.0 | Now |
| 017 | [Transparent background](017-transparent-background/spec.md) (#100) | 0.5.0 | Shipped in 0.5.0 | Now |
| 018 | [Designed grid patterns](018-designed-grid-patterns/spec.md) (#96, #101) | 0.6.0 | Shipped in 0.6.0 | Now |
| 019 | [Second tone](019-second-tone/spec.md) (#97): pattern letter `b` on grid and checker draws the `fg2` role (mid grey in monochrome); reuses 020's roles contract, no amendment | 0.7.0 | Shipped in 0.7.0 | Now |
| 020 | [Sprite palette roles](020-sprite-palette-roles/spec.md) (#103): Principle III amended to palette roles, a spec-level `roles` map, sprite format v2 and the `hero` character; constitution 4.0.0 | 0.7.0 | Shipped in 0.7.0 | Now |
| 021 | [VGA dither scenes](021-vga-dither/spec.md) (#107, native path): `dither` primitive, `caption.margin`, `pixelAspect`; post-process effects stay out (#90) | 0.7.0 | Shipped in 0.7.0 | Now |
| 022 | [Image assets](022-image-assets/spec.md) (#108, #109; #113 duplicate): `image` primitive, declared digest-pinned `assets`, CLI asset loading and `--creative`; constitution 5.0.0 | 0.8.0 | Shipped in 0.8.0 | Now |
| 023 | [Sprite sheets](023-sprite-sheets/spec.md) (#110): `sheetCols`, `sheetRows`, `frames`, `fps`, `frameStart` on `image` | 0.8.0 | Shipped in 0.8.0 | Now |
| 024 | [Plugin slot](024-plugin-slot/spec.md) (#92): `registerPlugin`, `plugins` and `ext:` layers, `animspec/verify` and `verify-plugin`; contract reviewed by Motion Studio (PR #148); constitution 6.0.0 | 0.8.0 | Shipped in 0.8.0 | Now |
| 025 | [Clip sequences](025-clip-sequences/spec.md) (#91): `sequence` of clips with cut, wipe, iris and fade transitions; constitution 6.1.0 | 0.8.0 | Shipped in 0.8.0 | Now |
| 026 | [Pixel mode and two-tone bars/rings](026-pixel-mode/spec.md) (#111, #158, #159): spec-level `pixelMode` (whole-pixel, palette-exact `bars`, `hbars`, `rings`, `emitter`, `particles`, `image`; rounded camera offsets) and `tone2` on `bars` and `rings`; constitution 6.2.0 | 0.9.0 | Implemented | Now |
| 027 | [Arcade HUD](027-arcade-hud/spec.md) (#105, #106): `versus-bars` and `hud-score`, data-bound from frame `coords` and `labels`; CPS II and tate style profiles and showcase loops | 0.9.0 | Implemented | Now |
| 028 | [Palette profiles](028-palette-profiles/spec.md) (#102, #104): spec-level `profile` (`gameboy-dmg`, `genesis`), profile-aware fixed greys, `dither` `matrix: "2"`, `tetris` in pixel mode; Game Boy and Genesis render profiles and showcase loops; constitution 6.3.0 | 0.10.0 | Implemented | Now |
| — | Primitive batches, one spec per category (numbered when written) | M2 | Not started | Once outside contributions can start |
| later | Kit re-tuning and spec format v1.0 freeze | M3 | Not started | After the 50-primitive LLM evaluation |

### Notes on each

- **002 Reference frames match on every machine.** Decided 2026-10-01: frames are byte-identical on
  machines with the same processor type, with one reference set per type, and within a small
  stated tolerance across types. Text is drawn with a font shipped in the library. Evidence is in
  [002 investigation](002-cross-machine-frames/investigation.md). It also adds an optional
  `font` field to the spec format, and re-records `led` and `sprite` from validated default
  layers.
- **003 Vocabulary version and tiers.** Decided 2026-10-01: the extended tier is public and
  lives in this repository. The spec format already has one optional field added outside the
  vocabulary, the `font` choice from 002; the vocabulary version is the second. Each spec records the vocabulary version it was written
  against; primitives carry a tier (core, extended, contrib, legacy); a replaced primitive keeps
  rendering identically for specs that use it. The PRD lists tier enforcement under M2. It is
  scheduled earlier here because the version field is part of the spec format: adding it after
  the package is public leaves every already-saved spec without one.
- **004 Publishable npm package.** A built package the private product can depend on. Covers the
  package entry points, bundling the icon library so it works from any folder (delivered
  by 001: icon bitmaps are pre-generated data, and the library no longer reads files), and removing the leftover types that belong to the application the code came from. It also removes the full-registry default from `buildVocabPrompt()` and `buildJsonSchema()`, so anything shown to a model must be built from a selection (deferred from 003, research.md R10).
- **005 Go-public readiness.** CONTRIBUTING with the new-primitive rule and style rubric, code of
  conduct, a primitive proposal issue template, the `good first primitive` label, the CLA text
  and sign-up bot, a security policy (`SECURITY.md`), public build triggers with code and secret
  scanning, and the gallery with reference thumbnails.
- **006 Community pages site.** A GitHub Pages site built with VitePress, rooted at `docs/`: a home
  page with the promise and the install, a gallery page generated from the registry (so it cannot
  drift, the same principle as the committed gallery), a contribute page surfacing the 005
  contribution path, and the repository's own markdown documentation rendered as pages from the
  same files. VitePress is a devDependency chosen over a hand-rolled site. Deploy is a separate,
  paths-filtered workflow; verify stays untouched. The site, GitHub Pages and the VitePress
  dependency are a boundary change under Principle VII: the constitution baseline is amended in
  the same change that ships it.
- **007 Copilot primitive agent.** Lets the GitHub Copilot coding agent turn an accepted primitive
  proposal into a complete, reviewable pull request: one registry entry at tier `contrib` plus every
  generated output the pipeline needs, behind one green `npm run verify`. A maintainer's assignment is the
  only trigger, issue text is untrusted data, the new-primitive rule is enforced before any code is written,
  and the maintainer who assigns is the signer of record for the licence check. A boundary change under
  Principle VII (a new external service and a new kind of contributor), so the baseline is amended in the
  same change that ships it.
- **008 SignalFrame track format.** A documented, versioned on-disk format for a whole
  `SignalFrame` sequence (header + fixed-stride float64 records + a sparse NDJSON sidecar for
  `labels`/`coords`, with `index`/`t` derived). Ships a byte-level codec
  (`encodeSignalTrack` / `decodeSignalTrack`) exported from the public surface, with file I/O
  left to the caller so `src/` stays free of file imports. A boundary change under Principle VII
  (a new kind of export), so the baseline is amended in the same change. The command-line renderer
  (010) and Motion Studio both consume this format.
- **009 Caption params.** Four optional params on the `caption` primitive — `case`, `box`,
  `position`, `maxLines` — with defaults that reproduce today's frames byte-for-byte, plus the
  `palette.bg`/`palette.fg` fix the issue flagged. A vocabulary change (no boundary change), so the
  version rises and the generated vocabulary/site files are regenerated; no golden hash moves.
- **010 Command-line renderer.** `animspec render <spec.json> --signal <track.asft>`
  renders any half-open frame range to raw RGBA on stdout or a PNG folder, with JSON
  progress/drop/manifest lines on stderr and stable exit codes — the bytes a chunk
  produces are identical to those frames inside a full render. The command lives outside
  `src/` (the purity scan is never narrowed), imports only the public surface, and is
  checked by `verify:cli`. Writing image frames moved from held-by-the-caller into scope
  through spec 010's named boundary change (baseline amended to 2.11.0); video encoding
  stays with the caller — raw stdout is the encoder hand-off. Consumes the 008/011 track
  format with the per-frame reader.
- **011 SignalFrame per-frame reader.** Random access to one frame of an `.asft` track without
  decoding the whole file, a committed byte-level fixture a foreign-language writer is tested
  against, and the sidecar unknown-field rule stated plainly (v1 readers ignore unknown fields).
  The on-disk format is unchanged; a boundary change under Principle VII (a new kind of public
  export), so the baseline is amended in the same change that ships it.
- **012 type-reveal primitive.** A single primitive taken through Spec Kit by maintainer
  decision, to settle its text-sequencing contract (word or line reveal on a frame count, an
  accent emphasis span). A vocabulary change; no golden hash moved.
- **013 Per-layer signal bindings.** An optional per-layer `bind` map drives any numeric param
  from a SignalFrame feature (`amplitude`, `energy`, `band:<n>`, a seeded `osc`; 015 added
  `viseme` and `beat`), clamped to the param's bounds. A contract change under Principle VII;
  the baseline's "The format" entry was amended.
- **014 Camera moves and layer parallax.** A spec-level `camera` (static, pan, zoom, push,
  parallax) with per-layer `depth`, as a closed-form transform of the frame index, so chunked
  renders stay identical. A contract change; "The format" entry was amended. Spec 016 amends it.
- **015 SignalFrame viseme and beat.** Optional `viseme` (mouth shape 0..14) and `beat` (onset
  0..1) on `SignalFrame`, carried by an optional ASFT extras chunk, and usable as bind sources.
  The track format stays version 1.
- **016 Camera shake and wider camera range** (0.5.0). An optional `camera.shake` (`amp`,
  `freq`), closed-form and seeded so chunked renders still match, scaled by layer `depth` under
  parallax and skipped entirely when absent; and `from`/`to` `x`/`y` beyond 0..1 (from #111).
  Amends 014's contract. A format change with a MINOR constitution amendment; no frame moves.
- **017 Transparent background** (0.5.0). `background: "transparent"`, with PNG output that
  keeps alpha. Must decide the foreground colour, how the palette gate treats alpha (001's rule
  assumes an opaque background) and how the command-line renderer writes it (010). A format
  change with a MINOR constitution amendment; existing frames do not move.
- **007 trial.** The Copilot agent trial (T017 to T021, issues #15 to #19) is scheduled for
  November 2026.
- **Primitive batches.** A batch spec sets the targets and acceptance bar for one category.
  Individual primitives go through the vetting pipeline, not a full spec each. Data-viz first
  (no data-viz category yet, 20 targeted), then text and numerals (8 text primitives as of
  0.4.0, 20 targeted). Numbered when written, so the number does not collide with the specs above.

## Planned work after 0.5.0

Each cluster needs the decision or amendment in its row before a spec is written. Issues
carry a comment naming their blocker.

| Cluster | Issues | Blocked on |
| --- | --- | --- |
| Image assets | #108, #109 (spec 022; #113 closed as a duplicate), then #110 | decided 2026-10-24: digest-pinned assets, a per-layer `colour: asset\|palette`; spec 022 amends Principles III and IV (MAJOR). Next |
| Finish chain | #90 (closed) | decided 2026-10-24: owned by Motion Studio (the private product); animspec's contract ends at the composed frame, and post-process effects stay out of scope |
| Palette roles | #103 (spec 020), then #97 (spec 019) | resolved by spec 020, which amends Principle III to palette roles; 019 reuses the contract |
| Plugin slot | #92 (spec 024, in progress) | a boundary change (a new kind of public surface); reuses spec 022's asset record; drafted against Motion Studio's plugin host |
| Clip sequences | #91 (spec 025, in progress) | nothing; needs its own spec. Target of the Director layer's shot list; transitions must stay composition, not post-process |
| Pixel mode | the rest of #111 | resolved by spec 026 (0.9.0) for six primitives; more primitives join one by one, if asked for |
| Legacy-tier drill and version pinning | #94; amends 003 | nothing; maintainer work |
| Retro style profiles | #102 to #107 | #103 shipped (020), #107's look covered natively (021), #105 and #106 as documented profiles with the arcade HUD (027), #102 and #104 as palette profiles (028); the CRT finish is Motion Studio's (#90) |

## Findings to schedule

Found while planning 001 and deliberately left out of it. Both are now resolved; none is
waiting for a home. Details are in [001 research](001-primitive-vetting-gates/research.md).

| Finding | Risk | Suggested home |
| --- | --- | --- |
| **Resolved by spec 002.** Golden hashes recorded on the reference laptop (macOS, arm64) do not match on the Linux x64 build machine. Measured cause: text uses whatever font the machine has, and x64 processors round soft edges differently from arm64 by at most 5 out of 255 per channel. The operating system itself makes no difference. | Broke the core promise as written ("byte-identical on every machine"). The promise is now stated per processor type with a checked cross-type tolerance, text uses shipped fonts, and the build machine passes. | [Spec 002](002-cross-machine-frames/spec.md) |
| **Resolved by spec 002.** Golden reference cases rendered an unvalidated `{ type }` layer, which skips defaults. `led` and `sprite` therefore had reference hashes for behaviour a validated spec never produces. | Reference cases now render validated default layers; the two primitives were re-recorded with no rendering change | [Spec 002](002-cross-machine-frames/spec.md) |

## Not specs in this repository

- Recording the open-source decision, the LLM vocabulary-scaling evaluation, and switching the
  private product to the published package all happen in the private project.
- Public name, CLA wording, and the legal review are decisions, not features.

## Open decisions that block specs

The public name (`animspec`) and the legal review of the licence and CLA are decided. The
remaining decisions are the blockers in "Planned work after 0.5.0" above.
