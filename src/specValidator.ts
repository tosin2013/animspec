import type { AnimSpec, CameraShake, CameraSpec, Clip, Transition } from "./specInterpreter.js";
import { getPrimitive, parseBreaks, parseDitherColors, parsePattern, sanitizeBind, sanitizeRoles, sanitizeLayer, buildJsonSchema, VOCABULARY_VERSION, PRIMITIVES } from "./primitives/registry.js";
import { isFontKey } from "./fonts/index.js";
import { sanitizeAssets, type AssetRecord } from "./assets.js";
import { parseExternalType, registeredPlugin, sanitizePlugins } from "./plugins.js";

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
  // Roles (spec 020): kept whatever the mode (the validator does not know it);
  // bad entries are dropped and reported, an empty result is not stored.
  let roles: Record<string, string> | undefined;
  if (obj.roles !== undefined) {
    const r = sanitizeRoles(obj.roles);
    errors.push(...r.problems);
    if (Object.keys(r.roles).length > 0) roles = r.roles;
  }
  // Assets (spec 022): declared by id with sha256 and size; bad entries dropped and reported.
  let assets: Record<string, AssetRecord> | undefined;
  if (obj.assets !== undefined) {
    const a = sanitizeAssets(obj.assets);
    errors.push(...a.problems);
    if (Object.keys(a.assets).length > 0) assets = a.assets;
  }
  // Plugins (spec 024): declared by id with an exact version.
  let plugins: Record<string, { version: string }> | undefined;
  if (obj.plugins !== undefined) {
    const pl = sanitizePlugins(obj.plugins);
    errors.push(...pl.problems);
    if (Object.keys(pl.plugins).length > 0) plugins = pl.plugins;
  }
  // Pixel aspect (spec 021): metadata only, kept when a number from 0.5 to 2.
  let pixelAspect: number | undefined;
  if (obj.pixelAspect !== undefined) {
    const v = obj.pixelAspect;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 2) pixelAspect = v;
    else errors.push("pixelAspect dropped (must be a number from 0.5 to 2)");
  }
  // Pixel mode (spec 026): kept when a boolean.
  let pixelMode: boolean | undefined;
  if (obj.pixelMode !== undefined) {
    if (typeof obj.pixelMode === "boolean") pixelMode = obj.pixelMode;
    else errors.push("pixelMode dropped (must be true or false)");
  }

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

  // Sequence (spec 025): the spec's layers live in its clips; top-level layers
  // and camera beside a sequence are ignored and reported.
  if (obj.sequence !== undefined) {
    if (obj.layers !== undefined) errors.push("layers ignored (the spec has a sequence)");
    if (obj.camera !== undefined) errors.push("camera ignored (the spec has a sequence)");
    const sequence = sanitizeSequence(obj.sequence, { plugins, assets }, errors, dropped);
    if (sequence.length === 0) {
      return { valid: false, errors: [...errors, "no valid clips in sequence"], dropped };
    }
    const spec = { vocabulary, background, ...(ink ? { ink } : {}), ...(accent ? { accent } : {}), ...(roles ? { roles } : {}), ...(pixelAspect !== undefined ? { pixelAspect } : {}), ...(pixelMode !== undefined ? { pixelMode } : {}), ...(assets ? { assets } : {}), ...(plugins ? { plugins } : {}), ...(font ? { font } : {}), layers: [], sequence } as unknown as AnimSpec;
    return { valid: true, spec, errors, dropped };
  }

  if (!Array.isArray(obj.layers)) {
    return { valid: false, errors: [...errors, "spec.layers must be an array"], dropped };
  }

  const camera = sanitizeCamera(obj.camera, errors);

  const layers = sanitizeLayerList(obj.layers as unknown[], { plugins, assets }, errors, dropped);

  if (layers.length === 0) {
    return { valid: false, errors: [...errors, "no valid layers (only known primitive types are allowed)"], dropped };
  }

  const spec = { vocabulary, background, ...(ink ? { ink } : {}), ...(accent ? { accent } : {}), ...(roles ? { roles } : {}), ...(pixelAspect !== undefined ? { pixelAspect } : {}), ...(pixelMode !== undefined ? { pixelMode } : {}), ...(assets ? { assets } : {}), ...(plugins ? { plugins } : {}), ...(font ? { font } : {}), ...(camera ? { camera } : {}), layers } as unknown as AnimSpec;
  return { valid: true, spec, errors, dropped };
}

