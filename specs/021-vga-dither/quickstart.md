# Quickstart: VGA Dither Scenes

1. Run `npm run verify`. All gates pass, `dither` is listed in the vetting gates, and the
   registry gate accepts vocabulary 14.
2. Compare the golden hashes key by key against `main`. Expect 0 changed. The additions are
   `dither@*`, `dither:*@*` and `caption:margin-0@*`.
3. Run `npm run showcase:generate`, then open `showcase/dos-adventure.gif`. It should match
   the approved prototype: a dithered sky and desert, the monolith, the terminal, the walking
   hero, and the verb/parser bar.
4. Run `npm run build` and `node dist-cli/...` with a spec that sets `pixelAspect: 1.2`. The
   manifest line includes `"pixelAspect":1.2`.
