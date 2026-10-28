/**
 * Showcase cases: options the one-per-primitive gallery cannot show, because
 * the gallery draws default layers. Each case is a real spec, rendered by the
 * committed library. `showcase:generate` writes them to `showcase/`, the site
 * generator builds `docs/showcase.md` from this list, and the registry gate
 * re-renders the stills to keep them fresh. Generator-only.
 */
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drawSpec, type AnimSpec } from "../../src/specInterpreter.js";
import { validateAnimSpec } from "../../src/specValidator.js";
import { goldenFrames, HERO_ROLES } from "./goldenHashes.js";

export const SHOWCASE_DIMS = { width: 320, height: 180 };
/** Frames in an animated case: one second at 30 frames per second. */
export const SHOWCASE_LOOP_FRAMES = 30;

export interface ShowcaseCase {
  name: string;
  title: string;
  caption: string;
  since: string;
  /** A still is a PNG at the reference "mid" frame; a loop is a one-second GIF. */
  kind: "still" | "loop";
  creative?: boolean;
  /** The active caption text, for caption layers. */
  label?: string;
  /** Spec 022: decoded image assets for the case's declared `assets`. */
  assets?: () => Record<string, unknown>;
  /** Spec 027: the render size, for a profile other than 320 × 180. */
  dims?: { width: number; height: number };
  /** Spec 027: per-frame data (coords, labels, a loudness) the host would supply, by frame index. */
  frameData?: (i: number) => { coords?: Array<{ x: number; y: number }>; labels?: string[]; amplitude?: number };
  spec: Record<string, unknown>;
}

const centre = { frame: 0, zoom: 1, x: 0.5, y: 0.5 };

// Arcade HUD data (spec 027), as a host would supply it per frame: the right
// fighter is hit at frame 10 and its damage tail drains to the new health by
// frame 25; the timer ticks at frame 15. The shooter's score rises.
const versusData = (i: number) => {
  const hitAt = 10, drained = 25, before = 0.9, after = 0.55;
  const tail = i < hitAt ? before : before - (before - after) * Math.min(1, (i - hitAt) / (drained - hitAt));
  return { coords: [{ x: 0.85, y: 0.85 }, { x: i < hitAt ? before : after, y: tail }], labels: [i < 15 ? "99" : "98", "HERO", "RIVAL"] };
};
// Spec 029: two fighters in the guard stance, a punch landing at frame 10.
// 16 roles, the spec's limit: the fighter's ten parts, three stage colours, and the
// player-two swaps for the gi, its shade and the headband.
const VERSUS_ROLES = { ...HERO_ROLES, s0: "#101040", s1: "#a04050", d0: "#6a4a28", hair: "#202020", "hair-light": "#484848", cloak: "#203870", "cloak-shade": "#152650", tunic: "#101010", gold: "#e0b030", boots: "#c03030", "cloak-alt": "#a03018", "cloak-shade-alt": "#702010", "gold-alt": "#f0f0f0" };
const versusLayers = (left: string, right: string) => [
  band("s0,s1", 0, 0, 1, 0.78), band("d0", 0, 0.78, 1, 1),
  { type: "sprite", character: "fighter", motion: "static", scale: 4, x: 0.36, y: 0.56, reactive: false, pose: left },
  { type: "sprite", character: "fighter", motion: "static", scale: 4, x: 0.64, y: 0.56, reactive: false, faceLeft: true, variant: "alt", pose: right },
  { type: "versus-bars" }, { type: "hud-score", layout: "versus", drive: "none" },
];
// The attract screen's HUD: no game in progress, credits waiting, 1UP flashing every 8 frames.
const attractData = (i: number) => ({ labels: ["000000", "050000", "0"], amplitude: i % 8 < 4 ? 0.9 : 0.3 });
const shooterData = (i: number) => ({ labels: [String(12300 + i * 40).padStart(6, "0"), "050000", "1"] });
// #139: headlines from the host; a beat every 10 frames makes the centre item loud.
const newsData = (i: number) => ({ labels: ["MARKETS OPEN HIGHER", "RAIN BY EVENING", "LOCAL TEAM WINS 3-1", "ROADS CLEAR BY NINE"], amplitude: i % 10 < 4 ? 0.9 : 0.35 });
const busy = [{ type: "grid" }, { type: "wave" }, { type: "figure", count: 3 }];

