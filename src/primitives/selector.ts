import { PRIMITIVES, getPrimitive, type PrimitiveDef } from "./registry";
import { mulberry32, mixSeed } from "../rng";

/**
 * Deterministic vocabulary selector (ADR 0018). Picks the ~15-20 primitive
 * subset the LLM is shown, from named KITS + a breadth dial + a seed. Pure:
 * same (kit, breadth, seed) ⇒ same subset. The registry can hold 100+; the LLM
 * only ever sees the selection — how the vocabulary scales without overwhelming
 * a fast model.
 */

export const KIT_NAMES = ["auto", "data-viz", "particle-lab", "minimal", "glitch", "text", "arcade", "dimensional", "retro"] as const;
export type KitName = (typeof KIT_NAMES)[number];

const KITS: Record<Exclude<KitName, "auto">, string[]> = {
  "data-viz": ["grid", "bars", "hbars", "radial", "wave", "crosshair", "scan", "caption"],
  "particle-lab": ["particles", "orbits", "dots", "shape", "rings", "spiral", "wave", "flash", "mesh3d"],
  minimal: ["wave", "scan", "shape", "text", "led", "caption", "rings"],
  glitch: ["barcode", "noise", "checker", "scan", "flash", "sweep", "grid"],
  text: ["text", "rain", "caption", "led", "grid", "wave", "scan"],
  // Pixel/retro scene: composable animated characters, tetromino field, over a grid (ADR 0021).
  arcade: ["sprite", "tetris", "grid", "led", "scan", "flash", "caption"],
  // 3D-leaning: the projected mesh plus curves and points.
  dimensional: ["mesh3d", "orbits", "spiral", "radial", "rings", "wave", "dots", "caption"],
  // Retro / demoscene / synthwave: fields, grids and tunnels (colorize with neon).
  retro: ["plasma", "gridhorizon", "tunnel", "checker", "scan", "noise", "led"],
};

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Auto: at least one primitive per category, then fill to `target` deterministically. */
function autoSample(target: number, rng: () => number): string[] {
  const cats: Record<string, PrimitiveDef[]> = {};
  for (const p of PRIMITIVES) (cats[p.category] ??= []).push(p);
  const picked: string[] = [];
  for (const cat of Object.keys(cats)) picked.push(shuffle(cats[cat], rng)[0].type);
  const rest = shuffle(PRIMITIVES.map((p) => p.type).filter((t) => !picked.includes(t)), rng);
  for (const t of rest) {
    if (picked.length >= target) break;
    picked.push(t);
  }
  return picked;
}

export function select(kit: string | undefined, breadth = 0.3, seed = 0): PrimitiveDef[] {
  const b = Math.min(1, Math.max(0, breadth));
  const rng = mulberry32(mixSeed(seed, Math.round(b * 1000)));

  let types: string[];
  if (kit && kit !== "auto" && KITS[kit as keyof typeof KITS]) {
    types = [...KITS[kit as keyof typeof KITS]];
    const extras = shuffle(PRIMITIVES.map((p) => p.type).filter((t) => !types.includes(t)), rng);
    for (let i = 0; i < Math.round(b * 6) && i < extras.length; i++) types.push(extras[i]);
  } else {
    types = autoSample(Math.round(12 + b * 8), rng); // 12..20
  }

  if (!types.includes("caption")) types.push("caption"); // captions must stay available

  const seen = new Set<string>();
  return types
    .map(getPrimitive)
    .filter((p): p is PrimitiveDef => !!p && !seen.has(p.type) && !!seen.add(p.type));
}
