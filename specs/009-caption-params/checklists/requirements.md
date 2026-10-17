# Requirements Checklist: Caption Params

- [x] FR-001 Four optional params: `case`, `box`, `position`, `maxLines`, with the stated bounds and defaults.
- [x] FR-002 Default layer renders byte-identically to the pre-change caption.
- [x] FR-003 `caption.draw` colours only with `palette.bg`/`palette.fg`.
- [x] FR-004 `VOCABULARY_VERSION` rises to 4 and is recorded.
- [x] FR-005 Generated outputs (`VOCABULARY.md`, `docs/vocabulary.md`, `docs/gallery.md`) regenerated.

## Success criteria

- [x] SC-001 `npm run verify` passes at version 4 with 184 probes and 31/31 primitives green.
- [x] SC-002 Default caption golden hash unchanged (no `golden/CHANGES.md` entry).
- [x] SC-003 Every new enum value passes palette, reactivity and budget gates on both backgrounds.
