/**
 * Offline test for the AI Mode spec validator (ADR 0015 / issue #36). Proves the
 * safety layer accepts well-formed specs and rejects/repairs malformed or unsafe
 * LLM output — no Ollama required. Exits non-zero on any failure.
 *
 * Run: npx tsx scripts/verify-spec-validator.ts
 */
import { validateAnimSpec, ANIMSPEC_JSON_SCHEMA } from "../src/specValidator";
import { VOCABULARY_VERSION } from "../src/primitives/registry";
import { registerPlugin } from "../src/plugins";
import { GOOD } from "./fixtures/plugins/index";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

console.log("spec validator (ADR 0015)");

// 1. A well-formed spec is accepted and preserved.
const good = validateAnimSpec({
  background: "black",
  accent: "#ff2d2d",
  layers: [{ type: "grid", cols: 32, rows: 18, threshold: 0.15, gridlines: true }, { type: "wave", amp: 0.5 }],
});
check("accepts a valid spec", good.valid && good.spec?.layers.length === 2);
check("keeps a valid accent", good.spec !== undefined && (good.spec as any).accent === "#ff2d2d");

// 2. Unknown / disallowed layers are dropped; image is NOT allowed.
const withImage = validateAnimSpec({ layers: [{ type: "image", src: "/etc/passwd" }, { type: "bars" }] });
check("drops the image layer", withImage.valid && withImage.spec?.layers.length === 1 && (withImage.spec as any).layers[0].type === "bars");

const allUnknown = validateAnimSpec({ layers: [{ type: "evil" }, { type: "nope" }] });
check("rejects a spec with no valid layers", !allUnknown.valid);

// 3. Out-of-range numeric params are clamped to safe values.
const clamped = validateAnimSpec({ layers: [{ type: "particles", count: 999999 }, { type: "grid", cols: -5, rows: 100000 }] });
const pc = (clamped.spec as any)?.layers?.[0];
const gr = (clamped.spec as any)?.layers?.[1];
check("clamps particle count", clamped.valid && pc.count <= 500 && pc.count >= 1);
check("clamps grid dims", clamped.valid && gr.cols >= 2 && gr.rows <= 200);

// 4. A bad accent is dropped but the spec stays valid.
const badAccent = validateAnimSpec({ accent: "red; drop table", layers: [{ type: "scan" }] });
check("drops an invalid accent, keeps spec", badAccent.valid && !(badAccent.spec as any).accent);

// 5. Font choice: known keys kept, anything else dropped with a message.
for (const key of ["dejavu", "jetbrains", "plex"]) {
  const r = validateAnimSpec({ font: key, layers: [{ type: "caption" }] });
  check(`keeps font ${key}`, r.valid && (r.spec as any).font === key);
}
const badFont = validateAnimSpec({ font: "comic-sans", layers: [{ type: "caption" }] });
check(
  "drops an unknown font with a message, keeps spec",
  badFont.valid && !(badFont.spec as any).font && badFont.errors.includes("font dropped (not a shipped font)"),
);
const nonStringFont = validateAnimSpec({ font: 42, layers: [{ type: "caption" }] });
check(
  "drops a non-string font the same way",
  nonStringFont.valid && !(nonStringFont.spec as any).font && nonStringFont.errors.includes("font dropped (not a shipped font)"),
);
const noFont = validateAnimSpec({ layers: [{ type: "caption" }] });
check("a spec with no font has none after validation", noFont.valid && !("font" in (noFont.spec as any)));
// Names every object inherits must not pass as fonts: they are not shipped fonts.
for (const inherited of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
  const r = validateAnimSpec(JSON.parse(`{"font": ${JSON.stringify(inherited)}, "layers": [{"type": "caption"}]}`));
  check(
    `drops the inherited property name ${inherited} as a font`,
    r.valid && !Object.hasOwn(r.spec as object, "font") && r.errors.includes("font dropped (not a shipped font)"),
  );
}

