# Investigation: Why Reference Frames Differ Between Machines

**Date**: 2026-10-01 | **Feature**: [spec.md](spec.md)

Evidence gathered before the spec was written. It is input to planning, not a design.

## What prompted it

The existing verify suite was run once on the automated build machine (Linux, x64). It failed
the reference comparison for `bars`, `hbars` and `radial` among others. The reference hashes
had been recorded on a Mac with an arm64 processor.

## Method

All 96 reference cases (29 primitives and 3 composites, at 3 signal levels) were rendered from
the code on `main` on three machines, and compared pixel by pixel against the Mac's frames:

- Mac, arm64 (the machine that recorded the reference hashes)
- Linux container, arm64
- Linux container, x64 (run under emulation on the same Mac)

The comparison was then repeated with one monospace font file registered on every machine
under the name the primitives ask for.

## Results

| Compared with the Mac (arm64) | Fonts | Identical cases | What differs |
| --- | --- | --- | --- |
| Linux arm64 | each machine's own | 75 of 96 | only the cases that draw text |
| Linux x64 | each machine's own | 39 of 96 | text, plus small rounding in 12 non-text primitives |
| Linux arm64 | same font on both | **96 of 96** | nothing |
| Linux x64 | same font on both | 48 of 96 | small rounding only |

### With the same font, arm64 against x64

| Case | Differing pixels (3 frames) | Largest difference per channel (of 255) |
| --- | --- | --- |
| composite: creative accent | 4,000 | 5 |
| `radial` | 1,394 | 3 |
| `hbars` | 20,832 | 2 |
| `tunnel` | 13,012 | 2 |
| `gridhorizon` | 6,370 | 2 |
| `mesh3d` | 3,765 | 2 |
| `spiral` | 129 | 2 |
| `tetris` | 9,936 | 1 |
| `rain` | 3,961 | 1 |
| composite: grid, wave, caption | 1,071 | 1 |
| `particles` | 212 | 1 |
| `bars` | 35 | 1 |
| composite: white bars, scan | 34 | 1 |
| `dots` | 22 | 1 |
| `orbits` | 8 | 1 |
| `crosshair` | 3 | 1 |
| `noise` | 1 | 1 |

Identical on both processor types: `grid`, `barcode`, `checker`, `wave`, `lissajous`, `shape`,
`rings`, `scan`, `flash`, `sweep`, `caption`, `text`, `led`, `sprite`, `plasma`.

## What this establishes

1. **The operating system makes no difference.** With the same font, macOS and Linux on the
   same processor type produce identical bytes for every case.
2. **Text differs only because of fonts.** The primitives ask for a generic monospace font and
   each machine substitutes its own (the Mac has 310 font families; the container has 3).
   Registering one font file everywhere removes every text difference on the same processor
   type.
3. **Processor type causes small rounding differences.** Between arm64 and x64, soft edges,
   translucent fills and fractional coordinates round differently, by at most 3 per channel
   for a single primitive and 5 for a three-layer composite. This is invisible to the eye.
4. **Primitives that draw only whole-pixel, opaque shapes are unaffected** by processor type.

## What the first round did not establish

These were open after the first round. The follow-up below answers the first, third and fifth.

- Whether every x64 machine agrees with every other.
- Whether every arm64 machine agrees. Only one physical arm64 machine was used.
- How differences grow with layer count.
- Windows. Not tested.
- Characters the font lacks.

## Follow-up measurements during planning

| Question | Result |
| --- | --- |
| Does a real x64 machine agree with an emulated one? | Yes, for all 75 cases that draw no text. Hashes from the real build machine and from an emulated container on the Mac were identical. Text cases could not be compared because the machines had different fonts. |
| How far do twelve-layer specs differ across processor types? | Two twelve-layer specs built from the most affected primitives differed by at most 3 and 4 per channel. The largest value seen anywhere is 5, in a three-layer composite. |
| Do characters a font lacks pull in the machine's fonts? | No. Greek and accented letters drew normally; Japanese text and an emoji drew as the font's empty-box placeholder. Frames were identical between the Mac, a Linux machine with no such fonts, and a Linux machine with Japanese and emoji fonts installed. |
| Do other fonts behave the same way? | Yes. JetBrains Mono and IBM Plex Mono were each identical on all 96 cases between the Mac and Linux arm64, and within 5 per channel against x64. |
| Does every candidate font fit the LED sign? | DejaVu Sans Mono, JetBrains Mono and IBM Plex Mono fit. Roboto Mono's glyphs are cut off at the bottom of the sign. |
| How large are the reference frames as images? | About 630 KB for 96 cases; the largest single frame is 50 KB. |
| Can a font be registered from data in memory, not a file? | Yes, with the same results as registering from a file. |
| What does "monospace" resolve to on the Mac today? | A proportional sans-serif font, so today's text is not monospaced there at all. |

## Decisions taken from this evidence

- 2026-10-01: **byte-identical on the same processor type, with a reference set for each, and
  within a small stated tolerance across types.** No primitive changes how it draws shapes.
- 2026-10-01: **several fonts ship and a spec chooses one.** The default is DejaVu Sans Mono;
  JetBrains Mono and IBM Plex Mono also ship.
