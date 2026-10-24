# Quickstart: Second Tone

1. Run `npm run verify`. All gates pass. `verify:determinism` lists the two-tone checks, and
   `verify:validator` lists "a pattern with b reports nothing".
2. Compare the golden hashes key by key against `main`. Expect 0 changed and 9 added
   (`grid:pattern-two-tone*`, `checker:pattern-two-tone`) in each set.
3. Run `npm run showcase:generate`, then open `showcase/two-tone-quilt.png`. Expect bone and
   sand blocks with gold accents. See [contracts/second-tone.md](contracts/second-tone.md)
   for the colour table.