// 6. Vocabulary version: recorded on every spec; known kept; newer/invalid repaired.
const noVocab = validateAnimSpec({ layers: [{ type: "caption" }] });
check(
  "no vocabulary is stamped with the current version",
  noVocab.valid && (noVocab.spec as any).vocabulary === VOCABULARY_VERSION && !noVocab.errors.some((e) => e.includes("vocabulary")),
);
const knownVocab = validateAnimSpec({ vocabulary: 1, layers: [{ type: "caption" }] });
check(
  "a known vocabulary is kept",
  knownVocab.valid && (knownVocab.spec as any).vocabulary === 1 && !knownVocab.errors.some((e) => e.includes("vocabulary")),
);
const newerVocab = validateAnimSpec({ vocabulary: VOCABULARY_VERSION + 1, layers: [{ type: "caption" }] });
check(
  "a newer vocabulary is replaced with the current version and reported",
  newerVocab.valid &&
    (newerVocab.spec as any).vocabulary === VOCABULARY_VERSION &&
    newerVocab.errors.includes(`vocabulary ${VOCABULARY_VERSION + 1} is newer than this library (${VOCABULARY_VERSION}); recorded as ${VOCABULARY_VERSION}`),
);
for (const bad of ["1", 1.5, 0, -1, null, true, {}]) {
  const r = validateAnimSpec({ vocabulary: bad, layers: [{ type: "caption" }] });
  check(
    `drops an invalid vocabulary (${JSON.stringify(bad)})`,
    r.valid && (r.spec as any).vocabulary === VOCABULARY_VERSION && r.errors.includes("vocabulary dropped (not a valid version)"),
  );
}
const twice = validateAnimSpec(noVocab.spec);
check(
  "a validated spec keeps its version on re-validation",
  twice.valid && (twice.spec as any).vocabulary === VOCABULARY_VERSION && !twice.errors.some((e) => e.includes("vocabulary")),
);
check("a valid spec records an integer vocabulary", good.spec !== undefined && Number.isInteger((good.spec as any).vocabulary));

// 7. Malformed inputs are rejected outright.
check("rejects non-object", !validateAnimSpec("not a spec").valid);
check("rejects missing layers", !validateAnimSpec({ background: "black" }).valid);
check("rejects empty layers array", !validateAnimSpec({ layers: [] }).valid);

// 8. Per-layer signal binds (spec 013).
const bound = validateAnimSpec({
  layers: [{
    type: "rig",
    bind: {
      mouthOpen: { from: "amplitude", out: [0, 1] },
      eyeOpen: { from: "osc", wave: "pulse", period: 4.2, duty: 0.05, out: [1, 0] },
    },
  }],
});
const boundLayer = (bound.spec as any)?.layers?.[0];
check("accepts a well-formed bind map", bound.valid && boundLayer?.bind?.mouthOpen?.from === "amplitude" && boundLayer?.bind?.eyeOpen?.period === 4.2);
check("a valid bind raises no errors", bound.valid && bound.errors.length === 0);

