/**
 * Pure vocabulary rules for the tier and version checks (specs/003-vocab-version-tiers).
 * Every function takes its inputs and returns `Problem[]`; none reads the
 * filesystem, the clock, or the network. `verify-registry.ts` runs them on the
 * real registry and again on fixtures, and fails if any rule does not catch a
 * fixture that breaks it.
 */
import crypto from "node:crypto";
import { TIERS, type PrimitiveDef } from "../../src/primitives/registry";

export interface Problem {
  /** The primitive type, kit name, or file path at fault. */
  subject: string;
  message: string;
}

export function formatProblem(p: Problem): string {
  return `${p.subject}: ${p.message}`;
}

// ---- replacement (US3) ----------------------------------------------------

/**
 * Legacy replacement rules (data-model.md): a legacy primitive names an existing
 * replacement; a non-legacy primitive names none; and following `replacedBy`
 * repeatedly ends at a primitive that is not legacy without revisiting one.
 */
export function replacementProblems(primitives: PrimitiveDef[]): Problem[] {
  const problems: Problem[] = [];
  const byType = new Map(primitives.map((p) => [p.type, p]));

  for (const p of primitives) {
    if (p.tier === "legacy") {
      if (!p.replacedBy) {
        problems.push({ subject: p.type, message: "legacy but names no replacement" });
      } else if (!byType.has(p.replacedBy)) {
        problems.push({ subject: p.type, message: `replaced by "${p.replacedBy}", which does not exist` });
      }
    } else if (p.replacedBy) {
      problems.push({ subject: p.type, message: "names a replacement but is not legacy" });
    }
  }

  for (const p of primitives) {
    if (p.tier !== "legacy" || !p.replacedBy || !byType.has(p.replacedBy)) continue;
    let cur: PrimitiveDef | undefined = p;
    const visited = new Set<string>();
    let endsAtNonLegacy = false;
    while (cur && !visited.has(cur.type)) {
      visited.add(cur.type);
      if (cur.tier !== "legacy") { endsAtNonLegacy = true; break; }
      if (!cur.replacedBy || !byType.has(cur.replacedBy)) break;
      cur = byType.get(cur.replacedBy);
    }
    if (!endsAtNonLegacy) {
      problems.push({ subject: p.type, message: "replacement chain does not end at a primitive that is not legacy" });
    }
  }

  return problems;
}

// ---- tiers (US4) ----------------------------------------------------------

/**
 * Tier rules (contracts/tiers-and-selection.md): exactly one valid tier per
 * primitive; a kit lists only existing, core or extended primitives; every
 * extended primitive is listed by a kit; caption is core.
 */
export function tierProblems(primitives: PrimitiveDef[], kits: Record<string, string[]>): Problem[] {
  const problems: Problem[] = [];
  const byType = new Map(primitives.map((p) => [p.type, p]));
  const validTiers = TIERS as readonly string[];

  for (const p of primitives) {
    if (!validTiers.includes(p.tier)) {
      problems.push({ subject: p.type, message: `not a valid tier: "${p.tier}"` });
    }
  }

  const listedBy = new Set<string>();
  for (const [kitName, list] of Object.entries(kits)) {
    for (const t of list) {
      const def = byType.get(t);
      if (!def) {
        problems.push({ subject: kitName, message: `lists "${t}", which does not exist` });
      } else {
        listedBy.add(t);
        if (def.tier === "contrib" || def.tier === "legacy") {
          problems.push({ subject: kitName, message: `lists "${t}", which is ${def.tier}` });
        }
      }
    }
  }

  for (const p of primitives) {
    if (p.tier === "extended" && !listedBy.has(p.type)) {
      problems.push({ subject: p.type, message: "extended but in no kit" });
    }
  }

  const caption = byType.get("caption");
  if (!caption || caption.tier !== "core") {
    problems.push({ subject: "caption", message: "must be core" });
  }

  return problems;
}

// ---- vocabulary record (US4) ----------------------------------------------

export type ParamSnapshot = {
  type: string;
  min?: number;
  max?: number;
  maxLen?: number;
  values?: readonly string[];
  default: number | boolean | string;
};

export type PrimitiveSnapshot = {
  type: string;
  tier: string;
  replacedBy?: string;
  params: Record<string, ParamSnapshot>;
};

export type VocabularyRecord = {
  versions: { version: number; hash: string; summary: string }[];
  current: { version: number; primitives: PrimitiveSnapshot[] };
};

/**
 * Everything a spec can observe about a primitive, in registry order: its type,
 * tier, replacement, and each param's declaration (type, bounds, default,
 * allowed values). Descriptions, categories and draw functions are left out.
 */
