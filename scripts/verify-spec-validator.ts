/**
 * Offline test for the AI Mode spec validator (ADR 0015 / issue #36). Proves the
 * safety layer accepts well-formed specs and rejects/repairs malformed or unsafe
 * LLM output — no Ollama required. Exits non-zero on any failure.
 *
 * Run: npx tsx scripts/verify-spec-validator.ts
 */
import { validateAnimSpec } from "../src/specValidator";
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