const badTarget = validateAnimSpec({ layers: [{ type: "rig", bind: { pose: { from: "amplitude" } } }] });
check(
  "rejects a bind to a non-numeric param",
  badTarget.errors.some((e) => e.includes("not numeric")) && (badTarget.spec as any).layers[0].bind === undefined,
);
const unknownParam = validateAnimSpec({ layers: [{ type: "rig", bind: { nope: { from: "amplitude" } } }] });
check("rejects a bind to an unknown param", unknownParam.errors.some((e) => e.includes("not a param")));
const badFrom = validateAnimSpec({ layers: [{ type: "rig", bind: { mouthOpen: { from: "label:0" } } }] });
check("rejects a deferred source (label:<n>)", badFrom.errors.some((e) => e.includes("unknown from")));
const badRange = validateAnimSpec({ layers: [{ type: "rig", bind: { mouthOpen: { from: "amplitude", in: [1, 0] } } }] });
check("rejects a reversed in range", badRange.errors.some((e) => e.includes("malformed in range")));
const badDuty = validateAnimSpec({ layers: [{ type: "rig", bind: { mouthOpen: { from: "osc", period: 4.2, duty: 2 } } }] });
check("rejects a duty outside 0..1", badDuty.errors.some((e) => e.includes("duty outside 0..1")));
const noPeriod = validateAnimSpec({ layers: [{ type: "rig", bind: { mouthOpen: { from: "osc" } } }] });
check("rejects osc without a period", noPeriod.errors.some((e) => e.includes("period")));
const oscExtras = validateAnimSpec({ layers: [{ type: "grid", bind: { cols: { from: "amplitude", wave: "pulse", period: 2 } } }] });
check("rejects osc-only fields on a non-osc source", oscExtras.errors.some((e) => e.includes("osc-only fields")));
check("a malformed bind keeps the layer", badDuty.valid && (badDuty.spec as any).layers[0].type === "rig" && (badDuty.spec as any).layers[0].mouthOpen === 0);

// 9. Camera (spec 014).
const camGood = validateAnimSpec({
  layers: [{ type: "grid" }],
  camera: { move: "push", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 240, zoom: 1.25, x: 0.55, y: 0.45 }, ease: "smooth" },
});
check("accepts a valid camera", camGood.valid && (camGood.spec as any).camera?.move === "push" && (camGood.spec as any).camera?.to?.zoom === 1.25);
const camStatic = validateAnimSpec({ layers: [{ type: "grid" }], camera: { move: "static", from: { frame: 0, zoom: 1.2, x: 0.4, y: 0.6 } } });
check("accepts a static camera without a to", camStatic.valid && (camStatic.spec as any).camera?.from?.zoom === 1.2);
const camNoTo = validateAnimSpec({ layers: [{ type: "grid" }], camera: { move: "push", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 } } });
check("rejects a non-static move without a to", camNoTo.errors.some((e) => e.includes("needs a to keyframe")) && !(camNoTo.spec as any).camera);
const camBadMove = validateAnimSpec({ layers: [{ type: "grid" }], camera: { move: "tilt", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 10, zoom: 1, x: 0.5, y: 0.5 } } });
check("rejects an unknown move", camBadMove.errors.some((e) => e.includes("unknown move")));
const camZoom0 = validateAnimSpec({ layers: [{ type: "grid" }], camera: { move: "zoom", from: { frame: 0, zoom: 0, x: 0.5, y: 0.5 }, to: { frame: 10, zoom: 1, x: 0.5, y: 0.5 } } });
check("rejects a non-positive zoom", camZoom0.errors.some((e) => e.includes("malformed from keyframe")));
const camFrames = validateAnimSpec({ layers: [{ type: "grid" }], camera: { move: "pan", from: { frame: 10, zoom: 1, x: 0.5, y: 0.5 }, to: { frame: 5, zoom: 1, x: 0.5, y: 0.5 } } });
check("rejects to.frame <= from.frame", camFrames.errors.some((e) => e.includes("to.frame must be after")));
const camDepth = validateAnimSpec({ layers: [{ type: "grid", depth: 7 }] });
check("clamps depth to 1", camDepth.valid && (camDepth.spec as any).layers[0].depth === 1);
const camDepthNonNum = validateAnimSpec({ layers: [{ type: "grid", depth: "deep" }] });
check("non-numeric depth defaults to 1", camDepthNonNum.valid && (camDepthNonNum.spec as any).layers[0].depth === 1);

