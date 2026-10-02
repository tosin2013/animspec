# Shipped fonts

The three font files below are committed as the reviewable source for the generated
modules under `src/fonts/` (see `npm run fonts:generate`). These exact files were
verified on 2026-10-01 to render all 96 reference cases byte-identically on macOS arm64
and Linux arm64, within 5 of 255 on Linux x64. A file with a different checksum is a
different font version and must be re-verified across machines before use.

| File | Source | Version | Size (bytes) | SHA-256 |
|------|--------|---------|--------------|---------|
| `DejaVuSansMono.ttf` | `ttf/` inside `dejavu-fonts-ttf-2.37.zip` from https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip | 2.37 | 340,712 | `b4a6c3e4faab8773f4ff761d56451646409f29abedd68f05d38c2df667d3c582` |
| `JetBrainsMono-Regular.ttf` | `fonts/ttf/` inside `JetBrainsMono-2.304.zip` from https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip | 2.304 | 273,900 | `a0bf60ef0f83c5ed4d7a75d45838548b1f6873372dfac88f71804491898d138f` |
| `IBMPlexMono-Regular.ttf` | `packages/plex-mono/fonts/complete/ttf/` of https://github.com/IBM/plex | 2.005 | 173,052 | `7c6fbddca4b700be918f5f6183d9bd4464fa427fe435f0b480d77fe2bb8c5a43` |

Licence texts: `LICENSE-DejaVu.txt` (the `LICENSE` file in the DejaVu zip, Bitstream Vera),
`LICENSE-JetBrainsMono.txt` (`OFL.txt` in the JetBrains zip, SIL OFL 1.1),
`LICENSE-IBMPlexMono.txt` (`packages/plex-mono/LICENSE.txt` from IBM/plex, SIL OFL 1.1).
