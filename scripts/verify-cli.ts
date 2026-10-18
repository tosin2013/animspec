/**
 * CLI gate (spec 010): spawns the built command (dist-cli/animspec.js — the
 * same artifact hosts install) and checks its promises end to end. Offline;
 * exits non-zero on failure.
 *
 *   1. Raw stdout is byte-identical to an in-process drawSpec render.
 *   2. A half-open range equals the same frames of the full render (chunk
 *      equality — the reason the command exists).
 *   3. PNG output decodes to the same pixels.
 *   4. Dropped layers are reported on stderr and the rest still renders.
 *   5. The manifest carries the versions and the range.
 *   6. Exit codes: 0 success, 2 usage/file, 3 corrupt track, 4 bad range.
 *   7. Bounded memory (issue #67): a long render with a fast consumer keeps a
 *      reused canvas (no per-frame growth), and a paused consumer stalls the
 *      renderer on drain instead of buffering every frame.
 *
 *   npm run verify:cli        (expects `npm run build` to have run — `check` does)
 */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { drawSpec } from "../src/specInterpreter";
import { VOCABULARY_VERSION as VOCAB } from "../src/primitives/registry";
import { encodeSignalTrack, decodeSignalTrack } from "../src/signalframe/index";
import type { SignalFrame } from "../src/types";

const ROOT = process.cwd();
const BIN = path.join(ROOT, "dist-cli", "animspec.js");
const DIMS = { width: 320, height: 180 };
const SEED = 7;
const FRAMES = 8;

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures++; }
};

interface RunResult { status: number; stdout: Buffer; stderr: string; }
const run = (args: string[]): RunResult => {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd: ROOT, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status ?? -1, stdout: r.stdout as Buffer, stderr: (r.stderr as Buffer).toString("utf8") };
};