// Camera shake and range (spec 016).
const shakeCam = (shake: unknown, x = 0.5) => validateAnimSpec({ layers: [{ type: "grid" }], camera: { move: "static", from: { frame: 0, zoom: 1, x, y: 0.5 }, shake } });
const shakeOk = shakeCam({ amp: 0.02, freq: 4 });
check("accepts a valid shake", shakeOk.valid && (shakeOk.spec as any).camera?.shake?.amp === 0.02 && (shakeOk.spec as any).camera?.shake?.freq === 4);
check("clamps shake amp to 0.05", (shakeCam({ amp: 0.2, freq: 4 }).spec as any).camera?.shake?.amp === 0.05);
check("clamps shake freq to 5", (shakeCam({ amp: 0.01, freq: 40 }).spec as any).camera?.shake?.freq === 5);
check("shake freq defaults to 3", (shakeCam({ amp: 0.01 }).spec as any).camera?.shake?.freq === 3);
for (const [label, shake, msg] of [
  ["a non-object shake", 5, "camera shake dropped (must be an object)"],
  ["a shake without amp", {}, "camera shake dropped (amp must be a number)"],
  ["a non-number amp", { amp: "x" }, "camera shake dropped (amp must be a number)"],
  ["a freq of 0", { amp: 0.01, freq: 0 }, "camera shake dropped (freq must be a positive number)"],
] as const) {
  const r = shakeCam(shake);
  check(`drops ${label} and keeps the camera`, r.errors.includes(msg) && (r.spec as any).camera?.move === "static" && !(r.spec as any).camera?.shake);
}
check("keeps a camera x of 1.5", (shakeCam(undefined, 1.5).spec as any).camera?.from?.x === 1.5);
check("clamps a camera x of 3 to 2", (shakeCam(undefined, 3).spec as any).camera?.from?.x === 2);
const camYLow = validateAnimSpec({ layers: [{ type: "grid" }], camera: { move: "static", from: { frame: 0, zoom: 1, x: 0.5, y: -2 } } });
check("clamps a camera y of -2 to -1", (camYLow.spec as any).camera?.from?.y === -1);
check("leaves a camera x of 0.7 unchanged", (shakeCam(undefined, 0.7).spec as any).camera?.from?.x === 0.7);

// Transparent background and ink (spec 017).
const bgOf = (extra: Record<string, unknown>) => validateAnimSpec({ layers: [{ type: "grid" }], ...extra });
const clearBg = bgOf({ background: "transparent" });
check("keeps a transparent background", (clearBg.spec as any).background === "transparent" && !(clearBg.spec as any).ink);
check("an unknown background falls back to black", (bgOf({ background: "purple" }).spec as any).background === "black");
check("keeps dark ink on a transparent background", (bgOf({ background: "transparent", ink: "dark" }).spec as any).ink === "dark");
const badInk = bgOf({ background: "transparent", ink: "sepia" });
check("an unknown ink becomes light and is reported", (badInk.spec as any).ink === "light" && badInk.errors.includes("ink must be light or dark; using light"));
const solidInk = bgOf({ background: "white", ink: "dark" });
check("ink on a solid background is dropped and reported", (solidInk.spec as any).background === "white" && !(solidInk.spec as any).ink && solidInk.errors.includes("ink dropped (only applies to a transparent background)"));
const schemaProps = (ANIMSPEC_JSON_SCHEMA as any).properties;
check("the schema lists transparent and ink", schemaProps.background.enum.includes("transparent") && schemaProps.ink.enum.join() === "light,dark");

