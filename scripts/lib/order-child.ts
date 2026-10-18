/**
 * Child entry for the fresh-process order check (issue #55) — spawned by
 * `scripts/lib/orderProcesses.ts`, not run by hand. Renders one contiguous
 * half of the order-check sequence for every order-check case, in a completely
 * fresh process (no warm-up from any earlier frame), and prints the hashes as
 * JSON on stdout. Offline: renders fixed frames, prints, exits.
 *
 *   node --import tsx scripts/lib/order-child.ts --start 0 --end 4 [--stateful]
 */
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec } from "../../src/specInterpreter";
import { PRIMITIVES, sanitizeLayer } from "../../src/primitives/registry";
import { orderCheckCases, renderCaseFrameHashes, sequenceFrames, type GoldenApi } from "./goldenHashes";
import { wrapStateful } from "./orderProcesses";

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i === -1 || i + 1 >= argv.length ? null : argv[i + 1];
};
const startRaw = flag("--start");
const endRaw = flag("--end");
const start = startRaw === null ? NaN : Number(startRaw);
const end = endRaw === null ? NaN : Number(endRaw);
if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) {
  console.error("usage: order-child.ts --start <int> --end <int> [--stateful]");
  process.exit(2);
}

let api: GoldenApi = {
  createCanvas: createCanvas as GoldenApi["createCanvas"],
  drawSpec,
  PRIMITIVES,
  sanitizeLayer,
};
if (argv.includes("--stateful")) api = wrapStateful(api);

// The contiguous half [start,end) of the sequence, rendered in ascending frame
// order — the shape a host produces when a worker renders one range of a file.
const seq = sequenceFrames().slice(start, end);
const out: Record<string, Record<number, string>> = {};
for (const c of orderCheckCases(api)) out[c.key] = renderCaseFrameHashes(api, c, seq);
console.log(JSON.stringify({ cases: out }));
