/**
 * `animspec verify-plugin <module> [--json]` (spec 024): run the plugin
 * verifier (`animspec/verify`) against a plugin module's default export.
 * Exit codes, documented and stable: 0 every check passed, 6 any check failed,
 * 2 usage or load error. `--json` prints the report as one JSON object.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_CHECK_FAILED = 6;

export async function verifyPluginMain(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({ args: argv, options: { json: { type: "boolean" } }, allowPositionals: true });
  } catch (e) {
    process.stderr.write(JSON.stringify({ error: (e as Error).message, exit: EXIT_USAGE }) + "\n");
    return EXIT_USAGE;
  }
  const file = args.positionals[0];
  if (!file || args.positionals.length !== 1) {
    process.stderr.write(JSON.stringify({ error: "usage: animspec verify-plugin <module> [--json]", exit: EXIT_USAGE }) + "\n");
    return EXIT_USAGE;
  }
  let report;
  try {
    const mod = await import(pathToFileURL(path.resolve(file)).href);
    const { verifyPlugin } = await import("../dist-verify/index.js");
    report = verifyPlugin(mod.default);
  } catch (e) {
    process.stderr.write(JSON.stringify({ error: `plugin ${file}: ${(e as Error).message}`, exit: EXIT_USAGE }) + "\n");
    return EXIT_USAGE;
  }
  if (args.values.json) process.stdout.write(JSON.stringify(report) + "\n");
  else {
    process.stdout.write(`plugin ${report.plugin.id}@${report.plugin.version} (${report.plugin.licence})\n`);
    for (const p of report.primitives) {
      for (const c of p.checks) process.stdout.write(`  ${c.pass ? "ok  " : "FAIL"}  ${c.name.padEnd(11)} ${p.type}${c.pass ? "" : `  ${c.measured} (allowed ${c.allowed})${c.case ? ` — ${c.case}` : ""}`}\n`);
    }
    process.stdout.write(report.ok ? "verify-plugin passed\n" : "verify-plugin FAILED\n");
  }
  return report.ok ? EXIT_OK : EXIT_CHECK_FAILED;
}
