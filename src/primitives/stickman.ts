/**
 * The `stickman` primitive's skeleton, poses and renderers (spec 030).
 *
 * A figure is a 10-joint skeleton: hip, neck, head, two shoulders' elbows and
 * hands, two hips' knees and feet. A pose is a set of joint angles; every
 * action is a closed-form function of the figure's local time, so any frame
 * renders alone and no figure carries state. Angles: arm A from straight down,
 * growing forwards and up (180 = straight up), the forearm adding E; thigh T
 * growing forwards, the shin bending back by K; lean tilts the torso forwards,
 * tilt the head; rot turns the whole body about the feet (falling, lying).
 *
 * This module never reads the registry: the entry passes in the palette
 * colours, a colour → RGB function and a font setter (so every font comes from
 * the draw context, as the purity scan requires), keeping it cycle-free.
 */
import { createCanvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { mulberry32, mixSeed } from "../rng.js";

type Pair = [number, number];
type Pt = [number, number];
export interface StickPose { dx: number; dy: number; lean: number; tilt: number; rot: number; A: Pair; E: Pair; T: Pair; K: Pair }

const TAU = Math.PI * 2;
const rad = (a: number): number => (a * Math.PI) / 180;
const ease = (x: number): number => x * x * (3 - 2 * x);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const pulse = (u: number): number => Math.sin(Math.PI * clamp(u, 0, 1));
const base = (): StickPose => ({ dx: 0, dy: 0, lean: 0, tilt: 0, rot: 0, A: [-10, 10], E: [10, 15], T: [-8, 8], K: [0, 0] });

export const STICK_ACTIONS = ["idle", "walk", "run", "jump", "punch", "kick", "hit", "fall", "ko", "wave", "dance", "point", "present", "reach", "look"] as const;
export const STICK_TARGET_ACTIONS: ReadonlySet<string> = new Set(["point", "present", "reach", "look"]);
/** Cycle length in seconds at speed 1, used to spread a crowd's phases over one cycle. */
const CYCLE: Record<string, number> = { idle: 1 / 0.6, walk: 1 / 1.4, run: 1 / 2.2, jump: 1.3, punch: 0.9, kick: 1.1, hit: 0.9, fall: 1.1, ko: 1, wave: 1 / 1.6, dance: 1 / 1.8, point: 1 / 0.6, present: 1 / 0.6, reach: 1 / 0.6, look: 1 / 0.6 };

/** The body actions: joint angles at local time t (seconds at speed 1). */
const POSES: Record<string, (t: number) => StickPose> = {
  idle(t) { const p = base(), b = Math.sin(t * TAU * 0.6); p.dy = 1.5 * b; p.A = [-12 - 2 * b, 12 + 2 * b]; p.E = [12, 18]; return p; },
  walk(t) {
    const p = base(), ph = t * TAU * 1.4, s = Math.sin(ph), c = Math.cos(ph);
    p.lean = 4; p.dy = -2.5 * Math.abs(c); p.A = [-32 * s, 32 * s]; p.E = [18, 18]; p.T = [30 * s, -30 * s];
    p.K = [35 * Math.max(0, -c), 35 * Math.max(0, c)]; return p;
  },
  run(t) {
    const p = base(), ph = t * TAU * 2.2, s = Math.sin(ph), c = Math.cos(ph);
    p.lean = 16; p.tilt = -6; p.dy = -6 * Math.abs(c); p.A = [-65 * s, 65 * s]; p.E = [95, 95]; p.T = [55 * s, -55 * s];
    p.K = [20 + 95 * Math.max(0, -c), 20 + 95 * Math.max(0, c)]; return p;
  },
  jump(t) {
    const p = base(), u = (((t % 1.3) + 1.3) % 1.3) / 1.3;
    const crouch = u < 0.18 ? pulse(u / 0.36) : u > 0.82 ? pulse((u - 0.82) / 0.36 + 0.5) : 0;
    const air = u >= 0.18 && u <= 0.82 ? Math.sin((Math.PI * (u - 0.18)) / 0.64) : 0;
    p.dy = 18 * crouch - 70 * air; p.A = [-20 + 170 * air, 20 + 150 * air]; p.E = [10, 10];
    p.T = [-10 + 40 * air - 20 * crouch, 20 + 50 * air + 30 * crouch]; p.K = [30 * crouch + 70 * air, 60 * crouch + 80 * air]; return p;
  },
  punch(t) {
    const p = base(), k = pulse(((((t % 0.9) + 0.9) % 0.9) / 0.9) * 1.6);
    p.lean = 6 + 8 * k; p.A = [55, 60 + 30 * k]; p.E = [110, 110 - 110 * k]; p.T = [-22, 22]; p.K = [10, 18]; return p;
  },
  kick(t) {
    const p = base(), k = pulse(((((t % 1.1) + 1.1) % 1.1) / 1.1) * 1.5);
    p.lean = -6 - 16 * k; p.tilt = 4; p.A = [50 + 20 * k, -20 + 70 * k]; p.E = [60, 40]; p.T = [-6, 15 + 85 * k]; p.K = [12, 70 - 70 * k]; p.dy = -4 * k; return p;
  },
  hit(t) {
    const p = base(), k = pulse(((((t % 0.9) + 0.9) % 0.9) / 0.9) * 1.4);
    p.dx = -10 * k; p.lean = -10 - 22 * k; p.tilt = -18 * k; p.A = [80 + 60 * k, 40 + 50 * k]; p.E = [25, 25]; p.T = [-18, 18 + 8 * k]; p.K = [20 * k, 10]; return p;
  },
  // Tips over once, from local time 0, and stays down.
  fall(t) {
    const p = POSES.hit(0.3), u = ease(clamp(t / 1.1, 0, 1));
    p.dx = 0; p.rot = -88 * u; p.A = [140, 100]; p.T = [-10 + 20 * u, 20]; p.K = [10, 5]; p.tilt = -20; return p;
  },
  ko(t) { const p = base(); p.rot = -88; p.A = [150, 110]; p.E = [5, 5]; p.T = [6, 16]; p.K = [4, 10]; p.tilt = -15 + 2 * Math.sin(t * TAU * 0.5); return p; },
  wave(t) { const p = base(), s = Math.sin(t * TAU * 1.6); p.A = [-12, 150 + 15 * s]; p.E = [10, 25 + 25 * s]; p.dy = 1.5 * Math.sin(t * TAU * 0.6); return p; },
  dance(t) {
    const p = base(), ph = t * TAU * 1.8, s = Math.sin(ph), c = Math.cos(ph);
    p.dy = -6 * Math.abs(c); p.dx = 6 * s; p.lean = 8 * s; p.tilt = 10 * s; p.A = [150 + 20 * s, 150 - 20 * s]; p.E = [40 * c, -40 * c];
    p.T = [-20 + 15 * s, 20 + 15 * s]; p.K = [25 * Math.max(0, s), 25 * Math.max(0, -s)]; return p;
  },
};

/** The pose for an action; target actions aim at angle `aim` (from the neck, in arm degrees). */
export function stickPose(action: string, t: number, aim: number): StickPose {
  if (!STICK_TARGET_ACTIONS.has(action)) return (POSES[action] ?? POSES.idle)(t);
  const p = POSES.idle(t), a = clamp(aim, 0, 200);
  // A head is a plain circle, so looking shows as tilt by the target's elevation:
  // above the horizontal tilts it back, below tilts it forward, at most 35°.
  const glance = clamp((90 - a) * 0.6, -35, 35);
  if (action === "point") { p.A = [-14, a]; p.E = [12, 0]; p.tilt = glance * 0.4; }
  else if (action === "present") { p.A = [a - 40, a - 15]; p.E = [10, 10]; p.tilt = glance * 0.3; }
  else if (action === "reach") { p.lean = 12; p.A = [-30, a + 12]; p.E = [20, 0]; p.T = [-14, 14]; p.tilt = glance * 0.4; }
  else { p.tilt = glance; }
  return p;
}

export interface Bones { segs: Array<[Pt, Pt]>; head: Pt; headR: number; neck: Pt; hands: Pt[]; feet: Pt[]; joints: Pt[] }

/**
 * Forward kinematics. One unit is a sixth of the figure's height; dx and dy
 * are in 120ths of it. rot turns the body about the feet, then lifts it so the
 * lowest point rests on the ground.
 */
export function stickBones(p: StickPose, x: number, ground: number, size: number, face: number, headScale: number): Bones {
  const L = size / 6;
  const at = (o: Pt, a: number, len: number): Pt => [o[0] + Math.sin(rad(a)) * len * face, o[1] + Math.cos(rad(a)) * len];
  const hip: Pt = [x + (p.dx * face * size) / 120, ground - 2 * L + (p.dy * size) / 120];
  const neck = at(hip, 180 - p.lean, 1.9 * L);
  const headR = 0.48 * L * headScale;
  const head = at(neck, 180 - p.lean - p.tilt, headR + 0.12 * L);
  const segs: Array<[Pt, Pt]> = [[hip, neck]], hands: Pt[] = [], feet: Pt[] = [], joints: Pt[] = [hip, neck];
  for (let i = 0; i < 2; i++) {
    const el = at(neck, p.A[i] - p.lean, 0.95 * L), hand = at(el, p.A[i] - p.lean + p.E[i], 0.9 * L);
    const kn = at(hip, p.T[i], L), ft = at(kn, p.T[i] - p.K[i], L);
    segs.push([neck, el], [el, hand], [hip, kn], [kn, ft]);
    hands.push(hand); feet.push(ft); joints.push(el, kn);
  }
  const b: Bones = { segs, head, headR, neck, hands, feet, joints };
  if (!p.rot) return b;
  const c = Math.cos(rad(p.rot * face)), s = Math.sin(rad(p.rot * face));
  const r = (q: Pt): Pt => [x + (q[0] - x) * c - (q[1] - ground) * s, ground + (q[0] - x) * s + (q[1] - ground) * c];
  const turned: Bones = { segs: segs.map(([a, bb]) => [r(a), r(bb)]), head: r(head), headR, neck: r(neck), hands: hands.map(r), feet: feet.map(r), joints: joints.map(r) };
  let low = turned.head[1] + headR;
  for (const [a, bb] of turned.segs) low = Math.max(low, a[1], bb[1]);
  const lift = low - ground, up = (q: Pt): Pt => [q[0], q[1] - lift];
  return { segs: turned.segs.map(([a, bb]) => [up(a), up(bb)]), head: up(turned.head), headR, neck: up(turned.neck), hands: turned.hands.map(up), feet: turned.feet.map(up), joints: turned.joints.map(up) };
}

/** One figure placed in the frame. */
export interface StickFigure { x: number; ground: number; size: number; face: number; phase: number; colour: string; speaker: boolean }

export interface StickParams {
  action: string; style: string; x: number; y: number; scale: number; facing: string; speed: number; travel: number;
  thickness: number; headScale: number; targetX: number; targetY: number; speech: boolean; from: string; index: number;
  drive: string; count: number; arrangement: string; highlight: number; colour: string;
}
export interface StickFrame { t: number; amplitude: number; labels?: string[]; coords?: Array<{ x: number; y: number }> }
export interface StickColours { bg: string; fg: string; accent: string; body: string; rgb: (c: string) => [number, number, number] }

/**
 * Where each figure stands (spec 030 R5, R6): the params for one figure; for a
 * crowd, the arrangement with a seeded phase (over one cycle) and size (±8%);
 * `coords[index + i]` overrides the position when present. Cluster figures
 * come back to front.
 */
export function stickPlace(q: StickParams, f: StickFrame, W: number, H: number, seed: number, colours: StickColours): StickFigure[] {
  const n = Math.round(clamp(q.count, 1, 12)), cycle = CYCLE[q.action] ?? 1;
  const travel = (x0: number): number => (q.travel ? (((x0 + q.travel * f.t + 0.1) % 1.2) + 1.2) % 1.2 - 0.1 : x0);
  const autoFace = (x0: number): number =>
    q.facing === "left" ? -1 : q.facing === "right" ? 1
    : STICK_TARGET_ACTIONS.has(q.action) ? (q.targetX * W >= x0 * W ? 1 : -1)
    : q.travel ? Math.sign(q.travel) : 1;
  const out: StickFigure[] = [];
  for (let i = 0; i < n; i++) {
    let x0 = q.x, g = q.y, size = 1, phase = 0, face = 0;
    if (n > 1) {
      const rng = mulberry32(mixSeed(seed, 1000 + i));
      phase = rng() * cycle; size = 1 + 0.08 * (2 * rng() - 1);
      const jx = rng(), jy = rng();
      // A jittered row: evenly spaced slots over 80% of the width, each figure up to
      // half a slot off its slot, so the crowd spreads out but never lines up.
      if (q.arrangement === "cluster") { x0 = q.x - 0.4 + (0.8 * (i + 0.5 + (jx - 0.5))) / n; g = q.y + (2 * jy - 1) * 0.04; size *= 0.85 + 0.15 * jy; }
      else if (q.arrangement === "split") {
        const left = i < Math.ceil(n / 2), half = left ? Math.ceil(n / 2) : n - Math.ceil(n / 2), j = left ? i : i - Math.ceil(n / 2);
        x0 = left ? q.x - 0.08 - 0.32 * ((half - j - 0.5) / half) : q.x + 0.08 + 0.32 * ((j + 0.5) / half); face = left ? 1 : -1;
      } else x0 = q.x - 0.35 + (0.7 * (i + 0.5)) / n;
    }
    const c = q.from === "coords" ? f.coords?.[Math.round(q.index) + i] : undefined;
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) { x0 = clamp(c.x, 0, 1); g = clamp(c.y, 0, 1); }
    x0 = travel(x0);
    const highlighted = q.highlight >= 1 && Math.round(q.highlight) === i + 1;
    out.push({
      x: x0 * W, ground: g * H, size: q.scale * H * size, face: face || autoFace(x0), phase,
      colour: highlighted ? colours.accent : colours.body,
      speaker: q.speech && (q.highlight >= 1 && Math.round(q.highlight) <= n ? highlighted : i === 0),
    });
  }
  if (q.arrangement === "cluster") out.sort((a, b) => a.ground - b.ground);
  return out;
}

