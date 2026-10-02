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
import { PRIMITIVES } from "../src/primitives/registry";
import { DIMS, renderCases, type GoldenApi } from "./lib/goldenHashes";
import { otherType, processorType, writeSet, type ProcessorType } from "./lib/referenceSets";

const ROOT = process.cwd();

const hashRgba = (rgba: Uint8ClampedArray): string => crypto.createHash("sha256").update(rgba).digest("hex");

function renderNative(): Array<{ key: string; rgba: Uint8ClampedArray; hash: string; width: number; height: number }> {
  const api: GoldenApi = { createCanvas: createCanvas as GoldenApi["createCanvas"], drawSpec, PRIMITIVES };
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

async function refresh(): Promise<void> {
  const native = processorType();
  if (native === null) {
    console.error(`FAIL  golden:update: unsupported processor type "${process.arch}" on ${process.platform} — no reference set was changed`);
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
    for (const [type, dir] of [[native, nativeTmp], [other, otherTmp]] as Array<[ProcessorType, string]>) {
      const dest = path.join(ROOT, "golden", type);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(dir, dest, { recursive: true });
    }
    console.log(`replaced golden/${native} and golden/${other}`);
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