// ---- fixture: a small spec + track built by the encoder ---------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "animspec-cli-"));
try {
  const fps = 30;
  const frames: SignalFrame[] = Array.from({ length: FRAMES }, (_, i) => {
    const level = 0.05 + 0.9 * (0.5 + 0.5 * Math.sin(i / 2.3));
    return {
      index: i,
      t: i / fps,
      values: Float64Array.from({ length: 16 }, (_, k) => level * ((Math.sin(k / 4 + i / 5) + 1) / 2)),
      spectrum: Float64Array.from({ length: 16 }, (_, k) => level * Math.max(0, 1 - k / 16)),
      amplitude: level,
      energy: level * 0.8,
      ...(i === 2 ? { labels: ["CLI 0123"] } : {}),
    };
  });
  const track = encodeSignalTrack({ fps, frames });
  const trackPath = path.join(tmp, "fixture.asft");
  fs.writeFileSync(trackPath, track.data);
  if (track.sidecar !== null) fs.writeFileSync(`${trackPath}.ndjson`, track.sidecar);

  const specPath = path.join(tmp, "fixture.spec.json");
  fs.writeFileSync(specPath, JSON.stringify({ background: "black", layers: [{ type: "grid" }, { type: "wave" }] }));
  const unknownSpecPath = path.join(tmp, "unknown.spec.json");
  fs.writeFileSync(unknownSpecPath, JSON.stringify({ background: "black", layers: [{ type: "grid" }, { type: "definitely-not-a-thing" }] }));

  if (!fs.existsSync(BIN)) {
    check("built command exists", false, "run: npm run build (check does this)");
  } else {
    // ---- in-process reference render ---------------------------------------

    const decoded = decodeSignalTrack({ data: track.data, sidecar: track.sidecar });
    const refRgba = (frame: SignalFrame): Uint8ClampedArray => {
      const canvas = createCanvas(DIMS.width, DIMS.height);
      const ctx = canvas.getContext("2d");
      drawSpec(ctx, DIMS, frame, { background: "black", layers: [{ type: "grid" }, { type: "wave" }] }, { reducedFlicker: true, creative: false, seed: SEED });
      return ctx.getImageData(0, 0, DIMS.width, DIMS.height).data;
    };
    const sha = (b: Uint8Array): string => crypto.createHash("sha256").update(b).digest("hex");

    // ---- 1. full render vs in-process --------------------------------------

    const full = run(["render", specPath, "--signal", trackPath, "--seed", String(SEED), "--width", String(DIMS.width), "--height", String(DIMS.height), "--raw"]);
    check("full render exits 0", full.status === 0, `exit ${full.status}: ${full.stderr.slice(-200)}`);
    const byteLen = FRAMES * DIMS.width * DIMS.height * 4;
    check("raw stdout is exactly the frame bytes", full.stdout.byteLength === byteLen, `${full.stdout.byteLength} of ${byteLen}`);

    let ref = Buffer.alloc(0);
    for (const f of decoded.frames) ref = Buffer.concat([ref, Buffer.from(refRgba(f).buffer, refRgba(f).byteOffset, refRgba(f).byteLength)]);
    check("stdout matches the in-process render", sha(full.stdout) === sha(ref));

    // ---- 2. chunk equality --------------------------------------------------

    const chunk = run(["render", specPath, "--signal", trackPath, "--seed", String(SEED), "--width", String(DIMS.width), "--height", String(DIMS.height), "--start", "3", "--end", "6", "--raw"]);
    check("chunk render exits 0", chunk.status === 0, `exit ${chunk.status}`);
    const frameLen = DIMS.width * DIMS.height * 4;
    check("chunk equals the same frames of the full render", chunk.stdout.equals(full.stdout.subarray(3 * frameLen, 6 * frameLen)));
    check("chunk stdout is exactly 3 frames", chunk.stdout.byteLength === 3 * frameLen);

    // ---- 3. PNG output ------------------------------------------------------

    const pngDir = path.join(tmp, "png");
    const pngRun = run(["render", specPath, "--signal", trackPath, "--seed", String(SEED), "--width", String(DIMS.width), "--height", String(DIMS.height), "--start", "3", "--end", "5", "--png", pngDir]);
    check("png render exits 0", pngRun.status === 0 && pngRun.stdout.byteLength === 0, `exit ${pngRun.status}, stdout ${pngRun.stdout.byteLength}`);
    let pngOk = fs.existsSync(path.join(pngDir, "000003.png")) && fs.existsSync(path.join(pngDir, "000004.png")) && !fs.existsSync(path.join(pngDir, "000002.png"));
    if (pngOk) {
      for (const [n, idx] of [[0, 3], [1, 4]] as const) {
        const img = await loadImage(path.join(pngDir, `${String(idx).padStart(6, "0")}.png`));
        const canvas = createCanvas(DIMS.width, DIMS.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, DIMS.width, DIMS.height).data;
        const want = refRgba(decoded.frames[idx]);
        pngOk &&= data.every((v, i) => v === want[i]);
      }
    }
    check("png frames decode to the same pixels", pngOk);

    // ---- 4. dropped layers + manifest --------------------------------------

    const unknown = run(["render", unknownSpecPath, "--signal", trackPath, "--seed", String(SEED), "--width", String(DIMS.width), "--height", String(DIMS.height), "--raw"]);
    check("unknown layer still renders (exit 0)", unknown.status === 0, `exit ${unknown.status}`);
    check("dropped layer reported on stderr", unknown.stderr.includes('"dropped":["definitely-not-a-thing"]'));
    check("remaining layers still produce frames", unknown.stdout.byteLength === byteLen);

    const lines = full.stderr.trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    const manifest = lines.find((l) => "manifest" in l)?.manifest as Record<string, unknown> | undefined;
    check(
      "manifest carries versions, range and count",
      !!manifest &&
        manifest.version === JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version &&
        manifest.vocabulary === VOCAB &&
        manifest.arch === process.arch &&
        manifest.frames === FRAMES &&
        manifest.start === 0 &&
        manifest.end === FRAMES,
      JSON.stringify(manifest),
    );
    check("per-frame progress lines on stderr", lines.filter((l) => "frame" in l).length === FRAMES);

    // ---- 5. exit codes ------------------------------------------------------

    const noSignal = run(["render", specPath, "--raw"]);
    check("exit 2 without --signal", noSignal.status === 2, `exit ${noSignal.status}`);
    const bothModes = run(["render", specPath, "--signal", trackPath, "--raw", "--png", path.join(tmp, "x"), "--width", String(DIMS.width), "--height", String(DIMS.height)]);
    check("exit 2 with two output modes", bothModes.status === 2, `exit ${bothModes.status}`);

    const badTrack = path.join(tmp, "bad.asft");
    fs.writeFileSync(badTrack, Buffer.from("this is not a track", "utf8"));
    const corrupt = run(["render", specPath, "--signal", badTrack, "--raw", "--width", String(DIMS.width), "--height", String(DIMS.height)]);
    check("exit 3 on a corrupt track", corrupt.status === 3, `exit ${corrupt.status}: ${corrupt.stderr.slice(-120)}`);

    const badRange = run(["render", specPath, "--signal", trackPath, "--end", "999", "--raw", "--width", String(DIMS.width), "--height", String(DIMS.height)]);
    check("exit 4 on a range past the track", badRange.status === 4, `exit ${badRange.status}`);

    // ---- 6. backpressure and bounded memory (issue #67) ----------------------

    // A long track (2000 frames) and two render shapes:
    //   6a  a fast consumer (/dev/null) over 600 frames at 720p — the canvas
    //       must be reused, not allocated per frame;
    //   6b  a paused consumer over a 1080p range — the CLI must stall on
    //       drain with bounded memory instead of buffering every frame.
    // Both bounds are generous: the bug grew ~8 MB per rendered frame, so a
    // fixed renderer sits far under 500 MB while a regressed one blows past.

    const rssKb = (pid: number): number => {
      const r = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" });
      const v = Number((r.stdout || "").trim());
      return Number.isFinite(v) && v > 0 ? v : 0;
    };
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    const longFrames = 2000;
    const longTrackPath = path.join(tmp, "long.asft");
    const longEncoded = encodeSignalTrack({
      fps: 30,
      frames: Array.from({ length: longFrames }, (_, i) => {
        const level = 0.1 + 0.8 * (0.5 + 0.5 * Math.sin(i / 9));
        return {
          index: i,
          t: i / 30,
          values: Float64Array.from({ length: 16 }, (_, k) => level * ((Math.sin(k / 4 + i / 11) + 1) / 2)),
          spectrum: Float64Array.from({ length: 16 }, (_, k) => level * Math.max(0, 1 - k / 16)),
          amplitude: level,
          energy: level * 0.8,
        } as SignalFrame;
      }),
    });
    fs.writeFileSync(longTrackPath, longEncoded.data);
    const longSpecPath = path.join(tmp, "long.spec.json");
    fs.writeFileSync(longSpecPath, JSON.stringify({ background: "black", layers: [{ type: "grid" }, { type: "wave" }] }));

    const BOUND_MB = 500;

    // 6a. fast consumer: nothing pushes back, so this catches per-frame canvas
    // allocation (the memory would grow ~1 native surface per frame).
    {
      const child = spawn(process.execPath, [BIN, "render", longSpecPath, "--signal", longTrackPath, "--seed", "0", "--width", "1280", "--height", "720", "--start", "0", "--end", "600", "--raw"], { stdio: ["ignore", "ignore", "pipe"] });
      if (child.pid === undefined) throw new Error("spawn failed");
      const pid: number = child.pid;
      let peak = 0;
      const sampler = setInterval(() => { peak = Math.max(peak, rssKb(pid)); }, 100);
      const status = await new Promise<number | null>((resolve) => child.on("close", (c) => { clearInterval(sampler); resolve(c); }));
      check(
        "long render into a fast consumer stays bounded and succeeds",
        status === 0 && peak < BOUND_MB * 1024,
        `exit ${status}, peak RSS ${(peak / 1024).toFixed(0)} MB (bound ${BOUND_MB} MB)`,
      );
    }

    // 6b. paused consumer: the pipe fills after ~1 frame, so a correct CLI
    // stalls on drain while a regressed one keeps buffering every frame.
    {
      const child = spawn(process.execPath, [BIN, "render", longSpecPath, "--signal", longTrackPath, "--seed", "0", "--width", "1920", "--height", "1080", "--start", "0", "--end", String(longFrames), "--raw"], { stdio: ["ignore", "pipe", "pipe"] });
      if (child.pid === undefined) throw new Error("spawn failed");
      const pid: number = child.pid;
      child.stdout?.pause();
      let peak = 0;
      const sampler = setInterval(() => { peak = Math.max(peak, rssKb(pid)); }, 100);
      await sleep(3000);
      clearInterval(sampler);
      const alive = child.exitCode === null && child.signalCode === null;
      child.kill("SIGKILL");
      await new Promise<void>((resolve) => child.on("close", () => resolve()));
      check(
        "a paused consumer stalls the renderer with bounded memory",
        alive && peak < BOUND_MB * 1024,
        `peak RSS ${(peak / 1024).toFixed(0)} MB (bound ${BOUND_MB} MB), ${alive ? "stalled on drain as designed" : "exited early"}`,
      );
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\ncli gate FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\ncli gate passed");
