# Quickstart: Palette Profiles

```sh
npm run verify:validator     # profile kept or dropped and reported
npm run verify:determinism   # GB scene 4 colours; genesis grid; matrix 2 checkerboard; profile off = identical
npm run showcase:generate    # game-boy-dmg (160x144) and genesis (320x224) loops
npm run verify
```

**Expected**: all pass, and every existing hash is unchanged. The showcase generator prints the
genesis loop's distinct-colour count. The ceiling is 64.
