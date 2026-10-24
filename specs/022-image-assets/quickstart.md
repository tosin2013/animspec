# Quickstart: Image Assets

1. Run `npm run verify`. All gates pass, and `image` appears in the vetting gates with a
   probe asset.
2. Compare the golden hashes key by key against `main`. Expect 0 changed and only `image*`
   keys added (33 per set).
3. Run the CLI round trip:
   - Write a PNG, compute its sha256, and put the spec next to it.
   - `animspec render spec.json --signal t.asft --raw` twice should give identical bytes.
   - Flip one byte in the PNG: the CLI exits 5 and names the asset.
4. Run `npm run showcase:generate`, then open `showcase/parallax-forest.gif`. It shows four
   planes scrolling at different speeds behind the hero.