/** Signal reaction (R7) in pixels, added to the pose: a bob growing with the signal, a hop on loud frames. */
function driveOffset(q: StickParams, f: StickFrame, fig: StickFigure): number {
  if (q.drive === "none") return 0;
  const amp = clamp(f.amplitude, 0, 1);
  let dy = -(1 + 2 * amp) * (fig.size / 100) * Math.sin((f.t + fig.phase) * TAU * 0.6 + 1);
  if (q.drive === "beat" && amp >= 0.6) dy -= 0.18 * fig.size * ((amp - 0.6) / 0.4);
  return dy;
}

/** A figure's bones at this frame: pose, aim, drive. */
export function stickFigureBones(q: StickParams, f: StickFrame, fig: StickFigure, headScale: number, W: number, H: number): Bones {
  const t = f.t * q.speed + fig.phase;
  let aim = 90;
  if (STICK_TARGET_ACTIONS.has(q.action)) {
    const neutral = stickBones(POSES.idle(t), fig.x, fig.ground, fig.size, fig.face, headScale);
    const dx = (q.targetX * W - neutral.neck[0]) * fig.face, dy = q.targetY * H - neutral.neck[1];
    aim = (Math.atan2(dx, dy) * 180) / Math.PI;
  }
  const pose = stickPose(q.action, t, aim);
  return stickBones(pose, fig.x, fig.ground + driveOffset(q, f, fig), fig.size, fig.face, headScale);
}

