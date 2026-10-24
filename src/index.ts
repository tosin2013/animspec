/**
 * animspec — public surface. An `AnimSpec` plus a `SignalFrame` renders to a
 * frame deterministically: same spec + signal + seed ⇒ byte-identical pixels.
 */
export { drawSpec } from "./specInterpreter.js";
export type { AnimSpec, SpecOpts, Dimensions } from "./specInterpreter.js";
export {
  PRIMITIVES,
  getPrimitive,
  sanitizeLayer,
  sanitizeRoles,
  buildJsonSchema,
  buildVocabPrompt,
  VOCABULARY_VERSION,
  TIERS,
  PRIMITIVE_ROLES,
  externalPrimitives,
} from "./primitives/registry.js";
export { declaredRoles } from "./primitives/sprites.js";
export type { PrimitiveDef, ParamSpec, Category, Palette, DrawContext, Tier } from "./primitives/registry.js";
export { select, selectDetailed, KIT_NAMES } from "./primitives/selector.js";
export type { KitName } from "./primitives/selector.js";
export { validateAnimSpec, ANIMSPEC_JSON_SCHEMA } from "./specValidator.js";
export { checkAssets } from "./assets.js";
export { registerPlugin, registeredPlugins } from "./plugins.js";
export type { Plugin } from "./plugins.js";
export { isSpdxExpression } from "./spdx.js";
export type { AssetImage, AssetRecord } from "./assets.js";
export type { ValidationResult } from "./specValidator.js";
export { FONTS, DEFAULT_FONT, resolveFontFamily } from "./fonts/index.js";
export type { FontKey, ShippedFont } from "./fonts/index.js";
export { mulberry32, mixSeed, hashBytes } from "./rng.js";
export type { SignalFrame } from "./types.js";
export {
  encodeSignalTrack,
  decodeSignalTrack,
  readSignalTrackHeader,
  readSignalFrame,
  indexSignalTrackSidecar,
  SIGNAL_TRACK_MAGIC,
  SIGNAL_TRACK_VERSION,
  SIGNAL_TRACK_HEADER_SIZE,
} from "./signalframe/index.js";
export type { SignalTrack, EncodedSignalTrack, SignalTrackHeader, SidecarIndex, SidecarEntry } from "./signalframe/index.js";