// Retro game scenes (specs 019/020): a level built from a `b`-filled checker
// (the sky, in roles.fg2), a solid patterned grid (bricks and a platform in
// the accent) and the v2 hero, bouncing back and forth once per loop
// (speed π) so the GIF loops seamlessly.
const LEVEL = "................/................/................/................/................/.........aaa..../................/................/aaaaaaaaaaaaaaaa/aaaaaaaaaaaaaaaa";
const SNES_LEVEL = "................/..##........##../.####......####./................/................/.........aaa..../................/................/aaaaaaaaaaaaaaaa/aaaaaaaaaaaaaaaa";
const DMG = { darkest: "#0f380f", dark: "#306230", light: "#8bac0f", lightest: "#9bbc0c" };
const levelLayers = (pattern: string) => [
  { type: "checker", pattern: "b", size: 40 },
  { type: "grid", solid: true, pattern },
  { type: "sprite", character: "hero", motion: "bounce", speed: Math.PI, scale: 5, y: 0.8, reactive: false },
];

// DOS adventure (spec 021): every element is a static `dither` band (sky and
// sand gradients, the UI bar, the monolith, the terminal), the hero bouncing
// once per loop, and the verb and parser line in the bar via caption.margin.
// A spec holds at most 16 roles: the hero takes ten, so the props reuse its
// darker roles and the bar takes the accent.
const band = (colors: string, x0: number, y0: number, x1: number, y1: number) => ({ type: "dither", colors, x0, y0, x1, y1, drive: "none" });
const DOS_LAYERS = [
  band("s0,s1,s2", 0, 0, 1, 0.556),
  band("d0,d1", 0, 0.556, 1, 0.7),
  band("accent", 0, 0.7, 1, 1),
  band("outline", 0.694, 0.244, 0.763, 0.611),
  band("cloak-shade", 0.694, 0.244, 0.713, 0.611),
  band("cloak", 0.1875, 0.511, 0.269, 0.644),
  band("bg", 0.197, 0.528, 0.259, 0.6),
  band("glow", 0.203, 0.544, 0.231, 0.55),
  band("glow", 0.203, 0.561, 0.244, 0.567),
  { type: "sprite", character: "hero", motion: "bounce", speed: Math.PI, scale: 3, y: 0.66, reactive: false },
  { type: "caption", box: "none", margin: 0, maxLines: 2 },
];

// Parallax forest (spec 022): four wrapping planes (sky, mountains, trees,
// ground) scroll at four speeds behind the hero. The planes are committed
// PNGs under showcase/assets/parallax-forest/ (made by
// scripts/generate-showcase-assets.ts), declared with the sha256 of those
// file bytes, exactly as a real spec declares its art.
const ASSET_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "showcase", "assets");
/** Every committed showcase asset: id → file under showcase/assets/ (specs 022, 023). */
const ASSET_FILES: Record<string, string> = {
  sky: "parallax-forest/sky.png",
  mountains: "parallax-forest/mountains.png",
  trees: "parallax-forest/trees.png",
  ground: "parallax-forest/ground.png",
  walk: "sheet-walk/walk.png",
};
export const FOREST_IDS = ["sky", "mountains", "trees", "ground"] as const;
// Decoding must go through `loadImage`: an `Image` given `src` bytes
// synchronously reports its size but draws no pixels. So the planes are
// decoded once by `preloadShowcaseAssets()` before any render.
let FOREST: Record<string, Image> | null = null;
const forestBytes = (id: string) => fs.readFileSync(path.join(ASSET_ROOT, ASSET_FILES[id]));
function forestPlanes(): Record<string, Image> {
  if (!FOREST) throw new Error("showcase assets are not decoded: await preloadShowcaseAssets() before rendering");
  return FOREST;
}
/** Decode every showcase asset (async); call once before renderShowcase. */
export async function preloadShowcaseAssets(): Promise<void> {
  if (FOREST) return;
  const entries = await Promise.all(Object.keys(ASSET_FILES).map(async (id) => [id, await loadImage(forestBytes(id))] as const));
  FOREST = Object.fromEntries(entries);
}
/** PNG width and height from the IHDR chunk, so declarations need no decode. */
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });
const assetDecl = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => {
  const bytes = forestBytes(id);
  return [id, { sha256: crypto.createHash("sha256").update(bytes).digest("hex"), ...pngSize(bytes) }];
}));
const forestDecl = () => assetDecl(FOREST_IDS);
const forestPlane = (asset: string, scrollX: number) => ({ type: "image", asset, fit: "none", x: 0, y: 0, anchor: "top-left", wrap: "x", scrollX, drive: "none" });

