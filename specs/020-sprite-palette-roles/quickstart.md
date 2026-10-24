# Quickstart: Sprite Palette Roles

Validation guide. See [contracts/palette-roles.md](contracts/palette-roles.md) and
[data-model.md](data-model.md) for the rules.

## Prerequisites

- Node.js 22+, `npm ci`, on the `feature/020-sprite-palette-roles` branch.

## 1. Everything passes offline

```sh
npm run verify
```

Expected:
- All gates pass.
- `verify:registry` prints `PASS characters are well-formed` and four
  `PASS character rule catches ...` lines.
- `verify:gates` shows the palette gate's `roles` mode passing for every primitive.

## 2. Existing frames did not move

```sh
git diff --stat main -- golden/arm64/hashes.json golden/x64/hashes.json
```

Expected: the only additions are the `sprite:hero-*` keys, with no changed values. The
determinism gate enforces this; the diff is a human cross-check.

## 3. The hero in colour and in monochrome

```sh
npm run showcase:generate
open showcase/hero-roles.gif showcase/hero-mono.png
```

Expected:
- `hero-roles`: hair, skin, gold, cloak and boots, each in its own colour, walking.
- `hero-mono`: the same character in dark, body and highlight greys, reading clearly on
  black.

## 4. Spec validation

The validator cases in `verify:validator` cover the five messages in the contract table. To
check by hand:

```sh
npx tsx -e 'import {validateAnimSpec} from "./src/specValidator"; console.log(validateAnimSpec({roles:{fg:"#fff",hair:"red",skin:"#f0c8a0"},layers:[{type:"sprite",character:"hero"}]}).errors)'
```

Expected: two errors (`fg` shadows a built-in, `hair` is not hex). `skin` is kept.

## 5. Spec 019 readiness

The roles contract lives in `Palette`, and the amended Principle III names roles generically.
Adding `fg2` means one new role name and no amendment.
