/**
 * The render subcommand (spec 010). Reads a spec (validated) and a signal
 * track (per-frame reads; the sidecar parsed once), draws the requested frame
 * range with `drawSpec`, and writes frames to stdout (raw RGBA) or a PNG
 * folder. Reports on stderr as JSON lines. See cli/animspec.ts for the
 * contract. Offline; no network; the only files touched are the arguments.
 */
import { parseArgs } from "node:util";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import {
  drawSpec,
  validateAnimSpec,
  readSignalTrackHeader,
  readSignalFrame,
  indexSignalTrackSidecar,
  VOCABULARY_VERSION,
} from "../dist/index.js";

const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_TRACK = 3;
const EXIT_RANGE = 4;

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string; dependencies: { "@napi-rs/canvas": string } };

/** One JSON line on stderr. */
const line = (obj: unknown): void => {
  process.stderr.write(JSON.stringify(obj) + "\n");
};

const fail = (code: number, message: string): number => {
  line({ error: message, exit: code });
  return code;
};

const usage = (message: string): number =>
  fail(
    EXIT_USAGE,
    `${message} — usage: animspec render <spec.json> --signal <track.asft> [--seed n] [--start n] [--end n] [--width n] [--height n] (--raw | --png <dir>)`,
  );

const intArg = (name: string, raw: string | undefined, fallback: number): number => {
  const v = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(v)) throw new Error(`${name} must be an integer`);
  return v;
};

export async function main(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        signal: { type: "string" },
        seed: { type: "string", default: "0" },
        start: { type: "string", default: "0" },
        end: { type: "string" },
        width: { type: "string", default: "1920" },
        height: { type: "string", default: "1080" },
        raw: { type: "boolean" },
        png: { type: "string" },
      },
      allowPositionals: true,
    });
  } catch (e) {
    return usage((e as Error).message);
  }

  const specFile = args.positionals[0];
  if (!specFile || args.positionals.length !== 1) return usage("expected exactly one spec file");
  if (!args.values.signal) return usage("--signal <track.asft> is required");
  const modes = [args.values.raw ? "raw" : "", args.values.png !== undefined ? "png" : ""].filter(Boolean);
  if (modes.length !== 1) return usage("exactly one of --raw or --png <dir> is required");
  const pngDir = args.values.png;

  let seed: number, start: number, width: number, height: number;
  try {
    seed = intArg("--seed", args.values.seed, 0);
    start = intArg("--start", args.values.start, 0);
    width = intArg("--width", args.values.width, 1920);
    height = intArg("--height", args.values.height, 1080);
    if (start < 0 || seed < 0) throw new Error("--seed and --start must be ≥ 0");
    if (width < 1 || height < 1) throw new Error("--width and --height must be ≥ 1");
  } catch (e) {
    return usage((e as Error).message);
  }

  // The spec is untrusted input: validate first, report what was dropped, and
  // render what remains (Principle IV).
  let specText: string;
  try {
    specText = fs.readFileSync(specFile, "utf8");
  } catch (e) {
    return fail(EXIT_USAGE, `cannot read spec file: ${(e as Error).message}`);
  }
  let rawSpec: unknown;
  try {
    rawSpec = JSON.parse(specText);
  } catch {
    return fail(EXIT_USAGE, "spec file is not valid JSON");
  }
  const validated = validateAnimSpec(rawSpec);
  if (validated.dropped.length > 0) line({ dropped: validated.dropped });
  const spec = validated.spec;
  if (!spec) return fail(EXIT_USAGE, "spec validated to nothing");

  // The signal track: header once, sidecar once, frames per-frame — a chunk
  // render never decodes the whole file (spec 011's reader at work).
  let bytes: Uint8Array;
  let header: ReturnType<typeof readSignalTrackHeader>;
  let sidecar: ReturnType<typeof indexSignalTrackSidecar>;
  try {
    bytes = fs.readFileSync(args.values.signal);
    header = readSignalTrackHeader(bytes);
    const sidecarPath = `${args.values.signal}.ndjson`;
    const sidecarText = fs.existsSync(sidecarPath) ? fs.readFileSync(sidecarPath, "utf8") : null;
    sidecar = indexSignalTrackSidecar(sidecarText, header.frameCount);
  } catch (e) {
    return fail(EXIT_TRACK, `signal track: ${(e as Error).message}`);
  }

  const end = args.values.end === undefined ? header.frameCount : intArg("--end", args.values.end, header.frameCount);
  if (!(Number.isSafeInteger(start) && Number.isSafeInteger(end)) || start > end || end > header.frameCount) {
    return fail(EXIT_RANGE, `range [${start}, ${end}) outside the track (${header.frameCount} frames)`);
  }

  const dims = { width, height };
  // One canvas for the whole range: drawSpec repaints from the background
  // every frame, so reuse is byte-identical to fresh canvases and keeps the
  // native surface from piling up in the GC's way on long ranges (issue #67).
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const yieldToLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

  for (let n = start; n < end; n++) {
    const frame = readSignalFrame(bytes, header, n, sidecar);
    drawSpec(ctx, dims, frame, spec, { reducedFlicker: true, creative: false, seed });
    if (pngDir !== undefined) {
      const png = await canvas.encode("png");
      fs.mkdirSync(pngDir, { recursive: true });
      fs.writeFileSync(path.join(pngDir, `${String(n).padStart(6, "0")}.png`), png);
    } else {
      const rgba = ctx.getImageData(0, 0, width, height).data;
      // Backpressure: when the consumer (an encoder pipe) is slower than the
      // renderer, wait for stdout to drain instead of buffering frames
      // without bound (issue #67).
      const ok = process.stdout.write(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength));
      if (!ok) await once(process.stdout, "drain");
    }
    line({ frame: n });
    // Give the loop a turn so freshly released native buffers are freed even
    // when the consumer never pushes back (e.g. /dev/null).
    await yieldToLoop();
  }

  line({
    manifest: {
      version: pkg.version,
      vocabulary: VOCABULARY_VERSION,
      canvas: pkg.dependencies["@napi-rs/canvas"],
      arch: process.arch,
      width,
      height,
      start,
      end,
      seed,
      frames: end - start,
      // Spec 021: the intended pixel shape, for the encoder; never changes a pixel.
      ...(spec.pixelAspect !== undefined ? { pixelAspect: spec.pixelAspect } : {}),
    },
  });
  return EXIT_OK;
}