// Designed grid patterns (spec 018): problems are reported, the layer always renders.
const QUILT = "##.a.##/#.....#/..###../#.....#/##.a.##";
const gridOf = (extra: Record<string, unknown>, type = "grid") => validateAnimSpec({ layers: [{ type, ...extra }] });
const reported = (r: ReturnType<typeof validateAnimSpec>, text: string) => r.errors.some((e) => e.includes(text)) && (r.spec as any)?.layers?.length === 1;
const quiltOk = gridOf({ pattern: QUILT });
check("a valid quilt pattern reports nothing", quiltOk.errors.length === 0 && (quiltOk.spec as any).layers[0].pattern === QUILT);
check("an unknown pattern letter is reported", reported(gridOf({ pattern: "#x#" }), 'grid pattern: unknown letter "x" read as off'));
check("a pattern with b reports nothing", gridOf({ pattern: "#b#" }).errors.length === 0);
check("a checker pattern with b reports nothing", gridOf({ pattern: "#b" }, "checker").errors.length === 0);
check("short pattern rows are reported", reported(gridOf({ pattern: "###/#" }), "grid pattern: rows padded to 3 columns"));
check("an oversized pattern is reported", reported(gridOf({ pattern: "#".repeat(70) }), "grid pattern: cut to 64 × 64"));
check("checker pattern problems are reported", reported(gridOf({ pattern: "#?" }, "checker"), 'checker pattern: unknown letter "?" read as off'));
check("a valid break reports nothing", gridOf({ pattern: QUILT, breaks: "3,2 r15" }).errors.length === 0);
check("a malformed break is reported", reported(gridOf({ pattern: QUILT, breaks: "3,2 spin" }), 'grid breaks: entry "3,2 spin" dropped (malformed)'));
const many = Array.from({ length: 17 }, (_, i) => `${i % 7},${i % 5} r1`).join("; ");
check("breaks beyond 16 are reported", reported(gridOf({ pattern: QUILT, breaks: many }), "grid breaks: 1 entries dropped (at most 16)"));
check("a break outside the grid is reported", reported(gridOf({ pattern: QUILT, breaks: "40,2 r10" }), "grid breaks: cell 40,2 is outside the grid; ignored"));
check("an out-of-bound break value is clamped, not reported", gridOf({ pattern: QUILT, breaks: "1,1 r90" }).errors.length === 0);
check("checker breaks outside the board are not reported", gridOf({ breaks: "99,99 r10" }, "checker").errors.length === 0);
check("a model-style spec validates", gridOf({ pattern: " ##.a.## / #.....# /..###../#.....#/##.a.##", breaks: " 3,2  r15 ;  0,4 dx0.25 ; " }).errors.length === 0);

// 10. viseme/beat bind sources (spec 015).
const visemeBind = validateAnimSpec({ layers: [{ type: "rig", bind: { mouthOpen: { from: "viseme", in: [0, 14], out: [0.15, 1] } } }] });
check("accepts a viseme bind", visemeBind.valid && (visemeBind.spec as any).layers[0].bind.mouthOpen.from === "viseme");
const beatBind = validateAnimSpec({ layers: [{ type: "emitter", bind: { burst: { from: "beat" } } }] });
check("accepts a beat bind", beatBind.valid && (beatBind.spec as any).layers[0].bind.burst.from === "beat");
const visemeBadShape = validateAnimSpec({ layers: [{ type: "rig", bind: { mouthOpen: { from: "viseme", wave: "pulse", period: 2 } } }] });
check("rejects osc-only fields on a viseme bind", visemeBadShape.errors.some((e) => e.includes("osc-only fields")));

