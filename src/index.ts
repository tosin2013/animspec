/**
 * animspec — public surface. An `AnimSpec` plus a `SignalFrame` renders to a
 * frame deterministically: same spec + signal + seed ⇒ byte-identical pixels.
 */
export { drawSpec } from "./specInterpreter";
export type { AnimSpec, SpecOpts, Dimensions } from "./specInterpreter";
export {
  PRIMITIVES,
  getPrimitive,
  sanitizeLayer,
  buildJsonSchema,
  buildVocabPrompt,
} from "./primitives/registry";
export type { PrimitiveDef, ParamSpec, Category, Palette, DrawContext } from "./primitives/registry";
export { select } from "./primitives/selector";
export { validateAnimSpec, ANIMSPEC_JSON_SCHEMA } from "./specValidator";
export type { ValidationResult } from "./specValidator";
export { FONTS, DEFAULT_FONT } from "./fonts/index";
export type { FontKey, ShippedFont } from "./fonts/index";
export { mulberry32, mixSeed, hashBytes } from "./rng";
export type { SignalFrame, SignalSource, SignalSourceMeta, SignalKind } from "./types";
