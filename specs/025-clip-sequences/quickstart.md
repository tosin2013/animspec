# Quickstart: Clip Sequences

1. Run `npm run verify`. All gates pass; the composition gate includes a 12+12-layer fade.
2. Compare the golden hashes key by key against `main`. Expect 0 changed, with `sequence:*@*`
   added (18 per set).
3. Render the contract's example from the CLI over frames 80–110, which crosses the wipe.
   Rendering frames 95–100 alone gives byte-identical frames.
4. Run `npm run showcase:generate`, then strip-render `shot-list`. Expect title → wipe →
   scene → iris → hero → fade → end card.