// 11. Palette roles (spec 020): bad entries dropped and reported, the rest kept.
const rolesOf = (roles: unknown) => validateAnimSpec({ roles, layers: [{ type: "sprite", character: "hero" }] });
const cleanRoles = { outline: "#201010", hair: "#8a4a20", "hair-light": "#d08850", skin: "#f0c8a0", eyes: "#1e6b3a", gold: "#e0b030", cloak: "#2d4a8c", "cloak-shade": "#1a2c55", tunic: "#a02828", boots: "#5a3418" };
const clean = rolesOf(cleanRoles);
check("a clean roles map reports nothing and is kept", clean.errors.length === 0 && JSON.stringify((clean.spec as any).roles) === JSON.stringify(Object.fromEntries(Object.entries(cleanRoles).sort(([a], [b]) => (a < b ? -1 : 1)))));
const notObject = rolesOf(5);
check("a non-object roles is dropped and reported", notObject.errors.includes("roles dropped (not an object)") && !("roles" in (notObject.spec as any)));
check("an invalid role name is reported", rolesOf({ Hair: "#ffffff", skin: "#f0c8a0" }).errors.includes("roles: Hair dropped (invalid name)"));
const badHex = rolesOf({ hair: "red", skin: "#f0c8a0" });
check("an invalid role colour is reported and the rest kept", badHex.errors.includes("roles: hair dropped (not a valid hex color)") && JSON.stringify((badHex.spec as any).roles) === '{"skin":"#f0c8a0"}');
check("a role shadowing a built-in is reported", rolesOf({ fg: "#ffffff" }).errors.includes("roles: fg dropped (shadows a built-in role)"));
const seventeen = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`r${String(i).padStart(2, "0")}`, "#123456"]));
const tooMany = rolesOf(seventeen);
check("roles beyond 16 are dropped by sorted name and reported", tooMany.errors.length === 1 && tooMany.errors[0] === "roles: r16 dropped (more than 16 roles)" && Object.keys((tooMany.spec as any).roles).length === 16);
const reversed = Object.fromEntries(Object.entries(seventeen).reverse());
check("role key order does not change the result", JSON.stringify(rolesOf(reversed)) === JSON.stringify(tooMany));
check("a spec without roles has no roles field", !("roles" in (validateAnimSpec({ layers: [{ type: "grid" }] }).spec as any)));

// 12. Dither colors and pixelAspect (spec 021).
const ditherOf = (colors: string) => validateAnimSpec({ layers: [{ type: "dither", colors }] });
check("a clean dither reports nothing", ditherOf("bg,sky-1,accent,fg").errors.length === 0);
check("an empty dither colors is reported", ditherOf(" , ").errors.includes("dither colors: empty; nothing drawn"));
check("dither colors beyond 6 are reported", ditherOf("a1,a2,a3,a4,a5,a6,a7").errors.includes("dither colors: only the first 6 are used"));
check("a bad dither role name is reported", ditherOf("bg,Sky").errors.includes('dither colors: "Sky" is not a role name; drawn as its grey'));
const aspectOf = (v: unknown) => validateAnimSpec({ pixelAspect: v, layers: [{ type: "grid" }] });
check("a valid pixelAspect is kept", (aspectOf(1.2).spec as any).pixelAspect === 1.2 && aspectOf(1.2).errors.length === 0);
check("an out-of-range pixelAspect is dropped and reported", !("pixelAspect" in (aspectOf(3).spec as any)) && aspectOf(3).errors.includes("pixelAspect dropped (must be a number from 0.5 to 2)"));
check("a non-number pixelAspect is dropped and reported", aspectOf("x").errors.includes("pixelAspect dropped (must be a number from 0.5 to 2)"));

// 13. Image assets (spec 022).
const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const imgSpec = (assets: unknown, asset = "pic") => validateAnimSpec({ assets, layers: [{ type: "grid" }, { type: "image", asset }] });
const okImg = imgSpec({ pic: { sha256: SHA, width: 16, height: 8 } });
check("a declared asset and its image layer validate cleanly", okImg.errors.length === 0 && (okImg.spec as any).layers.length === 2 && (okImg.spec as any).assets.pic.width === 16);
check("a non-object assets is dropped and reported", imgSpec(5).errors.includes("assets dropped (not an object)"));
check("an asset with a bad sha256 is reported", imgSpec({ pic: { sha256: "xyz", width: 16, height: 8 } }).errors.includes("assets: pic dropped (sha256 must be 64 lowercase hex characters)"));
check("an asset with a bad size is reported", imgSpec({ pic: { sha256: SHA, width: 0, height: 8 } }).errors.includes("assets: pic dropped (width and height must be integers from 1 to 8192)"));
check("an asset with a bad id is reported", imgSpec({ Pic: { sha256: SHA, width: 1, height: 1 } }).errors.includes('assets: Pic dropped (invalid id: use lowercase letters, digits and "-", start with a letter, max 16)'));
const manyAssets = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`a${String(i).padStart(2, "0")}`, { sha256: SHA, width: 1, height: 1 }]));
check("assets beyond 32 are dropped by sorted id", imgSpec(manyAssets, "a00").errors.includes("assets: a32 dropped (more than 32 assets)") && Object.keys((imgSpec(manyAssets, "a00").spec as any).assets).length === 32);
check("asset key order does not matter", JSON.stringify(imgSpec(Object.fromEntries(Object.entries(manyAssets).reverse()), "a00")) === JSON.stringify(imgSpec(manyAssets, "a00")));
const undeclared = imgSpec({ pic: { sha256: SHA, width: 16, height: 8 } }, "nope");
check("an image naming an undeclared asset is dropped and reported", undeclared.errors.includes('image dropped (asset "nope" is not declared in assets)') && undeclared.dropped.includes("image") && (undeclared.spec as any).layers.length === 1);

