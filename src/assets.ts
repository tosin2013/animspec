import { createHash } from "node:crypto";
import { ROLE_NAME } from "./primitives/registry.js";

/**
 * Image assets (spec 022). A spec declares each asset by id with its sha256
 * and size; the host supplies the decoded bitmap, and `draw` never reads
 * files. The digest pins which bytes were meant, on any machine.
 */

/** Anything the canvas `drawImage` accepts, e.g. an @napi-rs/canvas Image or Canvas. */
export interface AssetImage {
  width: number;
  height: number;
}

/** A declared asset: the sha256 of its file bytes and its size in pixels. */
export interface AssetRecord {
  sha256: string;
  width: number;
  height: number;
}

export const SHA256 = /^[0-9a-f]{64}$/;
export const MAX_ASSETS = 32;
export const MAX_ASSET_SIDE = 8192;

const isSide = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_ASSET_SIDE;

/**
 * Read a spec's `assets` map. Keys are read in sorted order and the first 32
 * valid entries are kept; every dropped entry is reported.
 */
export function sanitizeAssets(raw: unknown): { assets: Record<string, AssetRecord>; problems: string[] } {
  const assets: Record<string, AssetRecord> = {};
  const problems: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { assets, problems: ["assets dropped (not an object)"] };
  const obj = raw as Record<string, unknown>;
  let kept = 0;
  for (const id of Object.keys(obj).sort()) {
    const e = obj[id] as Record<string, unknown> | null;
    if (!ROLE_NAME.test(id)) problems.push(`assets: ${id} dropped (invalid id)`);
    else if (!e || typeof e !== "object" || Array.isArray(e)) problems.push(`assets: ${id} dropped (not an object)`);
    else if (typeof e.sha256 !== "string" || !SHA256.test(e.sha256)) problems.push(`assets: ${id} dropped (sha256 must be 64 lowercase hex characters)`);
    else if (!isSide(e.width) || !isSide(e.height)) problems.push(`assets: ${id} dropped (width and height must be integers from 1 to ${MAX_ASSET_SIDE})`);
    else if (kept >= MAX_ASSETS) problems.push(`assets: ${id} dropped (more than ${MAX_ASSETS} assets)`);
    else { assets[id] = { sha256: e.sha256, width: e.width, height: e.height }; kept++; }
  }
  return { assets, problems };
}

/** The sha256 of some bytes, as lowercase hex. */
export const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/**
 * Check supplied asset bytes against a spec's declared digests: every
 * declared asset must be supplied and match. Returns the problems found.
 */
export function checkAssets(spec: { assets?: Record<string, AssetRecord> }, bytes: Record<string, Uint8Array>): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  for (const [id, rec] of Object.entries(spec.assets ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const b = bytes[id];
    if (!b) problems.push(`missing ${id}`);
    else if (sha256Hex(b) !== rec.sha256) problems.push(`${id} sha256 mismatch`);
  }
  return { ok: problems.length === 0, problems };
}