/** Line styles: stroked bones with round caps, a filled or ringed head, optional joint dots. */
export function drawStickLines(ctx: CanvasRenderingContext2D, b: Bones, style: string, colour: string, accent: string, w: number): void {
  ctx.strokeStyle = colour; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [a, c] of b.segs) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(b.head[0], b.head[1], b.headR, 0, TAU);
  if (style === "outline") { ctx.lineWidth = Math.max(1, w * 0.8); ctx.stroke(); }
  else { ctx.fillStyle = style === "joints" ? (accent === colour ? colour : accent) : colour; ctx.fill(); }
  if (style === "joints") {
    const tip = accent === colour ? colour : accent;
    ctx.fillStyle = tip;
    for (const h of [...b.hands, ...b.feet]) { ctx.beginPath(); ctx.arc(h[0], h[1], Math.max(1, w * 0.9), 0, TAU); ctx.fill(); }
    ctx.fillStyle = colour;
    for (const j of b.joints) { ctx.beginPath(); ctx.arc(j[0], j[1], Math.max(1, w * 0.7), 0, TAU); ctx.fill(); }
  }
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}

/**
 * Pixel path (R2): every figure of the layer stamped into one off-screen bitmap
 * with whole-pixel square brushes and a pixel disc head, in palette RGB only,
 * then drawn once at a whole-pixel position. One drawing operation per layer.
 */
