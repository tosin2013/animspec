import type { AnimSpec, CameraShake, CameraSpec } from "./specInterpreter.js";
import { getPrimitive, sanitizeBind, sanitizeLayer, buildJsonSchema, VOCABULARY_VERSION, PRIMITIVES } from "./primitives/registry.js";
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
const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Validate an optional camera shake (spec 016); malformed → dropped, camera kept. */
function sanitizeShake(raw: unknown, errors: string[]): CameraShake | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("camera shake dropped (must be an object)");
    return undefined;
  }
  const s = raw as Record<string, unknown>;
  const amp = finite(s.amp);
  if (amp === null) { errors.push("camera shake dropped (amp must be a number)"); return undefined; }
  const freq = s.freq === undefined ? 3 : finite(s.freq);
  if (freq === null || freq <= 0) { errors.push("camera shake dropped (freq must be a positive number)"); return undefined; }
  return { amp: Math.min(0.05, Math.max(0, amp)), freq: Math.min(5, freq) };
}

/** Validate an optional camera (spec 014); malformed → dropped with a report. */
function sanitizeCamera(raw: unknown, errors: string[]): CameraSpec | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("camera dropped (must be an object)");
    return undefined;
  }
  const c = raw as Record<string, unknown>;
  const MOVES = ["static", "pan", "zoom", "push", "parallax"];
  if (typeof c.move !== "string" || !MOVES.includes(c.move)) {
    errors.push("camera dropped (unknown move)");
    return undefined;
  }
  const move = c.move as CameraSpec["move"];
  const key = (v: unknown): CameraSpec["from"] | null => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const k = v as Record<string, unknown>;
    const frame = finite(k.frame), zoom = finite(k.zoom), x = finite(k.x), y = finite(k.y);
    if (frame === null || zoom === null || x === null || y === null || zoom <= 0) return null;
    // -1..2 since spec 016 (FR-010); was 0..1, so an unvalidated spec outside
    // 0..1 now renders at its stated position (FR-012).
    return { frame, zoom, x: Math.min(2, Math.max(-1, x)), y: Math.min(2, Math.max(-1, y)) };
  };
  const from = key(c.from);
  if (!from) { errors.push("camera dropped (malformed from keyframe)"); return undefined; }
  const to = c.to === undefined ? undefined : key(c.to);
  if (c.to !== undefined && !to) { errors.push("camera dropped (malformed to keyframe)"); return undefined; }
  if (move !== "static" && !to) { errors.push("camera dropped (a non-static move needs a to keyframe)"); return undefined; }
  if (to && to.frame <= from.frame) { errors.push("camera dropped (to.frame must be after from.frame)"); return undefined; }
  if (c.ease !== undefined && c.ease !== "linear" && c.ease !== "smooth") {
    errors.push("camera dropped (unknown ease)");
    return undefined;
  }
  const shake = sanitizeShake(c.shake, errors);
  return {
    move,
    from,
    ...(to ? { to } : {}),
    ...(c.ease !== undefined ? { ease: c.ease as "linear" | "smooth" } : {}),
    ...(shake ? { shake } : {}),
  };
}

export function validateAnimSpec(input: unknown): ValidationResult {
  const errors: string[] = [];
  const dropped: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["spec must be a JSON object"], dropped };
  }
  const obj = input as Record<string, unknown>;

  const background = obj.background === "white" || obj.background === "transparent" ? obj.background : "black";
  // ink (spec 017) applies only to a transparent background.
  let ink: "light" | "dark" | undefined;
  if (obj.ink !== undefined) {
    if (background !== "transparent") errors.push("ink dropped (only applies to a transparent background)");
    else if (obj.ink === "light" || obj.ink === "dark") ink = obj.ink;
    else { errors.push("ink must be light or dark; using light"); ink = "light"; }
  }
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

  const camera = sanitizeCamera(obj.camera, errors);

  const layers: Record<string, unknown>[] = [];
  for (const raw of (obj.layers as unknown[]).slice(0, 12)) {
    const clean = sanitizeLayer(raw);
    if (clean) {
      layers.push(clean);
      // Bind reporting (spec 013): sanitizeLayer drops a malformed bind
      // silently so the layer survives; the validator surfaces the reason.
      const rawLayer = raw as Record<string, unknown>;
      const def = typeof rawLayer.type === "string" ? getPrimitive(rawLayer.type) : undefined;
      if (def && rawLayer.bind !== undefined) {
        const { error } = sanitizeBind(def, rawLayer.bind);
        if (error) errors.push(`bind dropped (${error})`);
      }
    } else if (raw && typeof raw === "object" && typeof (raw as any).type === "string") dropped.push((raw as any).type);
  }

  if (layers.length === 0) {
    return { valid: false, errors: [...errors, "no valid layers (only known primitive types are allowed)"], dropped };
  }

  const spec = { vocabulary, background, ...(ink ? { ink } : {}), ...(accent ? { accent } : {}), ...(font ? { font } : {}), ...(camera ? { camera } : {}), layers } as unknown as AnimSpec;
  return { valid: true, spec, errors, dropped };
}

/** Full-vocabulary JSON schema (a subset schema is built per-request by the selector). */
export const ANIMSPEC_JSON_SCHEMA = buildJsonSchema(PRIMITIVES);
