/**
 * Tier and replacement fixtures for the vocabulary gate (specs/003-vocab-version-tiers).
 * Fixtures live outside `src/` so the library can never import them. Each draws
 * a filled rectangle in `palette.fg`; tier, `replacedBy` and kit membership are
 * the only things being exercised, so the draw is intentionally trivial.
 */
import type { CanvasRenderingContext2D } from "@napi-rs/canvas";
import type { PrimitiveDef, Palette, Dimensions } from "../../src/primitives/registry";
import { PRIMITIVES } from "../../src/primitives/registry";
import { KITS } from "../../src/primitives/selector";
import type { SignalFrame } from "../../src/types";

type Layer = Record<string, unknown>;

const rectDraw = (ctx: CanvasRenderingContext2D, d: Dimensions, _f: SignalFrame, _l: Layer, p: Palette) => {
  ctx.fillStyle = p.fg;
  ctx.fillRect(0, 0, d.width, d.height);
};

export const fixtureContrib: PrimitiveDef = {
  type: "fixture-contrib",
  category: "structure",
  description: "tier fixture: a contrib primitive",
  tier: "contrib",
  params: {},
  draw: rectDraw,
};

export const fixtureOld: PrimitiveDef = {
  type: "fixture-old",
  category: "structure",
  description: "tier fixture: a legacy primitive replaced by fixture-new",
  tier: "legacy",
  replacedBy: "fixture-new",
  params: {},
  draw: rectDraw,
};

export const fixtureNew: PrimitiveDef = {
  type: "fixture-new",
  category: "structure",
  description: "tier fixture: the replacement for fixture-old",
  tier: "core",
  params: {},
  draw: rectDraw,
};

export const fixtureExtended: PrimitiveDef = {
  type: "fixture-extended",
  category: "structure",
  description: "tier fixture: an extended primitive in fixture-kit",
  tier: "extended",
  params: {},
  draw: rectDraw,
};

/** The real registry + kits, plus four fixture primitives exercising every tier. */
export const SELECTION_VOCAB = {
  primitives: [...PRIMITIVES, fixtureContrib, fixtureOld, fixtureNew, fixtureExtended],
  kits: { ...KITS, "fixture-kit": ["grid", "fixture-extended", "caption"] },
};

/** Five real core primitives plus the contrib and extended fixtures. */
export const SMALL_VOCAB = {
  primitives: [
    ...PRIMITIVES.filter((p) => ["grid", "wave", "bars", "text", "caption"].includes(p.type)),
    fixtureContrib,
    fixtureExtended,
  ],
  kits: { "fixture-kit": ["grid", "fixture-extended", "caption"] },
};

// ---- replacement fixtures (one per rule in replacementProblems) -----------

export const REPLACEMENT_BAD: { name: string; primitives: PrimitiveDef[]; subject: string }[] = [
  {
    name: "legacy with no replacement",
    primitives: [{ type: "legacy-norepl", category: "structure", description: "", tier: "legacy", params: {}, draw: rectDraw }],
    subject: "legacy-norepl",
  },
  {
    name: "legacy with a missing replacement",
    primitives: [{ type: "legacy-missing", category: "structure", description: "", tier: "legacy", replacedBy: "missing", params: {}, draw: rectDraw }],
    subject: "legacy-missing",
  },
  {
    name: "core naming a replacement",
    primitives: [{ type: "core-withrepl", category: "structure", description: "", tier: "core", replacedBy: "other", params: {}, draw: rectDraw }],
    subject: "core-withrepl",
  },
  {
    name: "two legacy primitives naming each other",
    primitives: [
      { type: "legacy-a", category: "structure", description: "", tier: "legacy", replacedBy: "legacy-b", params: {}, draw: rectDraw },
      { type: "legacy-b", category: "structure", description: "", tier: "legacy", replacedBy: "legacy-a", params: {}, draw: rectDraw },
    ],
    subject: "legacy-a",
  },
];

/** fixture-old's definition as core, sharing its draw function — to prove a
 * replaced primitive renders identically (FR-021). */
export const OLD_AS_CORE: PrimitiveDef = {
  type: "fixture-old",
  category: "structure",
  description: "tier fixture: fixture-old rendered as core",
  tier: "core",
  params: {},
  draw: fixtureOld.draw,
};

// ---- tier fixtures (one per rule in tierProblems) -------------------------

const coreOf = (types: string[]): PrimitiveDef[] =>
  PRIMITIVES.filter((p) => types.includes(p.type));

export const TIER_BAD: { name: string; primitives: PrimitiveDef[]; kits: Record<string, string[]>; subject: string }[] = [
  {
    name: "invalid tier",
    primitives: [{ type: "tier-gold", category: "structure", description: "", tier: "gold" as PrimitiveDef["tier"], params: {}, draw: rectDraw }],
    kits: {},
    subject: "tier-gold",
  },
  {
    name: "kit lists a missing type",
    primitives: coreOf(["grid", "caption"]),
    kits: { "bad-kit": ["grid", "missing"] },
    subject: "bad-kit",
  },
  {
    name: "kit lists a contrib primitive",
    primitives: [...coreOf(["grid", "caption"]), fixtureContrib],
    kits: { "bad-kit": ["grid", "fixture-contrib"] },
    subject: "bad-kit",
  },
  {
    name: "kit lists a legacy primitive",
    primitives: [...coreOf(["grid", "caption"]), fixtureOld, fixtureNew],
    kits: { "bad-kit": ["grid", "fixture-old"] },
    subject: "bad-kit",
  },
  {
    name: "extended primitive in no kit",
    primitives: [...coreOf(["grid", "caption"]), fixtureExtended],
    kits: {},
    subject: "fixture-extended",
  },
  {
    name: "caption re-tiered as extended",
    primitives: [...coreOf(["grid"]), { ...PRIMITIVES.find((p) => p.type === "caption")!, tier: "extended" as const }],
    kits: { "caption-kit": ["grid", "caption"] },
    subject: "caption",
  },
];