export function drawStickPixels(ctx: CanvasRenderingContext2D, figs: Array<{ b: Bones; colour: string }>, style: string, accent: string, w: number, rgb: (c: string) => [number, number, number]): void {
  if (figs.length === 0) return;
  const brush = Math.max(1, Math.round(w)), pad = brush + 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { b } of figs) {
    const pts: Pt[] = [b.head, ...b.segs.flatMap((s) => s)];
    for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    x0 = Math.min(x0, b.head[0] - b.headR); y0 = Math.min(y0, b.head[1] - b.headR); x1 = Math.max(x1, b.head[0] + b.headR); y1 = Math.max(y1, b.head[1] + b.headR);
  }
  const ox = Math.floor(x0) - pad, oy = Math.floor(y0) - pad, bw = Math.ceil(x1) + pad - ox + 1, bh = Math.ceil(y1) + pad - oy + 1;
  if (bw <= 0 || bh <= 0 || bw * bh > 16_000_000) return;
  const off = createCanvas(bw, bh), octx = off.getContext("2d"), img = octx.createImageData(bw, bh), px = img.data;
  const set = (x: number, y: number, c: [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= bw || y >= bh) return;
    const i = (y * bw + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  };
  const stamp = (cx: number, cy: number, s: number, c: [number, number, number]): void => {
    const x = Math.round(cx) - ox - Math.floor(s / 2), y = Math.round(cy) - oy - Math.floor(s / 2);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) set(x + dx, y + dy, c);
  };
  const disc = (cx: number, cy: number, r: number, c: [number, number, number], ring: number): void => {
    const R = Math.max(1, Math.round(r)), X = Math.round(cx) - ox, Y = Math.round(cy) - oy;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= R * R + R * 0.6 && (ring <= 0 || d2 > (R - ring) * (R - ring))) set(X + dx, Y + dy, c);
    }
  };
  const tipRgb = rgb(accent);
  for (const { b, colour } of figs) {
    const c = rgb(colour), tip = accent === colour ? c : tipRgb;
    for (const [a, e] of b.segs) {
      const n = Math.max(1, Math.ceil(Math.hypot(e[0] - a[0], e[1] - a[1])));
      for (let i = 0; i <= n; i++) stamp(a[0] + ((e[0] - a[0]) * i) / n, a[1] + ((e[1] - a[1]) * i) / n, brush, c);
    }
    disc(b.head[0], b.head[1], Math.max(2, b.headR), style === "joints" ? tip : c, style === "outline" ? Math.max(1, Math.round(brush * 0.8)) : 0);
    if (style === "joints") for (const h of [...b.hands, ...b.feet]) disc(h[0], h[1], Math.max(1, brush * 0.9), tip, 0);
  }
  octx.putImageData(img, 0, 0);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  (ctx as unknown as { drawImage: (img: unknown, x: number, y: number) => void }).drawImage(off, ox, oy);
  ctx.imageSmoothingEnabled = smoothing;
}

