/**
 * Fresh-process frame-order check (issue #55). A frame is a pure function of
 * `(AnimSpec, SignalFrame, seed)`, so module-level state — caches, memoised
 * bitmaps, lazily initialised tables, including state that only warms up after
 * the first frame a process draws — must not change output. The check spawns
 * two children (`order-child.ts`, one per contiguous half of the order-check
 * sequence) and compares their hashes with the in-process forward render.
 * Offline: children render fixed frames and print hashes, nothing else.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ORDER_SEQUENCE_LENGTH,
  orderCheckCases,
  renderCaseFrameHashes,
  sequenceFrames,
  type GoldenApi,
} from "./goldenHashes";

/** The child entry, next to this file. */
const CHILD_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "order-child.ts");

/** Startup + render budget per child; a stuck child must not hang the gate. */
const CHILD_TIMEOUT_MS = 120_000;

/**
 * Wrap a renderer with process-local state: after every draw it folds the
 * number of draws made so far in this process into one pixel. Every frame's
 * output then depends on what was drawn before it in the same process, so
 * fresh-process chunk hashes can no longer match a stateless in-process render
 * — exactly what the multi-process comparison must catch (the self-check).
 */
export function wrapStateful(api: GoldenApi): GoldenApi {
  let drawn = 0;
  return {
    ...api,
    drawSpec: (ctx, dims, frame, spec, opts, caption) => {
      api.drawSpec(ctx, dims, frame, spec, opts, caption);
      drawn += 1;
      const c = ctx as { fillStyle: string; fillRect: (x: number, y: number, w: number, h: number) => void };
      c.fillStyle = `rgb(${drawn & 255},${(drawn * 7) & 255},${(drawn * 13) & 255})`;
      c.fillRect(0, 0, 1, 1);
    },
  };
}

export interface FreshProcessOptions {
  /** Wrap the child renderer with process-local state (the self-check). */
  stateful?: boolean;
  /** Startup + render budget per child, in milliseconds. */
  timeoutMs?: number;
}

/** What the child prints: `caseKey → frameIndex → sha256`. */
interface ChildOutput {
  cases: Record<string, Record<number, string>>;
}

function spawnChild(start: number, end: number, opts: FreshProcessOptions): Promise<ChildOutput> {
  return new Promise((resolve, reject) => {
    const args = ["--import", "tsx", CHILD_SCRIPT, "--start", String(start), "--end", String(end)];
    if (opts.stateful) args.push("--stateful");
    const child = spawn(process.execPath, args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`order-child [${start},${end}) timed out after ${opts.timeoutMs ?? CHILD_TIMEOUT_MS}ms`));
    }, opts.timeoutMs ?? CHILD_TIMEOUT_MS);
    child.stdout?.on("data", (d: Buffer) => { out += d; });
    child.stderr?.on("data", (d: Buffer) => { err += d; });
    child.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`order-child [${start},${end}) exited with ${code}: ${err.slice(-400).trim()}`));
      } else {
        try {
          resolve(JSON.parse(out) as ChildOutput);
        } catch {
          reject(new Error(`order-child [${start},${end}) printed unparseable output: ${out.slice(0, 200)}`));
        }
      }
    });
  });
}

/**
 * Render each contiguous half of the sequence in its own fresh child process
 * and report every case/frame whose hash differs from the in-process forward
 * render, or that a child failed to produce. Throws if a child fails to run —
 * the gate must fail loudly, not silently skip. With `stateful: true` the
 * children carry process-local state while the parent renders statelessly, so
 * mismatches are expected: that is the self-check.
 */
export async function freshProcessChunkMismatches(api: GoldenApi, opts: FreshProcessOptions = {}): Promise<string[]> {
  const n = ORDER_SEQUENCE_LENGTH;
  const mid = Math.floor(n / 2);
  const seq = sequenceFrames(n);
  const cases = orderCheckCases(api);
  const chunks: Array<[number, number]> = [[0, mid], [mid, n]];

  const children: ChildOutput[] = await Promise.all(chunks.map(([s, e]) => spawnChild(s, e, opts)));

  const mismatches: string[] = [];
  for (const c of cases) {
    const forward = renderCaseFrameHashes(api, c, seq); // in-process, ascending order
    children.forEach((child, half) => {
      const [s, e] = chunks[half];
      const hashes = child.cases[c.key];
      if (!hashes) {
        mismatches.push(`${c.key}@missing-from-child${half}`);
        return;
      }
      // Each child answers only for its own contiguous range.
      for (const f of seq.slice(s, e)) {
        const childHash = hashes[f.index];
        if (childHash === undefined) mismatches.push(`${c.key}@frame${f.index}@missing-from-child${half}`);
        else if (childHash !== forward[f.index]) mismatches.push(`${c.key}@frame${f.index}`);
      }
    });
  }
  return mismatches;
}
