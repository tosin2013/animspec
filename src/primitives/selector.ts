import { PRIMITIVES, type PrimitiveDef } from "./registry.js";
import { mulberry32, mixSeed } from "../rng.js";

/**
 * Deterministic vocabulary selector (ADR 0018). Picks the bounded subset the LLM
 * is shown, from named KITS + a breadth dial + a seed, restricted by each
 * primitive's tier (specs/003-vocab-version-tiers):
 *
 *   - no kit / `auto` / unknown kit → core only
 *   - a kit → the kit's list (core + its extended), then up to 6 extra core
 *   - `contrib` → only when the caller names it
 *   - `legacy`  → never; naming one is refused with its replacement
 *
 * Pure: same (kit, breadth, seed, named) ⇒ same selection, in the same order.
 * The registry can hold 100+; the LLM only ever sees the selection — how the
 * vocabulary scales without overwhelming a fast model.
 */

export const KIT_NAMES = ["auto", "data-viz", "particle-lab", "minimal", "glitch", "text", "arcade", "dimensional", "retro"] as const;
export type KitName = (typeof KIT_NAMES)[number];

export const KITS: Record<string, string[]> = {
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

/** The vocabulary a selection is drawn from. Injecting it lets checks run fixtures. */
export interface SelectVocab {
  primitives: PrimitiveDef[];
  kits: Record<string, string[]>;
}

export interface SelectResult {
  primitives: PrimitiveDef[];
  /** Named types that were refused, each with its reason. */
  refused: { type: string; reason: string }[];
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Core-only: one per category that has a core primitive, then fill to `target`. */
function coreSample(primitives: PrimitiveDef[], target: number, rng: () => number): string[] {
  const core = primitives.filter((p) => p.tier === "core");
  const cats: Record<string, PrimitiveDef[]> = {};
  for (const p of core) (cats[p.category] ??= []).push(p);
  const picked: string[] = [];
  for (const cat of Object.keys(cats)) picked.push(shuffle(cats[cat], rng)[0].type);
  const rest = shuffle(core.map((p) => p.type).filter((t) => !picked.includes(t)), rng);
  for (const t of rest) {
    if (picked.length >= target) break;
    picked.push(t);
  }
  return picked;
}

/**
 * The tier-aware selection core. `kit` may be a kit name, `auto`, or undefined;
 * `named` lists primitive types the caller asks for in addition. Returns the
 * ordered selection plus any refused names with reasons.
 */
export function selectFrom(
  vocab: SelectVocab,
  kit: string | undefined,
  breadth = 0.3,
  seed = 0,
  named: string[] = [],
): SelectResult {
  const b = Math.min(1, Math.max(0, breadth));
  const rng = mulberry32(mixSeed(seed, Math.round(b * 1000)));
  const byType = new Map(vocab.primitives.map((p) => [p.type, p]));
  const kitList = kit && kit !== "auto" ? vocab.kits[kit] : undefined;

  let types: string[];
  if (kitList) {
    // The kit's own list (core + its extended; contrib/legacy members are
    // skipped so the guarantees hold even if a kit is wrong), then up to 6
    // extra core primitives by breadth.
    types = kitList.filter((t) => {
      const def = byType.get(t);
      return !!def && (def.tier === "core" || def.tier === "extended");
    });
    const extras = shuffle(vocab.primitives.filter((p) => p.tier === "core" && !types.includes(p.type)).map((p) => p.type), rng);
    for (let i = 0; i < Math.round(b * 6) && i < extras.length; i++) types.push(extras[i]);
  } else {
    // No kit, `auto`, or an unknown kit name: core only, one per category that
    // has a core primitive, then more core up to the target (12..20 by breadth).
    types = coreSample(vocab.primitives, Math.round(12 + b * 8), rng);
  }

  // Named primitives, in the order given.
  const refused: { type: string; reason: string }[] = [];
  for (const name of named) {
    const def = byType.get(name);
    if (!def) {
      refused.push({ type: name, reason: "not a primitive" });
      continue;
    }
    if (def.tier === "legacy") {
      refused.push({ type: name, reason: `legacy; replaced by ${def.replacedBy}` });
      continue;
    }
    if (def.tier === "extended" && !(kitList && kitList.includes(name))) {
      refused.push({ type: name, reason: "extended; offered only through its kit" });
      continue;
    }
    // core and contrib are offered; an extended primitive already in its kit is too.
    if (!types.includes(name)) types.push(name);
  }

  // Captions must stay available.
  if (byType.has("caption") && !types.includes("caption")) types.push("caption");

  // Deduplicate keeping first position, and map to definitions.
  const seen = new Set<string>();
  const primitives: PrimitiveDef[] = [];
  for (const t of types) {
    if (seen.has(t)) continue;
    const def = byType.get(t);
    if (def) { seen.add(t); primitives.push(def); }
  }
  return { primitives, refused };
}

/** Selection plus refused names; naming a primitive is possible only through here. */
export function selectDetailed(kit?: string, breadth = 0.3, seed = 0, named: string[] = []): SelectResult {
  return selectFrom({ primitives: PRIMITIVES, kits: KITS }, kit, breadth, seed, named);
}

export function select(kit: string | undefined, breadth = 0.3, seed = 0): PrimitiveDef[] {
  return selectFrom({ primitives: PRIMITIVES, kits: KITS }, kit, breadth, seed, []).primitives;
}
