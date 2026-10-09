/**
 * `npm run vocab:record -- "<summary>"` — record the current vocabulary and
 * refresh VOCABULARY.md. No clock, no randomness. An entry, once written, is
 * never rewritten; a raised version with an unchanged vocabulary is refused.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRIMITIVES, VOCABULARY_VERSION } from "../src/primitives/registry";
import { snapshot, snapshotHash, renderVocabularyDoc, type VocabularyRecord } from "./lib/vocabularyRules";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordPath = path.join(root, "golden", "vocabulary.json");
const docPath = path.join(root, "VOCABULARY.md");

const summary = process.argv[2]?.trim();

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function readRecord(): VocabularyRecord | null {
  if (!fs.existsSync(recordPath)) return null;
  return JSON.parse(fs.readFileSync(recordPath, "utf8")) as VocabularyRecord;
}

function writeDoc(rec: VocabularyRecord): void {
  fs.writeFileSync(docPath, renderVocabularyDoc(rec, PRIMITIVES));
}

function writeRecord(rec: VocabularyRecord): void {
  fs.writeFileSync(recordPath, JSON.stringify(rec, null, 2) + "\n");
  writeDoc(rec);
}

const record = readRecord();
const version = VOCABULARY_VERSION;
const snap = snapshot(PRIMITIVES);
const hash = snapshotHash(snap);

if (!record) {
  if (version !== 1) fail(`no record for version ${version}; run npm run vocab:record -- "<summary>"`);
  if (!summary) fail('a one-line summary is required: npm run vocab:record -- "<summary>"');
  writeRecord({ versions: [{ version: 1, hash, summary }], current: { version: 1, primitives: snap } });
  console.log(`recorded vocabulary version 1`);
  process.exit(0);
}

const last = record.versions[record.versions.length - 1];

if (version === last.version) {
  if (last.hash === hash) {
    writeDoc(record);
    console.log(`vocabulary unchanged at version ${version}; VOCABULARY.md refreshed`);
    process.exit(0);
  }
  fail(`version ${version} is already recorded with a different vocabulary; raise VOCABULARY_VERSION`);
}

if (version > last.version + 1) {
  fail(`version ${version} is more than one above the last recorded version ${last.version}`);
}

if (last.hash === hash) {
  fail(`vocabulary has not changed since version ${last.version}; do not raise the version`);
}
if (!summary) fail('a one-line summary is required: npm run vocab:record -- "<summary>"');

writeRecord({
  versions: [...record.versions, { version, hash, summary }],
  current: { version, primitives: snap },
});
console.log(`recorded vocabulary version ${version}`);
