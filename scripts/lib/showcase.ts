/**
 * Showcase cases: options the one-per-primitive gallery cannot show, because
 * the gallery draws default layers. Each case is a real spec, rendered by the
 * committed library. `showcase:generate` writes them to `showcase/`, the site
 * generator builds `docs/showcase.md` from this list, and the registry gate
 * re-renders the stills to keep them fresh. Generator-only.
 */
import { createCanvas } from "@napi-rs/canvas";
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
  spec: Record<string, unknown>;
}

const centre = { frame: 0, zoom: 1, x: 0.5, y: 0.5 };
const busy = [{ type: "grid" }, { type: "wave" }, { type: "figure", count: 3 }];

export const SHOWCASE: ShowcaseCase[] = [
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
    const frame = c.kind === "loop" ? { ...mid, index: i, t: i / 30 } : mid;
    const ctx = createCanvas(SHOWCASE_DIMS.width, SHOWCASE_DIMS.height).getContext("2d");
    drawSpec(ctx, SHOWCASE_DIMS, frame, v.spec as AnimSpec, { reducedFlicker: true, creative: c.creative ?? false, seed: 12345 });
    out.push(ctx.getImageData(0, 0, SHOWCASE_DIMS.width, SHOWCASE_DIMS.height).data);
  }
  return out;
}
