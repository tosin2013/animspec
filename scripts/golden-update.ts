/**
 * Reference-set refresh (specs/002-cross-machine-frames, research.md R8).
 *
 * Maintainer command. Renders the native set directly and the other processor
 * type in a container, then replaces both sets together or neither.
 *
 *   npm run golden:update                          # refresh both sets
 *   npx tsx scripts/golden-update.ts --render-set --out <dir>
 *                                                  # render this machine's set into <dir>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createCanvas } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";
import { PRIMITIVES, sanitizeLayer } from "../src/primitives/registry";
import { DIMS, renderCases, type GoldenApi } from "./lib/goldenHashes";
import { otherType, processorType, readSet, comparePixels, writeSet, type ProcessorType } from "./lib/referenceSets";

const ROOT = process.cwd();
const CROSS_TYPE_TOLERANCE = 8;

const hashRgba = (rgba: Uint8ClampedArray): string => crypto.createHash("sha256").update(rgba).digest("hex");

function renderNative(): Array<{ key: string; rgba: Uint8ClampedArray; hash: string; width: number; height: number }> {
  const api: GoldenApi = { createCanvas: createCanvas as GoldenApi["createCanvas"], drawSpec, PRIMITIVES, sanitizeLayer };
  return renderCases(api).map(({ key, rgba }) => ({ key, rgba, hash: hashRgba(rgba), width: DIMS.width, height: DIMS.height }));
}

async function renderSet(out: string): Promise<void> {
  const cases = renderNative();
  await writeSet(out, cases);
  console.log(`  wrote ${out} (${cases.length} cases)`);
}

function dockerRender(other: ProcessorType, out: string): void {
  const repo = ROOT;
  const workVol = `animspec-node-modules-${other}`;
  // Create the out dir on the host first: the mount target must exist owned by
  // this user, otherwise Docker creates it as root and the result is unreadable.
  fs.mkdirSync(out, { recursive: true });
  // Copy without node_modules (the volume mounted at /work/node_modules is a
  // live mountpoint, so removing it after the copy fails); then npm ci fills it.
  execFileSync(
    "docker",
    [
      "run", "--rm", "--platform", `linux/${other === "arm64" ? "arm64" : "amd64"}`,
      "-v", `${repo}:/in:ro`,
      "-v", `${workVol}:/work/node_modules`,
      "-v", `${out}:/out`,
      "node:22",
      "bash", "-c",
      "mkdir -p /work && tar -C /in --exclude=node_modules -cf - . | tar -C /work -xf - && cd /work && npm ci --silent && npx tsx scripts/golden-update.ts --render-set --out /out",
    ],
    { stdio: "inherit" },
  );
}

function dockerInfoOk(): boolean {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

interface SetDiff {
  changed: string[];
  added: string[];
  removed: string[];
}

/** Cases whose hash changed, were added or were removed, vs the current set. */
function diffSet(fresh: Record<string, string>, current: Record<string, string>): SetDiff {
  return {
    changed: Object.keys(fresh).filter((k) => current[k] !== undefined && current[k] !== fresh[k]),
    added: Object.keys(fresh).filter((k) => current[k] === undefined),
    removed: Object.keys(current).filter((k) => fresh[k] === undefined),
  };
}

/** Largest cross-type difference between two freshly rendered sets. */
function largestCrossDiff(a: Map<string, Uint8ClampedArray>, b: Map<string, Uint8ClampedArray>): number {
  let largest = 0;
  for (const [key, rgba] of a) {
    const other = b.get(key);
    if (!other) continue;
    const { maxDelta } = comparePixels(rgba, other);
    if (maxDelta > largest) largest = maxDelta;
  }
  return largest;
}