// 14. Plugin layers (spec 024): declared, registered, version-matched, typed.
registerPlugin(GOOD);
const extSpec = (plugins: unknown, type = "ext:good/starfield") => validateAnimSpec({ ...(plugins !== undefined ? { plugins } : {}), layers: [{ type: "grid" }, { type, count: 999 }] });
const okExt = extSpec({ good: { version: "1.0.0" } });
check("a declared, registered plugin layer validates with clamped params", okExt.errors.length === 0 && (okExt.spec as any).layers[1].count === 400 && (okExt.spec as any).plugins.good.version === "1.0.0");
const undeclaredExt = extSpec(undefined);
check("an undeclared plugin layer is dropped and reported", undeclaredExt.errors.includes("ext:good/starfield dropped (plugin good is not declared in plugins)") && undeclaredExt.dropped.includes("ext:good/starfield"));
check("an unregistered plugin layer is dropped and reported", extSpec({ nope: { version: "1.0.0" } }, "ext:nope/x").errors.includes("ext:nope/x dropped (plugin nope is not registered)"));
check("a wrong plugin version is dropped and reported", extSpec({ good: { version: "9.9.9" } }).errors.includes("ext:good/starfield dropped (plugin good is version 1.0.0, spec wants 9.9.9)"));
check("an unknown plugin type is dropped and reported", extSpec({ good: { version: "1.0.0" } }, "ext:good/missing").errors.includes("ext:good/missing dropped (plugin good has no type missing)"));
check("a malformed plugins map is reported", validateAnimSpec({ plugins: { good: { version: 3 } }, layers: [{ type: "grid" }] }).errors.includes("plugins: good dropped (version must be a string of 1 to 64 characters)"));

