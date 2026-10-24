# Quickstart: Plugin Slot

1. Run `npm run verify`. All gates pass, and every gate verdict for core primitives is
   unchanged after the gate code moves to `verify/`.
2. Compare the golden hashes key by key against `main`. Expect 0 changed and 0 added: core
   references never include plugins.
3. Run `node dist-cli/animspec.js verify-plugin scripts/fixtures/plugins/good.js` (exit 0),
   then the same with `random.js` (non-zero, determinism failed).
4. Run `node dist-cli/animspec.js render <spec using ext:good/starfield> --signal … --plugin …/good.js --png out/`.
   The manifest lists the plugin and `"guarantee":"core-only"`.
