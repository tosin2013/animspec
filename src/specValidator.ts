import type { AnimSpec } from "./specInterpreter.js";
import { sanitizeLayer, buildJsonSchema, VOCABULARY_VERSION, PRIMITIVES } from "./primitives/registry.js";
import { isFontKey } from "./fonts/index.js";

/**
 * AnimSpec validator (ADR 0015/0018). Delegates per-layer sanitize to the
 * primitive registry (single source of truth), so it stays in sync with the
 * vocabulary automatically. Reports `dropped` layer types — the feedback loop
 * for deciding which primitives real prompts want next.
 */

export interface ValidationResult {
  valid: boolean;
  spec?: AnimSpec;
  errors: string[];
  /** Layer types the model asked for that are not in the registry (dropped). */
  dropped: string[];
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

export function validateAnimSpec(input: unknown): ValidationResult {
  const errors: string[] = [];
  const dropped: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["spec must be a JSON object"], dropped };
  }
  const obj = input as Record<string, unknown>;

  const background = obj.background === "white" ? "white" : "black";
  const accent = isHex(obj.accent) ? (obj.accent as string) : undefined;
  if (obj.accent !== undefined && accent === undefined) errors.push("accent dropped (not a valid hex color)");

  // Font choice: a known key is kept. Anything else is removed, the default
  // applies, and the error is reported the same way as other rejected input.
  // A spec with no `font` produces a spec with no `font` field.
  const font = isFontKey(obj.font) ? obj.font : undefined;
  if (obj.font !== undefined && font === undefined) errors.push("font dropped (not a shipped font)");

  // Vocabulary version: recorded on every spec the validator returns (data-model.md).
  // A known version is kept; a newer or invalid one is replaced with the current
  // version and reported the same way as other rejected input.
  const rawV = obj.vocabulary;
  let vocabulary = VOCABULARY_VERSION;
  if (rawV !== undefined) {
    if (Number.isInteger(rawV) && (rawV as number) >= 1 && (rawV as number) <= VOCABULARY_VERSION) {
      vocabulary = rawV as number;
    } else if (Number.isInteger(rawV) && (rawV as number) > VOCABULARY_VERSION) {
      errors.push(`vocabulary ${rawV} is newer than this library (${VOCABULARY_VERSION}); recorded as ${VOCABULARY_VERSION}`);
    } else {
      errors.push("vocabulary dropped (not a valid version)");
    }
  }

  if (!Array.isArray(obj.layers)) {
    return { valid: false, errors: [...errors, "spec.layers must be an array"], dropped };
  }

  const layers: Record<string, unknown>[] = [];
  for (const raw of (obj.layers as unknown[]).slice(0, 12)) {
    const clean = sanitizeLayer(raw);
    if (clean) layers.push(clean);
    else if (raw && typeof raw === "object" && typeof (raw as any).type === "string") dropped.push((raw as any).type);
  }

  if (layers.length === 0) {
    return { valid: false, errors: [...errors, "no valid layers (only known primitive types are allowed)"], dropped };
  }

  const spec = { vocabulary, background, ...(accent ? { accent } : {}), ...(font ? { font } : {}), layers } as unknown as AnimSpec;
  return { valid: true, spec, errors, dropped };
}

/** Full-vocabulary JSON schema (a subset schema is built per-request by the selector). */
export const ANIMSPEC_JSON_SCHEMA = buildJsonSchema(PRIMITIVES);