// 15. Clip sequences (spec 025).
const seqOf = (sequence: unknown, extra: Record<string, unknown> = {}) => validateAnimSpec({ ...extra, sequence });
const three = [{ from: 0, to: 20, layers: [{ type: "grid" }] }, { from: 20, to: 40, layers: [{ type: "wave" }], transition: { type: "wipe", frames: 5 } }, { from: 45, to: 60, layers: [{ type: "rings" }] }];
const cleanSeq = seqOf(three);
check("a clean three-clip sequence validates", cleanSeq.valid && cleanSeq.errors.length === 0 && (cleanSeq.spec as any).sequence.length === 3 && (cleanSeq.spec as any).sequence[1].transition.direction === "right");
check("an overlapping clip is dropped and reported", seqOf([three[0], { from: 10, to: 30, layers: [{ type: "wave" }] }]).errors.includes("sequence[1]: dropped (overlaps or is out of order)"));
check("a bad clip range is dropped and reported", seqOf([{ from: 5, to: 5, layers: [{ type: "grid" }] }, three[0]]).errors.includes("sequence[0]: dropped (from and to must be integers with 0 ≤ from < to)"));
check("a clip with no valid layers is dropped and reported", seqOf([{ from: 0, to: 10, layers: [{ type: "nope" }] }, { from: 10, to: 20, layers: [{ type: "grid" }] }]).errors.includes("sequence[0]: dropped (no valid layers)"));
const tr = (i: number) => ({ type: "type-reveal", text: "L" + i });
const fourteen = validateAnimSpec({ layers: Array.from({ length: 14 }, (_, i) => tr(i)) });
check("layers beyond 12 are reported and listed as dropped (#155)", fourteen.errors.includes("layers: only the first 12 layers are used (14 given)") && fourteen.dropped.length === 2 && (fourteen.spec as any).layers.length === 12);
const fourteenClip = seqOf([{ from: 0, to: 2, layers: Array.from({ length: 14 }, (_, i) => tr(i)) }]);
check("a clip's layers beyond 12 are reported with its prefix", fourteenClip.errors.includes("sequence[0]: layers: only the first 12 layers are used (14 given)") && fourteenClip.dropped.length === 2);
check("exactly 12 layers report nothing", validateAnimSpec({ layers: Array.from({ length: 12 }, (_, i) => tr(i)) }).errors.length === 0);
check("clips beyond 64 are reported", seqOf(Array.from({ length: 65 }, (_, i) => ({ from: i, to: i + 1, layers: [{ type: "grid" }] }))).errors.includes("sequence: only the first 64 clips are used"));
const beside = seqOf(three, { layers: [{ type: "grid" }], camera: { move: "static", from: { frame: 0, zoom: 1, x: 0.5, y: 0.5 } } });
check("top-level layers and camera beside a sequence are ignored and reported", beside.errors.includes("layers ignored (the spec has a sequence)") && beside.errors.includes("camera ignored (the spec has a sequence)") && (beside.spec as any).layers.length === 0 && !("camera" in (beside.spec as any)));
check("a transition on the first clip is ignored and reported", seqOf([{ ...three[0], transition: { type: "fade", frames: 5 } }]).errors.includes("sequence[0]: transition ignored (first clip)"));
check("an over-long transition is clamped and reported", (() => { const v = seqOf([three[0], { from: 20, to: 30, layers: [{ type: "wave" }], transition: { type: "fade", frames: 50 } }]); return v.errors.includes("sequence[1]: transition frames clamped to 10") && (v.spec as any).sequence[1].transition.frames === 10; })());
check("a bad transition type is dropped and reported", seqOf([three[0], { from: 20, to: 30, layers: [{ type: "wave" }], transition: { type: "spin", frames: 5 } }]).errors.includes("sequence[1]: transition dropped (type must be cut, wipe, iris or fade)"));
const clipImg = seqOf([three[0], { from: 20, to: 30, layers: [{ type: "wave" }, { type: "image", asset: "ghost" }] }]);
check("clip layers keep the plugin and asset rules, prefixed", clipImg.errors.includes('sequence[1]: image dropped (asset "ghost" is not declared in assets)'));

// 16. type-reveal's wrap box (#156): reported when left/right rows can leave the frame.
const revealAt = (x: number, align: string) => validateAnimSpec({ layers: [{ type: "type-reveal", text: "KAIRO", x, align }] }).errors;
check("a left-aligned box past the left edge is reported", revealAt(0.05, "left").some((m) => m.startsWith("type-reveal: wrap box [-0.35, 0.45] leaves the frame")));
check("a right-aligned box past the right edge is reported", revealAt(0.95, "right").some((m) => m.startsWith("type-reveal: wrap box [0.55, 1.35] leaves the frame")));
check("a centred label near the edge is not reported", revealAt(0.05, "center").length === 0);
check("the default box inside the frame is not reported", revealAt(0.5, "left").length === 0);

if (failures > 0) {
  console.error(`\nspec validator FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nspec validator passed");
