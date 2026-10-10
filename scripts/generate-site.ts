/**
 * `npm run site:generate` — regenerate every generated site file under
 * `docs/`: the gallery page from the registry, copied thumbnails, loops and
 * fonts, and front-mattered copies of the two root documents. `--check`
 * (`npm run site:check`) regenerates in memory, compares against the
 * committed files and exits 1 on any difference, the same discipline as
 * `fonts:generate --check`. No clock, no randomness, no network. Run from
 * the repository root, like every generator here.
 */
import fs from "node:fs";
import path from "node:path";
import { PRIMITIVES, VOCABULARY_VERSION } from "../src/primitives/registry.js";

const CHECK = process.argv.includes("--check");

type ByteSource = string | Buffer;

/** Every generated output, as a map from its path to its exact bytes. */
function buildOutputs(): Map<string, ByteSource> {
  const files = new Map<string, ByteSource>();
  const read = (p: string): Buffer => fs.readFileSync(p);

  // The gallery page: one card per primitive, registry order, nothing hand-maintained.
  files.set(path.join("docs", "gallery.md"), galleryPage());

  for (const p of PRIMITIVES) {
    const png = path.join("gallery", `${p.type}.png`);
    const gif = path.join("loops", `${p.type}.gif`);
    if (!fs.existsSync(png)) {
      throw new Error(`missing thumbnail ${png}: run npm run gallery:generate`);
    }
    if (!fs.existsSync(gif)) {
      throw new Error(`missing loop ${gif}: run npm run loops:generate`);
    }
    files.set(path.join("docs", "public", "gallery", `${p.type}.png`), read(png));
    files.set(path.join("docs", "public", "loops", `${p.type}.gif`), read(gif));
  }

  // The shipped fonts and their licence texts, so the site never loads a
  // font from another origin (FR-008).
  fs.mkdirSync(path.join("docs", "public", "fonts"), { recursive: true });
  for (const name of fs.readdirSync(path.join("assets", "fonts"))) {
    if (name.endsWith(".ttf") || name.startsWith("LICENSE")) {
      files.set(
        path.join("docs", "public", "fonts", name),
        read(path.join("assets", "fonts", name)),
      );
    }
  }

  // The two root documents, copied with fixed front matter. The root files
  // stay canonical; these copies are as disposable as the thumbnails.
  files.set(
    path.join("docs", "vocabulary.md"),
    withTitle("Vocabulary", read(path.join("VOCABULARY.md"))),
  );
  files.set(
    path.join("docs", "contributing.md"),
    withTitle("Contributing", read(path.join("CONTRIBUTING.md"))),
  );

  return files;
}

function withTitle(title: string, source: Buffer): string {
  return `---\ntitle: ${title}\n---\n\n${source.toString("utf8")}`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function galleryPage(): string {
  const cards = PRIMITIVES.map((p) => {
    const replacement =
      p.tier === "legacy" && p.replacedBy
        ? ` · replaced by <code>${escapeHtml(p.replacedBy)}</code>`
        : "";
    const description = escapeHtml(p.description);
    return [
      `  <figure class="card">`,
      `    <img src="/loops/${p.type}.gif" alt="${p.type}: ${description}" loading="lazy">`,
      `    <figcaption>`,
      `      <h3>${escapeHtml(p.type)}<span class="tier">${escapeHtml(p.tier)}</span></h3>`,
      `      <p>${description}</p>`,
      `      <p class="meta">${escapeHtml(p.category)}${replacement} · <a href="https://github.com/tosin2013/animspec/blob/main/src/primitives/registry.ts">source</a></p>`,
      `    </figcaption>`,
      `  </figure>`,
    ].join("\n");
  }).join("\n");

  return `---
title: Gallery
---

One card per primitive, every frame drawn by the committed library from the
same fixed seed while the signal sweeps quiet to loud and back. The
[vocabulary page](/vocabulary) carries the full param tables: each card here
is a picture and a name, the vocabulary is the reference.

Vocabulary version ${VOCABULARY_VERSION} · ${PRIMITIVES.length} primitives ·
rendered with \`npm run loops:generate\`

<div class="cards">
${cards}
</div>
`;
}

/** Files present under an output directory that the generator does not emit. */
function unexpectedFiles(dir: string, expected: Set<string>): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!expected.has(name)) found.push(path.join(dir, name));
  }
  return found;
}

const outputs = buildOutputs();
const problems: string[] = [];

if (CHECK) {
  for (const [file, content] of outputs) {
    if (!fs.existsSync(file)) {
      problems.push(`missing: ${file}`);
      continue;
    }
    const committed = fs.readFileSync(file);
    const same =
      typeof content === "string"
        ? committed.equals(Buffer.from(content, "utf8"))
        : committed.equals(content);
    if (!same) problems.push(`stale or hand-edited: ${file}`);
  }
  const unexpected = [
    ...unexpectedFiles(
      path.join("docs", "public", "gallery"),
      new Set(PRIMITIVES.map((p) => `${p.type}.png`)),
    ),
    ...unexpectedFiles(
      path.join("docs", "public", "loops"),
      new Set(PRIMITIVES.map((p) => `${p.type}.gif`)),
    ),
  ];
  problems.push(...unexpected.map((f) => `unexpected: ${f}`));

  if (problems.length > 0) {
    console.error(`site:check FAILED (${problems.length} problem(s))`);
    for (const p of problems) console.error(`  ${p}`);
    console.error("run: npm run loops:generate && npm run site:generate");
    process.exit(1);
  }
  console.log(`site:check passed (${outputs.size} generated files fresh)`);
} else {
  for (const [file, content] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  const unexpected = [
    ...unexpectedFiles(
      path.join("docs", "public", "gallery"),
      new Set(PRIMITIVES.map((p) => `${p.type}.png`)),
    ),
    ...unexpectedFiles(
      path.join("docs", "public", "loops"),
      new Set(PRIMITIVES.map((p) => `${p.type}.gif`)),
    ),
  ];
  for (const f of unexpected) console.log(`site: unexpected file left in place: ${f}`);
  console.log(`site: wrote ${outputs.size} generated files under docs/`);
}