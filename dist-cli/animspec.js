#!/usr/bin/env node
/**
 * animspec render — the command-line renderer (spec 010).
 *
 *   animspec render <spec.json> --signal <track.asft> [--seed n]
 *                  [--start n] [--end n] [--width n] [--height n]
 *                  [--strict] (--raw | --png <dir>)
 *
 * stdout in --raw mode carries only concatenated RGBA bytes, one
 * width × height × 4 block per frame in index order — a clean pipe into an
 * encoder. Everything else (progress, dropped layers, the validator's errors,
 * the final manifest) is JSON lines on stderr. --strict exits 2 when the spec
 * has any validation error or dropped layer. Exit codes: 0 success, 2 usage or file
 * error, 3 corrupt signal track, 4 range outside the track, 5 a missing or
 * mismatched asset (spec 022).
 *
 *   animspec verify-plugin <module> [--json]   (spec 024)
 *
 * runs the plugin verifier; exit 0 every check passed, 6 any check failed,
 * 2 usage or load error.
 *
 * This file lives outside `src/` on purpose: the library stays pure (the
 * purity scan walks src/), and this command is the reference caller that does
 * the I/O. It imports the built public surface only.
 */
import { main } from "./render.js";
import { verifyPluginMain } from "./verify-plugin.js";
const [command, ...rest] = process.argv.slice(2);
if (command === "verify-plugin") {
    process.exitCode = await verifyPluginMain(rest);
}
else if (command !== "render") {
    process.stderr.write(JSON.stringify({ error: command ? `unknown subcommand "${command}"` : "missing subcommand", exit: 2 }) + "\n");
    process.exitCode = 2;
}
else {
    process.exitCode = await main(rest);
}