/** The speech bubble (R4): one label, cut to 40, in a bg box with an outline and a tail, kept inside the frame. */
export function drawStickBubble(ctx: CanvasRenderingContext2D, b: Bones, size: number, text: string, colours: StickColours, outline: string, setFont: (px: number) => void, W: number, pixel: boolean): void {
  const label = text.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!label) return;
  const fs = Math.max(10, Math.round(0.09 * size)), pad = Math.round(fs * 0.45), lw = Math.max(1, Math.round(fs / 12));
  setFont(fs); ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const tw = Math.ceil(ctx.measureText(label).width), bw = tw + pad * 2, bh = fs + pad * 2;
  const headTop = b.head[1] - b.headR, tailH = Math.round(fs * 0.6);
  let bx = Math.round(b.head[0] - bw / 2), by = Math.round(headTop - tailH - bh - fs * 0.2);
  bx = Math.max(lw, Math.min(W - bw - lw, bx));
  const r = pixel ? 0 : Math.round(fs * 0.4);
  const box = (): void => {
    ctx.beginPath();
    ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); if (r) ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
    ctx.lineTo(bx + bw, by + bh - r); if (r) ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
    const tx = Math.max(bx + r + tailH, Math.min(bx + bw - r - tailH, Math.round(b.head[0])));
    ctx.lineTo(tx + tailH * 0.5, by + bh); ctx.lineTo(Math.round(b.head[0]), by + bh + tailH); ctx.lineTo(tx - tailH * 0.5, by + bh);
    ctx.lineTo(bx + r, by + bh); if (r) ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
    ctx.lineTo(bx, by + r); if (r) ctx.arcTo(bx, by, bx + r, by, r);
    ctx.closePath();
  };
  ctx.fillStyle = colours.bg; box(); ctx.fill();
  ctx.strokeStyle = outline; ctx.lineWidth = lw; box(); ctx.stroke();
  ctx.fillStyle = colours.fg; ctx.fillText(label, bx + pad, by + bh / 2);
  ctx.textBaseline = "alphabetic";
}
