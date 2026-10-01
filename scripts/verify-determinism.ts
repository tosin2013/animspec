/**
 * Determinism gate (AnimSpec-only). Offline, no LLM/network. Exits non-zero on failure.
 *
 *   1. No nondeterminism sources (Math.random / Date) in src/ code.
 *   2. Two independent renders of every primitive + composite hash identically.
 *   3. Hashes match the committed golden file (golden/hashes.json).
 *   4. Reports which primitives do not react to the signal (quiet == loud).
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

// 1. Static purity: strip comments, then look for nondeterminism sources.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []);
const impure: string[] = [];
for (const file of walk(path.join(ROOT, "src"))) {
  const code = stripComments(fs.readFileSync(file, "utf8"));
  if (/Math\.random|Date\.now|new Date\(|performance\.now/.test(code)) impure.push(path.relative(ROOT, file));
}
check("no Math.random / Date / performance.now in src/", impure.length === 0, impure.join(", "));

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

// 4. Signal reactivity — informational until the vetting gates land (PRD: "reacts to the signal").
const flat = PRIMITIVES.map((p) => p.type).filter((t) => a[`${t}@quiet`] === a[`${t}@loud`]);
console.log(`  info  ${PRIMITIVES.length - flat.length}/${PRIMITIVES.length} primitives react to the signal` +
  (flat.length ? ` (identical quiet/loud: ${flat.join(", ")})` : ""));

if (failures > 0) {
  console.error(`\ndeterminism gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\ndeterminism gate passed");
