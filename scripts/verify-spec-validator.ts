/**
 * Offline test for the AI Mode spec validator (ADR 0015 / issue #36). Proves the
 * safety layer accepts well-formed specs and rejects/repairs malformed or unsafe
 * LLM output — no Ollama required. Exits non-zero on any failure.
 *
 * Run: npx tsx scripts/verify-spec-validator.ts
 */
import { validateAnimSpec } from "../src/specValidator";

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

// 5. Malformed inputs are rejected outright.
check("rejects non-object", !validateAnimSpec("not a spec").valid);
check("rejects missing layers", !validateAnimSpec({ background: "black" }).valid);
check("rejects empty layers array", !validateAnimSpec({ layers: [] }).valid);

if (failures > 0) {
  console.error(`\nspec validator FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log("\nspec validator passed");
