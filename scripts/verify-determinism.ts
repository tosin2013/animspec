/**
 * Determinism gate (AnimSpec-only). Offline, no LLM/network. Exits non-zero on failure.
 *
 *   1. No nondeterminism sources (Math.random / Date) and no file, network or
 *      process access in src/ code (static scan).
 *   2. Two independent renders of every primitive + composite hash identically.
 *   3. Hashes match the committed golden file (golden/hashes.json).
 *
 * Whether a primitive responds to the signal is checked by the reactivity gate
 * in scripts/verify-gates.ts, with time held fixed.
 *
 *   npx tsx scripts/verify-determinism.ts            # verify
 *   npx tsx scripts/verify-determinism.ts --update   # rewrite the golden file
 */
import fs from "fs";
import path from "path";
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";
import { PRIMITIVES } from "../src/primitives/registry";
import { computeHashes, type GoldenApi } from "./lib/goldenHashes";

const ROOT = process.cwd();
const GOLDEN = path.join(ROOT, "golden", "hashes.json");
const update = process.argv.includes("--update");

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures++; }
};

// 1. Static purity: strip comments, then look for nondeterminism sources and
//    IO (no file/network/process modules or references in src/ — the vetting
//    gates' purity rule, enforced statically so unexecuted branches are covered).
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []);
const impure: string[] = [];
const ioOffenders: string[] = [];
// File / network / process / worker imports and references, in any form:
// static `import ... from`, dynamic `await import(...)`, `require(...)`, with
// or without the `node:` prefix, and with an optional `/subpath` (so
// `fs/promises` is caught). Also flags `fetch(`, `XMLHttpRequest`, `WebSocket`
// and `process.cwd` references.
const IO_MODULE = "(fs|fs/promises|path|net|tls|http|http2|https|dns|dgram|child_process|worker_threads)";
const IO_PATTERN = new RegExp(
  String.raw`(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](node:)?${IO_MODULE}(?:/[\w./-]*)?["']` +
    String.raw`|fetch\s*\(|XMLHttpRequest|WebSocket|process\.cwd`,
);
// Self-check: these must ALL be caught, or the pattern has silently regressed.
const IO_SELF_CHECK: Array<[string, string]> = [
  [`import fs from "fs";`, "fs"],
  [`import { readFile } from "fs/promises";`, "fs/promises"],
  [`import fsp from "node:fs/promises";`, "fs/promises"],
  [`const fs = await import("node:fs");`, "fs"],
  [`import tls from "node:tls";`, "tls"],
  [`import http2 from "http2";`, "http2"],
];
for (const [line, what] of IO_SELF_CHECK) {
  if (!IO_PATTERN.test(line)) ioOffenders.push(`static-scan self-check missed: ${line} (${what})`);
}
for (const file of walk(path.join(ROOT, "src"))) {
  const code = stripComments(fs.readFileSync(file, "utf8"));
  const rel = path.relative(ROOT, file);
  if (/Math\.random|Date\.now|new Date\(|performance\.now/.test(code)) impure.push(rel);
  if (IO_PATTERN.test(code)) ioOffenders.push(rel);
}
check("no Math.random / Date / performance.now in src/", impure.length === 0, impure.join(", "));
check("no file/network imports or process.cwd/fetch in src/", ioOffenders.length === 0, ioOffenders.join(", "));

// 2. Two independent renders agree.
const api: GoldenApi = { createCanvas: createCanvas as GoldenApi["createCanvas"], drawSpec, PRIMITIVES };
const a = computeHashes(api);
const b = computeHashes(api);
const keys = Object.keys(a);
const unstable = keys.filter((k) => a[k] !== b[k]);
check(`two renders are byte-identical (${keys.length} cases)`, unstable.length === 0, unstable.slice(0, 8).join(", "));

// 3. Golden file.
if (update) {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify(a, null, 2) + "\n");
  console.log(`  wrote ${path.relative(ROOT, GOLDEN)} (${keys.length} hashes)`);
} else if (!fs.existsSync(GOLDEN)) {
  check("golden file exists", false, "run: npm run golden:update");
} else {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8")) as Record<string, string>;
  const changed = keys.filter((k) => golden[k] !== undefined && golden[k] !== a[k]);
  const missing = keys.filter((k) => golden[k] === undefined);
  const stale = Object.keys(golden).filter((k) => a[k] === undefined);
  check("hashes match golden", changed.length === 0, changed.slice(0, 8).join(", "));
  check("every case has a golden hash", missing.length === 0, `${missing.slice(0, 8).join(", ")} — run: npm run golden:update`);
  check("no stale golden entries", stale.length === 0, stale.slice(0, 8).join(", "));
}

if (failures > 0) {
  console.error(`\ndeterminism gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\ndeterminism gate passed");
