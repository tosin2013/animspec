#!/usr/bin/env node
/**
 * animspec render — the command-line renderer (spec 010).
 *
 *   animspec render <spec.json> --signal <track.asft> [--seed n]
 *                  [--start n] [--end n] [--width n] [--height n]
 *                  (--raw | --png <dir>)
 *
 * stdout in --raw mode carries only concatenated RGBA bytes, one
 * width × height × 4 block per frame in index order — a clean pipe into an
 * encoder. Everything else (progress, dropped layers, errors, the final
 * manifest) is JSON lines on stderr. Exit codes: 0 success, 2 usage or file
 * error, 3 corrupt signal track, 4 range outside the track.
 *
 * This file lives outside `src/` on purpose: the library stays pure (the
 * purity scan walks src/), and this command is the reference caller that does
 * the I/O. It imports the built public surface only.
 */
import { main } from "./render.js";

const [command, ...rest] = process.argv.slice(2);
if (command !== "render") {
  process.stderr.write(
    JSON.stringify({ error: command ? `unknown subcommand "${command}"` : "missing subcommand", exit: 2 }) + "\n",
  );
  process.exitCode = 2;
} else {
  process.exitCode = await main(rest);
}
