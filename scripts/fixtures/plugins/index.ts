/**
 * Fixture plugins (spec 024). One well-behaved plugin, and one plugin per
 * check that breaks exactly that check, so the plugin verifier is proven
 * against each rule. Fixtures live outside `src/` so the library ships no
 * plugin code.
 */
import fs from "node:fs";
import type { Plugin } from "../../../src/plugins";
import { mulberry32 } from "../../../src/rng";

type Draw = Plugin["primitives"][number]["draw"];
const base = { tier: "external" as const, category: "geometry" as const };

/**
 * A field of 2 × 2 stars at seeded positions (from the per-layer seed), the
 * brightest in the accent, growing with the signal: deterministic, palette-
 * only, cheap and reactive.
 */
const starfield: Draw = (ctx, d, f, l, p, x) => {
  const count = typeof l.count === "number" ? l.count : 120;
  const rnd = mulberry32(x.layerSeed ?? x.seed);
  const size = 2 + Math.round(4 * f.amplitude);
  for (let i = 0; i < count; i++) {
    const px = Math.floor(rnd() * d.width), py = Math.floor(rnd() * d.height);
    ctx.fillStyle = i % 10 === 0 ? p.accent : p.fg;
    ctx.fillRect(px, py, size, size);
  }
};

export const GOOD: Plugin = {
  id: "good", version: "1.0.0", licence: "Apache-2.0",
  primitives: [{ ...base, type: "starfield", description: "seeded stars that grow with the signal", params: { count: { type: "number", min: 1, max: 400, default: 120 } }, draw: starfield }],
};

export const RANDOM: Plugin = {
  id: "random", version: "1.0.0", licence: "MIT",
  primitives: [{ ...base, type: "noisy", description: "uses Math.random (fails determinism)", params: {}, draw: (ctx, d, f, _l, p) => { ctx.fillStyle = p.fg; ctx.fillRect(Math.random() * d.width, 0, 4 + 20 * f.amplitude, d.height); } }],
};

export const OFFPALETTE: Plugin = {
  id: "offpalette", version: "1.0.0", licence: "MIT",
  primitives: [{ ...base, type: "green", description: "fills pure green (fails palette)", params: {}, draw: (ctx, d, f) => { ctx.fillStyle = "#00ff00"; ctx.fillRect(0, 0, d.width * (0.2 + 0.6 * f.amplitude), d.height); } }],
};

export const FILEREAD: Plugin = {
  id: "fileread", version: "1.0.0", licence: "MIT",
  primitives: [{ ...base, type: "peek", description: "reads a file while drawing (fails purity)", params: {}, draw: (ctx, d, f, _l, p) => { fs.readFileSync(new URL(import.meta.url)); ctx.fillStyle = p.fg; ctx.fillRect(0, 0, d.width * f.amplitude, 4); } }],
};

export const HEAVY: Plugin = {
  id: "heavy", version: "1.0.0", licence: "MIT",
  primitives: [{ ...base, type: "swarm", description: "5,000 fills a frame (fails budget)", params: {}, draw: (ctx, d, f, _l, p) => { ctx.fillStyle = p.fg; for (let i = 0; i < 5000; i++) ctx.fillRect((i * 37) % d.width, (i * 53) % d.height, 1 + f.amplitude, 1); } }],
};

export const THROWER: Plugin = {
  id: "thrower", version: "1.0.0", licence: "MIT",
  primitives: [{ ...base, type: "boom", description: "throws while drawing", params: {}, draw: () => { throw new Error("boom"); } }],
};