export const SHOWCASE: ShowcaseCase[] = [
  { name: "game-boy-dmg", since: "0.10.0", kind: "loop", creative: true, dims: { width: 160, height: 144 }, title: "Game Boy DMG profile", caption: "160 × 144 with `profile: \"gameboy-dmg\"` and `pixelMode`: the background, ink, accent, `fg2` and the hero's parts all come from the four DMG greens, so every pixel of every frame is one of them. No `roles` are written by hand.", spec: { background: "white", profile: "gameboy-dmg", pixelMode: true, layers: [{ type: "checker", pattern: "b", size: 16 }, { type: "tetris", cols: 8 }, { type: "sprite", character: "hero", motion: "bounce", speed: 1.2, scale: 2, y: 0.95, reactive: false }] } },
  { name: "genesis", since: "0.10.0", kind: "loop", creative: true, assets: forestPlanes, dims: { width: 320, height: 224 }, title: "Genesis profile", caption: "320 × 224 with `profile: \"genesis\"`: four image planes scroll at their own speeds, the hero walks in front, and a `dither` band with `matrix: \"2\"` mixes two sea tones in a checkerboard. Every colour, including the art's, is snapped to the 512-colour 9-bit grid.", spec: { profile: "genesis", pixelMode: true, roles: { ...HERO_ROLES, "sea-dark": "#1830a0", "sea-light": "#3878e0" }, assets: forestDecl(), layers: [forestPlane("sky", 0), forestPlane("mountains", 0.05), forestPlane("trees", 0.2), forestPlane("ground", 0.5), { type: "dither", colors: "sea-dark,sea-light", y0: 0.8, matrix: "2", drive: "none" }, { type: "sprite", character: "hero", motion: "static", scale: 3, x: 0.35, y: 0.62, reactive: false }] } },
  { name: "news-ticker", since: "0.9.0", kind: "loop", creative: true, frameData: newsData, title: "News ticker", caption: "`ticker` scrolls the frame's `labels` as a news band, joined by separators; the headline crossing the centre turns accent on loud frames. The bars above follow the same signal.", spec: { accent: "#e02020", layers: [{ type: "bars", heightFrac: 0.6 }, { type: "ticker", speed: 3 }] } },
  { name: "cps2-versus", since: "0.9.0", kind: "loop", creative: true, dims: { width: 384, height: 224 }, frameData: versusData, title: "Versus stage (CPS II profile)", caption: "384 × 224 with `pixelMode`: two `fighter` sprites, the second a player-two palette swap (`variant: \"alt\"`) facing left. A `sequence` of clips stages the exchange: guard, a `pose: \"punch\"` against a `pose: \"hit\"`, then guard again. `versus-bars` reads each side's health and damage tail from the frame's `coords` (the tail drains after the hit); `hud-score` draws the timer and names from its `labels`.", spec: { pixelMode: true, accent: "#e02020", roles: VERSUS_ROLES, sequence: [
    { from: 0, to: 10, layers: versusLayers("auto", "auto") },
    { from: 10, to: 16, layers: versusLayers("punch", "hit") },
    { from: 16, to: 30, layers: versusLayers("auto", "auto") },
  ] } },
  { name: "arcade-attract", since: "0.10.0", kind: "loop", creative: true, dims: { width: 256, height: 224 }, frameData: attractData, title: "Arcade attract mode (horizontal)", caption: "A MAME-era horizontal attract screen at 256 × 224 with `pixelMode`: a `dots` starfield over a `gridhorizon` floor, the player `sprite`, and `hud-score` reading 1UP, HI-SCORE and CREDIT from the frame's `labels`; 1UP flashes on the beat, and `INSERT COIN` waits. The CRT look is a finish added after animspec (Motion Studio).", spec: { pixelMode: true, accent: "#f0c020", layers: [{ type: "dots", count: 90 }, { type: "gridhorizon" }, { type: "sprite", character: "bot", motion: "bounce", speed: 1.4, scale: 3, y: 0.7, reactive: false }, { type: "type-reveal", text: "INSERT COIN", framesPerUnit: 1, fontSize: 14, y: 0.86 }, { type: "hud-score", size: 0.055 }] } },
  { name: "tate-shooter", since: "0.9.0", kind: "loop", dims: { width: 224, height: 288 }, frameData: shooterData, title: "Vertical shooter (tate profile)", caption: "224 × 288 portrait with `pixelMode`: a `dots` starfield, the player (`sprite` `bot`), and `hud-score` with 1UP, HI-SCORE and CREDIT from the frame's `labels`; the score rises as the host's data changes.", spec: { pixelMode: true, layers: [{ type: "dots", count: 120 }, { type: "sprite", character: "bot", motion: "bounce", speed: 1.5, scale: 4, y: 0.82, reactive: false }, { type: "hud-score" }] } },
  { name: "print-exact", since: "0.9.0", kind: "still", creative: true, title: "Print-exact bars and rings", caption: "`pixelMode: true` puts every bar edge and ring outline on whole pixels, so each pixel is exactly a palette colour; `tone2: \"alternate\"` draws every other bar and ring in `roles.fg2`.", spec: { accent: "#c8963e", pixelMode: true, roles: { fg2: "#d8c8a0" }, layers: [{ type: "bars", tone2: "alternate", heightFrac: 0.5 }, { type: "rings", tone2: "alternate", count: 6, thickness: 6 }] } },
  { name: "shot-list", since: "0.8.0", kind: "loop", creative: true, label: "the survey", title: "Shot list", caption: "A `sequence` of four clips in one spec: a title, a dithered night scene (wipe in), the hero (iris in) and an end card (fade in). Each clip animates from its own first frame; any frame renders alone.", spec: { roles: { ...HERO_ROLES, s0: "#000014", s1: "#281444", s2: "#6c3468", d0: "#a06438", d1: "#d8a868" }, sequence: [
    { from: 0, to: 8, layers: [{ type: "text" }] },
    { from: 8, to: 16, layers: [{ type: "dither", colors: "s0,s1,s2", y1: 0.7, drive: "none" }, { type: "dither", colors: "d0,d1", y0: 0.7, drive: "none" }], transition: { type: "wipe", frames: 4, direction: "left" } },
    { from: 16, to: 24, layers: [{ type: "dither", colors: "d1,d0,s2", y1: 0.7, drive: "none" }, { type: "dither", colors: "s1,s0", y0: 0.7, drive: "none" }, { type: "sprite", character: "hero", motion: "static", scale: 4, y: 0.6, reactive: false }], transition: { type: "iris", frames: 4 } },
    { from: 24, to: 30, layers: [{ type: "caption", box: "outline", position: "center" }], transition: { type: "fade", frames: 4 } },
  ] } },
  { name: "sheet-walk", since: "0.8.0", kind: "loop", creative: true, assets: forestPlanes, title: "Sprite sheet walk", caption: "An 8-frame walk-cycle sheet played by `image` with `sheetCols: 8` and `fps: 8`: the frame is a closed form of time, so any frame renders alone. The ground scrolls beneath.", spec: { roles: { soil: "#6a4a2a", grass: "#3a8a2a" }, assets: assetDecl(["walk", "ground"]), layers: [{ type: "dither", colors: "grass,soil", y0: 0.78, drive: "none" }, { type: "image", asset: "ground", fit: "none", x: 0, y: 0, anchor: "top-left", wrap: "x", scrollX: 0.2, drive: "none" }, { type: "image", asset: "walk", sheetCols: 8, fps: 8, fit: "none", scale: 3, x: 0.5, y: 0.86, anchor: "bottom", drive: "none" }] } },
  { name: "parallax-forest", since: "0.8.0", kind: "loop", creative: true, assets: forestPlanes, title: "Parallax forest", caption: "Four declared image assets (`assets`, pinned by sha256) wrap and scroll at four speeds with `wrap` and `scrollX`; the hero walks in front. The art keeps its own colours in creative mode.", spec: { roles: HERO_ROLES, assets: forestDecl(), layers: [forestPlane("sky", 0), forestPlane("mountains", 0.05), forestPlane("trees", 0.2), forestPlane("ground", 0.5), { type: "sprite", character: "hero", motion: "static", scale: 3, x: 0.35, y: 0.62, reactive: false }] } },
  { name: "dos-adventure", since: "0.7.0", kind: "loop", creative: true, label: "look   take   use   talk   walk  > survey the monolith", title: "DOS adventure", caption: "Ordered Bayer `dither` bands for the sky, sand, props and the UI bar; the hero walks; the verb and parser line sit in the bar with `caption.margin`. `pixelAspect: 1.2` records the Mode 13h pixel shape.", spec: { pixelAspect: 1.2, accent: "#0000a8", roles: { ...HERO_ROLES, s0: "#000014", s1: "#281444", s2: "#6c3468", d0: "#a06438", d1: "#d8a868", glow: "#38fc38" }, layers: DOS_LAYERS } },
  { name: "game-boy", since: "0.7.0", kind: "loop", creative: true, title: "Game Boy level", caption: "The four DMG greens from palette roles alone: the sky is a `b`-filled checker in `roles.fg2`, the bricks are accent cells, and the hero's parts take the darker greens.", spec: { background: "white", accent: DMG.dark, roles: { fg2: DMG.lightest, outline: DMG.darkest, hair: DMG.dark, "hair-light": DMG.light, skin: DMG.light, eyes: DMG.darkest, gold: DMG.light, cloak: DMG.dark, "cloak-shade": DMG.darkest, tunic: DMG.dark, boots: DMG.darkest }, layers: levelLayers(LEVEL) } },
  { name: "snes", since: "0.7.0", kind: "loop", creative: true, title: "SNES level", caption: "The same level in 16-bit colour: a sky-blue `roles.fg2`, brick accent cells, white clouds from `#` cells, and the hero in full `roles` colour.", spec: { background: "black", accent: "#c84c0c", roles: { ...HERO_ROLES, fg2: "#5c94fc" }, layers: levelLayers(SNES_LEVEL) } },
  { name: "two-tone-quilt", since: "0.7.0", kind: "still", creative: true, title: "Two-tone quilt", caption: "`b` cells take the second tone, `roles.fg2`, next to `#` and the accent; in monochrome they draw mid grey.", spec: { accent: "#c8963e", roles: { fg2: "#d8c8a0" }, layers: [{ type: "grid", solid: true, pattern: "##.a.##/#b...b#/..###../#b...b#/##.a.##" }] } },
  { name: "hero-roles", since: "0.7.0", kind: "loop", creative: true, title: "hero: palette roles", caption: "The v2 `hero` walking, each part in the colour the spec's `roles` map gives it (creative mode).", spec: { roles: HERO_ROLES, layers: [{ type: "sprite", character: "hero", scale: 6, speed: 1.4, reactive: false }] } },
  { name: "hero-mono", since: "0.7.0", kind: "still", title: "hero: monochrome", caption: "Without creative mode the same character falls back to the legacy greys and reads in pure black and white.", spec: { roles: HERO_ROLES, layers: [{ type: "sprite", character: "hero", motion: "static", scale: 6, y: 0.55 }] } },
  { name: "quilt-pattern", since: "0.6.0", kind: "still", creative: true, title: "Quilt pattern", caption: "`pattern` draws exactly the authored cells: `.` empty, `#` foreground, `a` accent. With `solid`, every pixel is one of the three.", spec: { accent: "#c8963e", layers: [{ type: "grid", solid: true, pattern: "##.a.##/#.....#/..###../#.....#/##.a.##" }] } },
  { name: "break-it-once", since: "0.6.0", kind: "still", creative: true, title: "Break it once", caption: "`breaks: \"3,2 r15\"` turns one block about its centre; every other cell stays put.", spec: { accent: "#c8963e", layers: [{ type: "grid", solid: true, pattern: "##.a.##/#.....#/..###../#.....#/##.a.##", breaks: "3,2 r15" }] } },
  { name: "checker-pattern", since: "0.6.0", kind: "loop", creative: true, title: "Patterned checker", caption: "A checker `pattern` tiles from the top-left; `~` squares still flip with the signal.", spec: { accent: "#c8963e", layers: [{ type: "checker", size: 30, pattern: "#.~/.a./~.#" }] } },
  { name: "camera-shake", since: "0.5.0", kind: "loop", title: "Camera shake", caption: "A seeded tremble on a static camera: `shake: { amp: 0.03, freq: 4 }`.", spec: { camera: { move: "static", from: centre, shake: { amp: 0.03, freq: 4 } }, layers: [{ type: "grid" }, { type: "wave" }] } },
  { name: "camera-shake-parallax", since: "0.5.0", kind: "loop", title: "Shake under parallax", caption: "Each layer shakes by its depth: the horizon at depth 0 stays still, the figures at depth 1 shake fully.", spec: { camera: { move: "parallax", from: centre, to: { ...centre, frame: 29 }, shake: { amp: 0.04, freq: 3 } }, layers: [{ type: "gridhorizon", depth: 0 }, { type: "figure", count: 3, depth: 1 }] } },
  { name: "camera-pan-wide", since: "0.5.0", kind: "loop", title: "Wide pan", caption: "A pan from `x: 0.5` to `x: 1.5`, past the old 0..1 range, over parallax layers.", spec: { camera: { move: "parallax", from: centre, to: { ...centre, frame: 29, x: 1.5 } }, layers: [{ type: "gridhorizon", depth: 0.3 }, { type: "figure", count: 3, depth: 1 }] } },
  { name: "transparent-light", since: "0.5.0", kind: "still", title: "Transparent, light ink", caption: "`background: \"transparent\"`: the black lifted out to alpha, shown over a checkerboard.", spec: { background: "transparent", layers: busy } },
  { name: "transparent-dark", since: "0.5.0", kind: "still", title: "Transparent, dark ink", caption: "`ink: \"dark\"`: drawn as on white with the white lifted out, for print over light paper.", spec: { background: "transparent", ink: "dark", layers: busy } },
  { name: "transparent-accent", since: "0.5.0", kind: "still", creative: true, title: "Transparent with an accent", caption: "An accent colour in creative mode on a transparent background.", spec: { background: "transparent", accent: "#ff2d2d", layers: [{ type: "rings" }, { type: "wave" }] } },
  { name: "grid-solid", since: "0.4.0", kind: "still", title: "grid: solid", caption: "`solid: true` lights cells at full opacity on whole pixels, so every pixel is exactly bg, fg or accent.", spec: { layers: [{ type: "grid", solid: true }] } },
  { name: "thickness", since: "0.4.0", kind: "still", title: "Line thickness", caption: "`thickness` in pixels: `rings` at 8 and `wave` at 20.", spec: { layers: [{ type: "rings", thickness: 8 }, { type: "wave", thickness: 20 }] } },
  { name: "figure-stances", since: "0.4.0", kind: "still", title: "figure: wave and cheer", caption: "The `wave` stance in a row, and `cheer` in an outlined cluster placed with `x`, `y` and `scale`.", spec: { layers: [{ type: "figure", count: 2, stance: "wave", x: 0.3, y: 0.55, scale: 0.45 }, { type: "figure", count: 3, stance: "cheer", arrangement: "cluster", style: "outline", x: 0.75, y: 0.6, scale: 0.4 }] } },
  { name: "rig-wave", since: "0.4.0", kind: "still", title: "rig: wave", caption: "The host rig's `wave` pose.", spec: { layers: [{ type: "rig", pose: "wave" }] } },
  { name: "rig-present", since: "0.4.0", kind: "still", title: "rig: present", caption: "The host rig's `present` pose.", spec: { layers: [{ type: "rig", pose: "present" }] } },
  { name: "rig-reach", since: "0.4.0", kind: "still", title: "rig: reach", caption: "The bot rig's `reach` pose.", spec: { layers: [{ type: "rig", rig: "bot", pose: "reach" }] } },
];

