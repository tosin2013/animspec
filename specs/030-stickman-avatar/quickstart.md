# Quickstart: Stickman

Contract: [contracts/stickman.md](contracts/stickman.md).

```sh
npm run verify:registry      # vocabulary 23; stickman core, in the data-viz/minimal/arcade kits
npm run verify:gates         # purity, palette, reactivity, budget, transparency; composition 12×12
npm run verify:determinism   # actions, targets, speech, coords, drive, crowds, pixel exactness
npm run showcase:generate    # stickman-presenter, stickman-fight, stickman-dance
npm run verify
```

**Expected**: every check passes, and every existing hash is unchanged.

**By hand**: render the presenter spec in the contract with labels `["sales doubled"]`. The
figure stands on the left, its arm points at the chart's newest point, and a bubble above it
reads "sales doubled".