export function snapshot(primitives: PrimitiveDef[]): PrimitiveSnapshot[] {
  return primitives.map((p) => {
    const params: Record<string, ParamSnapshot> = {};
    for (const [k, s] of Object.entries(p.params)) {
      if (s.type === "number") params[k] = { type: "number", min: s.min, max: s.max, default: s.default };
      else if (s.type === "boolean") params[k] = { type: "boolean", default: s.default };
      else if (s.type === "enum") params[k] = { type: "enum", values: s.values, default: s.default };
      else params[k] = { type: "string", maxLen: s.maxLen, default: s.default };
    }
    return {
      type: p.type,
      tier: p.tier,
      ...(p.replacedBy !== undefined ? { replacedBy: p.replacedBy } : {}),
      params,
    };
  });
}

export function snapshotHash(snap: PrimitiveSnapshot[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(snap)).digest("hex");
}

const RECORD_SUBJECT = "golden/vocabulary.json";

/** Check the committed record against the current version and registry. */
export function recordProblems(record: VocabularyRecord | null, version: number, primitives: PrimitiveDef[]): Problem[] {
  const problems: Problem[] = [];
  if (!record) {
    problems.push({ subject: RECORD_SUBJECT, message: `no record for version ${version}; run npm run vocab:record` });
    return problems;
  }

  const { versions, current } = record;

  if (versions.some((v, i) => v.version !== i + 1)) {
    problems.push({ subject: RECORD_SUBJECT, message: `versions are not numbered 1 to ${versions.length} without gaps` });
  }

  const last = versions[versions.length - 1];
  if (!last || last.version < version) {
    problems.push({ subject: RECORD_SUBJECT, message: `no record for version ${version}; run npm run vocab:record` });
    return problems;
  }
  if (last.version > version) {
    problems.push({ subject: RECORD_SUBJECT, message: `record is at version ${last.version} but VOCABULARY_VERSION is ${version}` });
    return problems;
  }

  if (snapshotHash(current.primitives) !== last.hash) {
    problems.push({ subject: RECORD_SUBJECT, message: `current snapshot does not match the hash for version ${version}` });
  }

  for (let i = 1; i < versions.length; i++) {
    if (versions[i].hash === versions[i - 1].hash) {
      problems.push({ subject: RECORD_SUBJECT, message: `version ${versions[i].version} records no change from version ${versions[i - 1].version}` });
    }
  }

  const derived = snapshot(primitives);
  if (snapshotHash(derived) !== last.hash) {
    problems.push({ subject: RECORD_SUBJECT, message: `vocabulary differs from version ${version}; raise VOCABULARY_VERSION and run npm run vocab:record` });
    const curByType = new Map(current.primitives.map((p) => [p.type, p]));
    const newByType = new Map(derived.map((p) => [p.type, p]));
    for (const p of current.primitives) {
      if (!newByType.has(p.type)) problems.push({ subject: p.type, message: "removed" });
    }
    for (const p of derived) {
      if (!curByType.has(p.type)) {
        problems.push({ subject: p.type, message: "added" });
      } else if (JSON.stringify(curByType.get(p.type)) !== JSON.stringify(p)) {
        problems.push({ subject: p.type, message: "differs" });
      }
    }
  }

  return problems;
}

/** The full text of VOCABULARY.md, generated from the record and the registry. */
export function renderVocabularyDoc(record: VocabularyRecord, primitives: PrimitiveDef[]): string {
  const counts: Record<string, number> = { core: 0, extended: 0, contrib: 0, legacy: 0 };
  for (const p of primitives) counts[p.tier] = (counts[p.tier] ?? 0) + 1;

  const lines: string[] = [];
  lines.push("# Vocabulary");
  lines.push("");
  lines.push("Generated by `npm run vocab:record`. Do not edit.");
  lines.push("");
  lines.push(`Current version: **${record.current.version}**`);
  lines.push("");
  lines.push("## History");
  lines.push("");
  lines.push("| Version | Summary |");
  lines.push("| --- | --- |");
  for (const v of record.versions) lines.push(`| ${v.version} | ${v.summary} |`);
  lines.push("");
  lines.push(`**${primitives.length} primitives**: ${counts.core} core, ${counts.extended} extended, ${counts.contrib} contrib, ${counts.legacy} legacy`);
  lines.push("");
  lines.push("## Primitives");
  lines.push("");
  lines.push("| Type | Category | Tier | Replaced by | Description |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const p of primitives) {
    lines.push(`| \`${p.type}\` | ${p.category} | ${p.tier} | ${p.replacedBy ?? ""} | ${p.description} |`);
  }
  return `${lines.join("\n")}\n`;
}
