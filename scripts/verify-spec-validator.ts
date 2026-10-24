/**
 * Offline test for the AI Mode spec validator (ADR 0015 / issue #36). Proves the
 * safety layer accepts well-formed specs and rejects/repairs malformed or unsafe
 * LLM output — no Ollama required. Exits non-zero on any failure.
 *
 * Run: npx tsx scripts/verify-spec-validator.ts
 */
import { validateAnimSpec, ANIMSPEC_JSON_SCHEMA } from "../src/specValidator";
import { VOCABULARY_VERSION } from "../src/primitives/registry";

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
check("the reserved letter b is reported", reported(gridOf({ pattern: "#b#" }), 'grid pattern: letter "b" is reserved; read as off'));
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

if (failures > 0) {
  console.error(`\nspec validator FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nspec validator passed");
