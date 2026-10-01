# Research: Reference Frames Match on Every Machine

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-01

Measurements are in [investigation.md](investigation.md). This file records the design
decisions taken from them.

## R1. What "processor type" means in practice

**Decision**: The processor type is what Node reports as `process.arch`: `arm64` or `x64`.
Any other value is unsupported.

**Rationale**: The operating system was measured to make no difference (Mac and Linux on
arm64 are identical on all cases). A real x64 build machine and an emulated x64 container
agree on all 75 non-text cases.

**Not verified, assumed**: Intel Macs, and Linux systems built on musl instead of glibc. Both
use different builds of the canvas library. They are documented as unverified.

## R2. Shipping fonts

**Decision**: The three `.ttf` files are committed under `assets/fonts/` with their licence
texts and a README recording source, version and SHA-256. A generator turns each into a
TypeScript module holding the bytes as base64 under `src/fonts/`. When the library loads, each
font is registered with the canvas library from memory under its own family name. A freshness
check in the verify suite regenerates the modules in memory and fails if they are stale.

**Rationale**: Registering from memory was measured to work identically to registering from a
file. It keeps `src/` free of file access (the purity rule from the vetting-gates feature),
does not depend on where the package is installed, and survives bundling. It is the same
pattern that feature uses for icons.

**Alternatives considered**:

- Register from a file path next to the module: no file imports needed, but the path must
  survive packaging and bundling, and it is file access at load time.
- Take the fonts from npm packages as development dependencies: the packages exist, but one is
  years behind the upstream font, and none was checked to contain the exact files measured.
- Keep only the generated modules, without the `.ttf` files: no reviewable source for a
  generated file, and awkward for licence review.

**Cost**: about 0.8 MB of fonts, about 1.05 MB as base64 source, stored twice in the
repository (asset and generated module).

## R3. Which fonts

**Decision**: DejaVu Sans Mono (default), JetBrains Mono, IBM Plex Mono.

| Font | Licence | Size | Cross-machine | LED sign |
| --- | --- | --- | --- | --- |
| DejaVu Sans Mono | Bitstream Vera (permissive) | 343 KB | identical on arm64; within 5 on x64 | fits |
| JetBrains Mono | SIL OFL 1.1 | 270 KB | identical on arm64; within 5 on x64 | fits |
| IBM Plex Mono | SIL OFL 1.1 | 173 KB | identical on arm64; within 5 on x64 | fits |
| Roboto Mono (rejected) | Apache-2.0 | 126 KB | not measured | glyphs cut off at the bottom |

**Rationale**: Chosen by the maintainer from rendered comparison sheets. DejaVu has the widest
character coverage and is the one measured most thoroughly.

**Legal note**: OFL 1.1 and the Bitstream Vera licence both permit bundling with software
under another licence, provided the font's own licence and copyright notice travel with it.
This goes into the legal review already pending before going public.

## R4. How a spec chooses a font

**Decision**: An optional top-level `font` field on the spec, beside `background` and
`accent`, holding a short key: `dejavu` (default), `jetbrains` or `plex`. The validator keeps
a known key, replaces an unknown one with the default and reports it. The interpreter resolves
the key to a family name and passes it to primitives in the draw context. Text primitives
build their font string from the context and never name a family themselves.

**Rationale**: One font per spec matches the maintainer's decision and mirrors how `accent`
already works. Putting the family in the draw context means a new text primitive cannot
accidentally use a machine font.

**Enforcement**: A static rule in the existing source scan fails if a `.font =` assignment in
`src/` contains a literal family name instead of the context's font.

**Alternatives considered**:

- A `font` param on each text primitive: more flexible, but five places to keep consistent and
  mixed fonts within one frame, which the style rules do not ask for.
- Register the default under the generic name `monospace`: needs no primitive changes and was
  measured to work, but it cannot express a choice between fonts.

## R5. Characters a font lacks

**Decision**: No special handling. Measured: a missing character draws as the font's own
empty-box placeholder, identically on every machine, and machine fonts are not consulted even
when they contain the character. One reference case with such characters guards this.

**Rationale**: The behaviour already satisfies FR-003. A text filter would add code to protect
against something that does not happen.

## R6. Layout of the reference sets

**Decision**: `golden/<type>/hashes.json` for exact comparison and
`golden/<type>/frames/<case>.png` for the cross-type comparison, for `<type>` in `arm64` and
`x64`.

**Rationale**: Hashes stay as the exact authority: small, readable in a diff, and what the
private product's parity check already uses. The cross-type check needs the other type's
actual pixels, which a hash cannot give. PNG is lossless, and the frames are mostly flat
black and white, so they are small: about 630 KB for 96 cases.

**Alternatives considered**:

- Frames only, comparing pixels for the exact check too: removes the hash file but loses the
  readable diff and the parity format.
- Run the cross-type check only during refresh, with no stored frames: the build machine
  could then never check it, and FR-012 requires it on every run.

**Churn**: a frame file is rewritten only when its decoded pixels change.

## R7. The cross-type check

**Decision**: On every run, render each reference case locally and compare it with the
stored frame of the other processor type. Fail if any colour channel of any pixel differs by
more than 8. Print the largest difference found. Two twelve-layer composites are added to the
reference cases, built from the primitives that differ most.

**Rationale**: Measured maximum is 5 (three-layer composite), 3 and 4 for the twelve-layer
specs, 3 for a single primitive. Differences do not grow with layer count, because each layer
mostly overwrites pixels.

## R8. Refreshing both sets from one machine

**Decision**: `npm run golden:update` renders the native set directly and the other set in a
`linux/<other type>` container with the repository mounted read-only and a cached volume for
that platform's `node_modules`. Both sets are written to a temporary directory, the cross-type
check is run on them, and only then are both moved into `golden/`. If Docker is missing, the
container fails, or the check fails, nothing in `golden/` changes. The command prints which
cases changed in which set.

**Rationale**: Emulated x64 was measured to match the real build machine, so a Mac can
produce the x64 set. All-or-nothing replacement keeps the two sets consistent.

**Alternatives considered**:

- Let the build machine produce the x64 set and commit it back: needs write access from CI
  and a round trip per change.
- Two separate commands on two machines: the situation this feature exists to remove.

**Limit**: the first refresh on a machine needs the network (image pull, `npm ci` in the
container). Verify does not.

## R9. Reporting

**Decision**: A failed comparison lists every mismatching case and names the set it used. On
an unsupported processor type the determinism gate fails with a message saying no reference
set exists for that type; it still prints the cross-type differences against both sets for
information.

**Rationale**: FR-008 forbids reporting a pass where no exact comparison was made. Today's
gate prints only the first eight mismatches, which hid the extent of this very problem.

## R10. Reference cases use validated layers

**Decision**: Each primitive's reference case renders the layer `sanitizeLayer` returns for
its bare type, as a real spec would.

**Rationale**: Measured earlier: only `led` and `sprite` render differently when validated,
because two of their boolean defaults are `true`. All other primitives' hashes are unaffected.

## Open risk carried into implementation

Text on the real x64 build machine has not been compared with text on the emulated one. The
first build after the default font lands is that comparison. If it fails, implementation
stops and the spec is revisited.
