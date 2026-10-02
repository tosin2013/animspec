/**
 * Reference-set helpers (specs/002-cross-machine-frames, data-model.md "Reference set").
 *
 * One set of reference frames per supported processor type lives under
 * `golden/<type>/`: `hashes.json` (case key to SHA-256 of raw RGBA, the exact
 * authority) and `frames/<case>.png` (the same frames as lossless images, for
 * the other type's tolerance check).
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export type ProcessorType = "arm64" | "x64";

/**
 * The processor type of this machine, or null when unsupported. The operating
 * system is not part of the promise; Windows is unsupported whatever its
 * processor.
 */
export function processorType(): ProcessorType | null {
  if (process.platform === "win32") return null;
  if (process.arch === "arm64" || process.arch === "x64") return process.arch;
  return null;
}

/** The other supported type (for the cross-type check). */
export function otherType(type: ProcessorType): ProcessorType {
  return type === "arm64" ? "x64" : "arm64";
}

/** Directory holding one reference set. */
export function setDir(root: string, type: string): string {
  return path.join(root, "golden", type);
}

/**
 * File name for a case key: characters outside `a-z 0-9 @ + -` become `_`
 * (data-model.md "Reference set").
 */
export function caseFileName(key: string): string {
  return `${key.toLowerCase().replace(/[^a-z0-9@+-]/g, "_")}.png`;
}

/** Encode raw RGBA pixels as PNG bytes. */
export async function encodeFrame(rgba: Uint8ClampedArray, width: number, height: number): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(width, height);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return canvas.encode("png");
}

/** Decode PNG bytes back to raw RGBA pixels. */
export async function decodeFrame(png: Buffer | Uint8Array): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  return { rgba: data, width: img.width, height: img.height };
}

export interface PixelComparison {
  /** Largest absolute difference in any colour channel of any pixel. */
  maxDelta: number;
  /** Number of pixels that differ at all. */
  pixels: number;
}

/** Compare two same-size RGBA buffers channel by channel (alpha ignored). */
export function comparePixels(a: Uint8ClampedArray, b: Uint8ClampedArray): PixelComparison {
  let maxDelta = 0;
  let pixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
    );
    if (d > 0) {
      pixels++;
      if (d > maxDelta) maxDelta = d;
    }
  }
  return { maxDelta, pixels };
}

/** Read one reference set: hashes plus decoded frames. */
export async function readSet(dir: string): Promise<{ hashes: Record<string, string>; frames: Map<string, Uint8ClampedArray> }> {
  const hashes = JSON.parse(fs.readFileSync(path.join(dir, "hashes.json"), "utf8")) as Record<string, string>;
  const frames = new Map<string, Uint8ClampedArray>();
  for (const key of Object.keys(hashes)) {
    const { rgba } = await decodeFrame(fs.readFileSync(path.join(dir, "frames", caseFileName(key))));
    frames.set(key, rgba);
  }
  return { hashes, frames };
}

/**
 * Write one reference set: `hashes.json` plus `frames/<case>.png`. A frame
 * file is rewritten only when its decoded pixels change (data-model.md
 * "Reference set"), so refreshes don't churn unchanged images.
 */
export async function writeSet(dir: string, cases: Array<{ key: string; rgba: Uint8ClampedArray; hash: string; width: number; height: number }>): Promise<void> {
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const hashes: Record<string, string> = {};
  for (const { key, rgba, hash, width, height } of cases) {
    hashes[key] = hash;
    const file = path.join(dir, "frames", caseFileName(key));
    let rewrite = true;
    if (fs.existsSync(file)) {
      const { rgba: old } = await decodeFrame(fs.readFileSync(file));
      rewrite = old.length !== rgba.length || old.some((v, i) => v !== rgba[i]);
    }
    if (rewrite) fs.writeFileSync(file, await encodeFrame(rgba, width, height));
  }
  fs.writeFileSync(path.join(dir, "hashes.json"), `${JSON.stringify(hashes, null, 2)}\n`);
}