/**
 * Sanitize one list of layers (spec 025): the top-level layers of a spec, or a
 * clip's. Plugin layers (spec 024) must be declared, registered and
 * version-matched; every layer is clamped by the registry; bind, pattern,
 * breaks and dither problems are reported; image layers (spec 022) must name a
 * declared asset. Messages carry `prefix` (empty at the top level, so its
 * messages are unchanged; `sequence[i]: ` inside a clip).
 */
function sanitizeLayerList(
  rawLayers: unknown[],
  ctx: { plugins?: Record<string, { version: string }>; assets?: Record<string, AssetRecord> },
  errors: string[],
  dropped: string[],
  prefix = "",
): Record<string, unknown>[] {
  const layers: Record<string, unknown>[] = [];
  const { plugins, assets } = ctx;
  const report = (m: string): void => { errors.push(prefix + m); };
  // The composition budget (#93) keeps the first 12 layers; the cut tail is
  // reported like any other drop (#155).
  if (rawLayers.length > MAX_LAYERS) {
    report(`layers: only the first ${MAX_LAYERS} layers are used (${rawLayers.length} given)`);
    for (const raw of rawLayers.slice(MAX_LAYERS)) {
      if (raw && typeof raw === "object" && typeof (raw as any).type === "string") dropped.push((raw as any).type);
    }
  }
  for (const raw of rawLayers.slice(0, MAX_LAYERS)) {
    // Plugin layers (spec 024): kept only when the plugin is declared, the
    // declared version is the one registered, and it provides the type.
    const rawType = raw && typeof raw === "object" && typeof (raw as any).type === "string" ? ((raw as any).type as string) : "";
    const ext = parseExternalType(rawType);
    if (ext) {
      const reg = registeredPlugin(ext.id);
      const why = !plugins || !(ext.id in plugins) ? `plugin ${ext.id} is not declared in plugins`
        : !reg ? `plugin ${ext.id} is not registered`
        : reg.version !== plugins[ext.id].version ? `plugin ${ext.id} is version ${reg.version}, spec wants ${plugins[ext.id].version}`
        : !reg.types.includes(ext.type) ? `plugin ${ext.id} has no type ${ext.type}`
        : null;
      if (why) { report(`${rawType} dropped (${why})`); dropped.push(rawType); continue; }
    }
    const clean = sanitizeLayer(raw);
    if (clean) {
      layers.push(clean);
      // Bind reporting (spec 013): sanitizeLayer drops a malformed bind
      // silently so the layer survives; the validator surfaces the reason.
      const rawLayer = raw as Record<string, unknown>;
      const def = typeof rawLayer.type === "string" ? getPrimitive(rawLayer.type) : undefined;
      if (def && rawLayer.bind !== undefined) {
        const { error } = sanitizeBind(def, rawLayer.bind);
        if (error) report(`bind dropped (${error})`);
      }
      // Pattern and breaks reporting (spec 018): the strings are kept as written
      // and read the same way by draw; the validator only surfaces the problems.
      // Dither colors reporting (spec 021): read the same way draw reads them.
      // type-reveal's rows align inside a maxWidth box centred on x (#156);
      // a box past the frame edge puts left- or right-aligned text off-screen.
      if (clean.type === "type-reveal" && clean.align !== "center") {
        const cx = clean.x as number, half = (clean.maxWidth as number) / 2;
        if (cx - half < 0 || cx + half > 1) {
          report(`type-reveal: wrap box [${+(cx - half).toFixed(3)}, ${+(cx + half).toFixed(3)}] leaves the frame, so ${clean.align}-aligned rows can be cut off (rows align inside a maxWidth box centred on x)`);
        }
      }
      if (clean.type === "dither") {
        for (const msg of parseDitherColors(typeof clean.colors === "string" ? clean.colors : "").problems) report(`dither ${msg}`);
      }
      if (clean.type === "grid" || clean.type === "checker") {
        const pat = parsePattern(typeof clean.pattern === "string" ? clean.pattern : "");
        for (const msg of pat.problems) report(`${clean.type} ${msg}`);
        if (typeof clean.breaks === "string" && clean.breaks.trim() !== "") {
          // Grid size is known for grid (the pattern's, else cols/rows); a
          // checker's depends on the frame size, so cells outside it are not reported.
          const cols = clean.type === "grid" ? (pat.rows > 0 ? pat.cols : (clean.cols as number)) : null;
          const rows = clean.type === "grid" ? (pat.rows > 0 ? pat.rows : (clean.rows as number)) : null;
          for (const msg of parseBreaks(clean.breaks, cols, rows).problems) report(`${clean.type} ${msg}`);
        }
      }
    } else if (raw && typeof raw === "object" && typeof (raw as any).type === "string") dropped.push((raw as any).type);
  }

  // Image layers (spec 022) must name a declared asset; otherwise dropped and reported.
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (l.type !== "image") continue;
    const id = typeof l.asset === "string" ? l.asset : "";
    if (!assets || !(id in assets)) {
      report(`image dropped (asset "${id}" is not declared in assets)`);
      dropped.push("image");
      layers.splice(i, 1);
    }
  }
  return layers;
}

