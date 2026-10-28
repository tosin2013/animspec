# Quickstart: Arcade HUD

Contract: [contracts/arcade-hud.md](contracts/arcade-hud.md).

## 1. Gates and reference cases

```sh
npm run verify:registry      # vocabulary 18 recorded; both primitives well-formed
npm run verify:gates         # purity, palette, reactivity, budget, transparency: 42/42
npm run verify:determinism   # versus-bars lengths and palette, hud-score labels and drive
```

**Expected**: all pass, and every existing hash is unchanged.

## 2. Versus bars at two data states (US1)

The determinism gate renders `versus-bars` with coords `[{x:1,y:1},{x:1,y:1}]` and
`[{x:0.4,y:0.6},{x:0.8,y:0.8}]`.

**Expected**: the left fill is 40% of its bar, the left tail covers 40–60%, and the right fill
is 80% with no tail. Every pixel is bg, fg, accent or #808080.

## 3. HUD text (US2)

**Expected**: `hud-score` with labels `["12340","50000","2"]` shows `1UP 12340`,
`HI-SCORE 50000` and `CREDIT 2`. New labels change the frame. With `drive: "none"`, a quiet and
a loud frame are identical.

## 4. Profiles (US3)

```sh
npm run showcase:generate    # writes showcase/cps2-versus.gif (384×224) and tate-shooter.gif (224×288)
```

**Expected**: the versus loop shows the right bar take a hit and its tail drain, and the timer
ticks from 99 to 98. The shooter loop's score rises.

## 5. Whole suite

```sh
npm run verify
```
