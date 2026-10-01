/**
 * Deliberately rule-breaking primitive fixtures for the vetting-gate self-test.
 *
 * Fixtures live outside `src/` so the library can never import them. The purity
 * fixtures need Node's `fs` and `net`; these imports are in `scripts/`, never in
 * `src/`, so the static scan is not affected.
 */
import * as fs from "node:fs";
import * as net from "node:net";
import type { CanvasRenderingContext2D } from "@napi-rs/canvas";
import type { PrimitiveDef, DrawContext, Palette, Dimensions } from "../../src/primitives/registry";
import type { SignalFrame } from "../../src/types";

export type FixtureGate = "purity" | "palette" | "reactivity" | "budget";

type Layer = Record<string, unknown>;

const mkDraw =
  (act: (ctx: CanvasRenderingContext2D, d: Dimensions, p: Palette) => void) =>
  (ctx: CanvasRenderingContext2D, d: Dimensions, _f: SignalFrame, _l: Layer, p: Palette, _x: DrawContext) => {
    act(ctx, d, p);
  };

/** A primitive whose draw reads a file — breaks the purity rule. */
const FILE_READER: PrimitiveDef = {
  type: "fixture-file-read",
  category: "structure",
  description: "purity fixture: reads package.json in draw",
  params: {},
  draw: mkDraw((ctx, d, p) => {
    fs.readFileSync("package.json", "utf8"); // recorded and forwarded by the IO guard
    ctx.fillStyle = p.fg;
    ctx.fillRect(0, 0, d.width, d.height);
  }),
};

/** A primitive whose draw opens a network connection — breaks the purity rule. */
const NET_CONNECTOR: PrimitiveDef = {
  type: "fixture-net-connect",
  category: "structure",
  description: "purity fixture: calls net.connect in draw",
  params: {},
  draw: mkDraw((ctx, d, p) => {
    net.connect(80, "127.0.0.1"); // recorded and blocked by the IO guard
    ctx.fillStyle = p.fg;
    ctx.fillRect(0, 0, d.width, d.height);
  }),
};

export const BAD_PRIMITIVES: Array<{ gate: FixtureGate; def: PrimitiveDef }> = [
  { gate: "purity", def: FILE_READER },
  { gate: "purity", def: NET_CONNECTOR },
];

/** A primitive that paints a fixed off-palette colour — breaks the palette rule. */
const OFF_PALETTE: PrimitiveDef = {
  type: "fixture-off-palette",
  category: "structure",
  description: "palette fixture: paints fixed #00ff00",
  params: {},
  draw: mkDraw((ctx, d, _p) => {
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0, 0, d.width, d.height);
  }),
};

BAD_PRIMITIVES.push({ gate: "palette", def: OFF_PALETTE });