async function refresh(): Promise<void> {
  const native = processorType();
  if (native === null) {
    console.error(`FAIL  golden:update: unsupported processor type "${process.arch}" on ${process.platform} — no reference set was changed`);
    process.exit(1);
  }
  if (!dockerInfoOk()) {
    console.error(`FAIL  golden:update: Docker is unavailable (docker info failed) — no reference set was changed`);
    process.exit(1);
  }
  const other = otherType(native);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "animspec-golden-"));
  const nativeTmp = path.join(tmp, native);
  const otherTmp = path.join(tmp, other);
  try {
    await renderSet(nativeTmp);
    try {
      dockerRender(other, otherTmp);
    } catch {
      console.error(`FAIL  golden:update: container for ${other} failed — no reference set was changed`);
      process.exit(1);
    }
    if (!fs.existsSync(path.join(otherTmp, "hashes.json"))) {
      console.error(`FAIL  golden:update: container for ${other} produced no set — no reference set was changed`);
      process.exit(1);
    }

    // Validate the temporary sets before replacing anything: same keys,
    // frames match their hashes, and the cross-type tolerance holds.
    const freshNative = await readSet(nativeTmp);
    const freshOther = await readSet(otherTmp);
    const keyDiff = [
      ...Object.keys(freshNative.hashes).filter((k) => !(k in freshOther.hashes)).map((k) => `${native}-only: ${k}`),
      ...Object.keys(freshOther.hashes).filter((k) => !(k in freshNative.hashes)).map((k) => `${other}-only: ${k}`),
    ];
    if (keyDiff.length > 0) {
      console.error(`FAIL  golden:update: temporary sets disagree on case keys (${keyDiff.join(", ")}) — no reference set was changed`);
      process.exit(1);
    }
    for (const [setName, set] of [[native, freshNative], [other, freshOther]] as const) {
      for (const [key, rgba] of set.frames) {
        if (crypto.createHash("sha256").update(rgba).digest("hex") !== set.hashes[key]) {
          console.error(`FAIL  golden:update: temporary ${setName} frame ${key} does not match its hash — no reference set was changed`);
          process.exit(1);
        }
      }
    }
    const largest = largestCrossDiff(freshNative.frames, freshOther.frames);
    if (largest > CROSS_TYPE_TOLERANCE) {
      console.error(`FAIL  golden:update: temporary sets differ by ${largest} of 255 (allowed ${CROSS_TYPE_TOLERANCE}) — no reference set was changed`);
      process.exit(1);
    }

    // Report per set against the current committed sets.
    console.log(`golden:update`);
    let totalChanged = 0;
    for (const [setName, fresh] of [[`${native} (native)`, freshNative], [`${other} (container)`, freshOther]] as const) {
      const current = JSON.parse(fs.readFileSync(path.join(ROOT, "golden", setName.split(" ")[0], "hashes.json"), "utf8")) as Record<string, string>;
      const { changed, added, removed } = diffSet(fresh.hashes, current);
      totalChanged += changed.length + added.length + removed.length;
      const parts = [...changed.map((k) => k), ...added.map((k) => `${k} (added)`), ...removed.map((k) => `${k} (removed)`)];
      console.log(`  ${setName.padEnd(16)} ${Object.keys(fresh.hashes).length} cases   ${changed.length + added.length + removed.length} changed${parts.length ? `: ${parts.join(", ")}` : ""}`);
    }
    console.log(`  cross-type          largest difference ${largest} of 255 (allowed ${CROSS_TYPE_TOLERANCE})`);
    if (totalChanged === 0) {
      console.log(`  no changes — writing nothing`);
      return;
    }
    for (const [type, dir] of [[native, nativeTmp], [other, otherTmp]] as Array<[ProcessorType, string]>) {
      const dest = path.join(ROOT, "golden", type);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(dir, dest, { recursive: true });
    }
    console.log(`  replaced golden/${native} and golden/${other}`);
    console.log(`  next: add an entry to golden/CHANGES.md`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
if (args[0] === "--render-set") {
  const outFlag = args.indexOf("--out");
  if (outFlag === -1 || !args[outFlag + 1]) {
    console.error("usage: golden-update.ts --render-set --out <dir>");
    process.exit(1);
  }
  await renderSet(path.resolve(args[outFlag + 1]));
} else {
  await refresh();
}

export {};