const MAX_CLIPS = 64;
const MAX_LAYERS = 12;
const TRANSITIONS = ["cut", "wipe", "iris", "fade"] as const;
const WIPE_DIRECTIONS = ["left", "right", "up", "down"] as const;

/**
 * Sanitize a spec's `sequence` (spec 025): ordered, non-overlapping clips, each
 * with an absolute frame range, its own layers (the same rules as top-level
 * layers) and camera, and an optional transition in. Bad clips are dropped and
 * reported; the rest are kept.
 */
function sanitizeSequence(
  raw: unknown,
  ctx: { plugins?: Record<string, { version: string }>; assets?: Record<string, AssetRecord> },
  errors: string[],
  dropped: string[],
): Clip[] {
  if (!Array.isArray(raw)) { errors.push("sequence dropped (not an array)"); return []; }
  if (raw.length > MAX_CLIPS) errors.push(`sequence: only the first ${MAX_CLIPS} clips are used`);
  const clips: Clip[] = [];
  raw.slice(0, MAX_CLIPS).forEach((entry, i) => {
    const tag = `sequence[${i}]: `;
    const c = entry as Record<string, unknown> | null;
    if (!c || typeof c !== "object" || Array.isArray(c)) { errors.push(`${tag}dropped (not an object)`); return; }
    const from = c.from, to = c.to;
    if (!Number.isInteger(from) || !Number.isInteger(to) || (from as number) < 0 || (to as number) <= (from as number)) {
      errors.push(`${tag}dropped (from and to must be integers with 0 ≤ from < to)`);
      return;
    }
    const prev = clips[clips.length - 1];
    if (prev && (from as number) < prev.to) { errors.push(`${tag}dropped (overlaps or is out of order)`); return; }
    const layers = Array.isArray(c.layers) ? sanitizeLayerList(c.layers as unknown[], ctx, errors, dropped, tag) : [];
    if (layers.length === 0) { errors.push(`${tag}dropped (no valid layers)`); return; }
    const camera = c.camera !== undefined ? sanitizeCamera(c.camera, errors) : undefined;
    let transition: Transition | undefined;
    if (c.transition !== undefined) {
      const t = c.transition as Record<string, unknown> | null;
      const type = t && typeof t === "object" ? t.type : undefined;
      if (!TRANSITIONS.includes(type as (typeof TRANSITIONS)[number])) errors.push(`${tag}transition dropped (type must be cut, wipe, iris or fade)`);
      else if (clips.length === 0) errors.push(`${tag}transition ignored (first clip)`);
      else if (type === "cut") transition = { type: "cut" };
      else {
        const frames = t!.frames;
        if (!Number.isInteger(frames) || (frames as number) < 1 || (frames as number) > 600) errors.push(`${tag}transition dropped (frames must be an integer from 1 to 600)`);
        else {
          let n = frames as number;
          const length = (to as number) - (from as number);
          if (n > length) { errors.push(`${tag}transition frames clamped to ${length}`); n = length; }
          const dir = t!.direction;
          if (type === "wipe") {
            if (dir !== undefined && !WIPE_DIRECTIONS.includes(dir as (typeof WIPE_DIRECTIONS)[number])) errors.push(`${tag}transition direction must be left, right, up or down; using right`);
            const direction = WIPE_DIRECTIONS.includes(dir as (typeof WIPE_DIRECTIONS)[number]) ? (dir as Transition["direction"]) : "right";
            transition = { type, frames: n, direction };
          } else transition = { type: type as "iris" | "fade", frames: n };
        }
      }
    }
    clips.push({ from: from as number, to: to as number, layers: layers as Clip["layers"], ...(camera ? { camera } : {}), ...(transition ? { transition } : {}) });
  });
  return clips;
}

/** Full-vocabulary JSON schema (a subset schema is built per-request by the selector). */
export const ANIMSPEC_JSON_SCHEMA = buildJsonSchema(PRIMITIVES);