export const showcaseFile = (c: ShowcaseCase): string => `${c.name}.${c.kind === "loop" ? "gif" : "png"}`;

/** The case's frames as RGBA: one for a still, SHOWCASE_LOOP_FRAMES for a loop. */
export function renderShowcase(c: ShowcaseCase): Uint8ClampedArray[] {
  const v = validateAnimSpec(c.spec);
  if (!v.valid || !v.spec || v.errors.length > 0 || v.dropped.length > 0) {
    throw new Error(`showcase case ${c.name} does not validate cleanly: ${[...v.errors, ...v.dropped].join("; ")}`);
  }
  // The reference frame without its test label, so figures carry no caption.
  const mid = { ...goldenFrames().mid, labels: undefined };
  const count = c.kind === "loop" ? SHOWCASE_LOOP_FRAMES : 1;
  const out: Uint8ClampedArray[] = [];
  for (let i = 0; i < count; i++) {
    const base = c.label ? { ...mid, labels: [c.label] } : mid;
    const timed = c.kind === "loop" ? { ...base, index: i, t: i / 30 } : base;
    const frame = c.frameData ? { ...timed, ...c.frameData(i) } : timed;
    const dims = c.dims ?? SHOWCASE_DIMS;
    const ctx = createCanvas(dims.width, dims.height).getContext("2d");
    drawSpec(ctx, dims, frame, v.spec as AnimSpec, { reducedFlicker: true, creative: c.creative ?? false, seed: 12345, ...(c.assets ? { assets: c.assets() as never } : {}) });
    out.push(ctx.getImageData(0, 0, dims.width, dims.height).data);
  }
  return out;
}
