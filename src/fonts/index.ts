/**
 * Shipped fonts (specs/002-cross-machine-frames, contracts/fonts.md). The single
 * list of fonts the library draws text with — the schema's font choices are
 * generated from it (constitution Principle II allows a spec-level option its
 * own single list).
 *
 * Every font is registered once, when the library loads, from memory, so
 * drawing performs no file access (purity rule). This module must not import
 * any file or network module.
 */
import { GlobalFonts } from "@napi-rs/canvas";
import { DATA as dejavuData } from "./dejavuSansMono.js";
import { DATA as jetbrainsData } from "./jetbrainsMono.js";
import { DATA as ibmPlexData } from "./ibmPlexMono.js";

export type FontKey = "dejavu" | "jetbrains" | "plex";

export interface ShippedFont {
  key: FontKey;
  /** The family name the font is registered under, unique to this library. */
  family: string;
  label: string;
  licence: string;
}

/** Exactly one font is the default: `dejavu`. */
export const DEFAULT_FONT: FontKey = "dejavu";

export const FONTS: Record<FontKey, ShippedFont> = {
  dejavu: { key: "dejavu", family: "specfont-dejavu", label: "DejaVu Sans Mono", licence: "Bitstream Vera" },
  jetbrains: { key: "jetbrains", family: "specfont-jetbrains", label: "JetBrains Mono", licence: "OFL-1.1" },
  plex: { key: "plex", family: "specfont-plex", label: "IBM Plex Mono", licence: "OFL-1.1" },
};

const FONT_DATA: Record<FontKey, string> = {
  dejavu: dejavuData,
  jetbrains: jetbrainsData,
  plex: ibmPlexData,
};

// Register every font once, when the library loads, from memory. A font that
// fails to register would make text fall back to a machine font without any
// error, so that is checked here and reported loudly.
for (const key of Object.keys(FONTS) as FontKey[]) {
  GlobalFonts.register(Buffer.from(FONT_DATA[key], "base64"), FONTS[key].family);
  if (!GlobalFonts.has(FONTS[key].family)) {
    throw new Error(`shipped font "${key}" could not be registered; text would fall back to a machine font`);
  }
}

/**
 * True for a shipped font key. Own properties only: `key in FONTS` would also
 * accept inherited names such as "constructor" or "toString".
 */
export function isFontKey(key: unknown): key is FontKey {
  return typeof key === "string" && Object.hasOwn(FONTS, key);
}

/** The family for a known key, else the default family. */
export function resolveFontFamily(key?: unknown): string {
  return isFontKey(key) ? FONTS[key].family : FONTS[DEFAULT_FONT].family;
}
