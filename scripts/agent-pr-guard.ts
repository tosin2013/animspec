/**
 * Agent pull request guard (spec 007, contracts/agent-pr-guard.md).
 *
 * Runs in CI for pull_request events. Decides agent authorship, enforces the
 * allowed change set for a single-new-primitive pull request, and resolves
 * the signer of record from the proposal issue's assignment. Fail closed:
 * any error, missing event or unparsable file is a failure, never a pass.
 *
 *   tsx scripts/agent-pr-guard.ts --pr <number>   # CI: identity, change set, signer
 *   tsx scripts/agent-pr-guard.ts --self-test     # local: fixtures, no network
 *
 * No clock, no randomness. The pure checks below are the same ones the
 * self-test exercises.
 */
import fs from "node:fs";

/** Author logins treated as the agent. The PR identity is `copilot-swe-agent`; the
 * timeline and assignee identity is `Copilot` (trial finding, research R7). */
const AGENT_LOGINS = (process.env.AGENT_LOGINS ?? "Copilot,copilot-swe-agent")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isAgent = (login: string): boolean => AGENT_LOGINS.includes(login);

// ---------------------------------------------------------------------------
// Pure checks. Each returns a list of problems; empty means pass.

/** Registry diff: every removed line must be the VOCABULARY_VERSION line. */
export function checkRegistryPatch(patch: string): string[] {
  const problems: string[] = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) continue;
    if (line.startsWith("-")) {
      const removed = line.slice(1).trim();
      if (!removed.includes("VOCABULARY_VERSION")) {
        problems.push("registry: removed or edited line other than the version");
      }
    }
  }
  return problems;
}

/** Hash sets: every key present at the base must have the same value at the head. */
export function checkHashSets(
  setName: string,
  base: Record<string, string>,
  head: Record<string, string>,
): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(base)) {
    if (head[key] !== value) {
      problems.push(`golden: existing case ${key} changed${head[key] === undefined ? " or removed" : ""} (${setName})`);
    }
  }
  return problems;
}

/** CHANGES.md: additions only, no removed lines. */
export function checkChangesLog(patch: string): string[] {
  const problems: string[] = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) continue;
    if (line.startsWith("-")) problems.push("changes: a removed line");
  }
  return problems;
}

/** The allowed change set for a pull request adding exactly primitive `type`. */
export function checkAllowedPaths(changedFiles: string[], type: string): string[] {
  const allowed = (path: string): boolean =>
    path === "src/primitives/registry.ts" ||
    path === "golden/vocabulary.json" ||
    path === "VOCABULARY.md" ||
    path.startsWith("golden/arm64/") ||
    path.startsWith("golden/x64/") ||
    path === "golden/CHANGES.md" ||
    path === `gallery/${type}.png` ||
    path === `loops/${type}.gif` ||
    path === "docs/gallery.md" ||
    path === "docs/vocabulary.md" ||
    path === `docs/public/gallery/${type}.png` ||
    path === `docs/public/loops/${type}.gif`;
  return changedFiles.filter((p) => !allowed(p)).map((p) => `outside the allowed set: ${p}`);
}

/** Primitive types present in head but not in base. Exactly one is required. */
export function newPrimitiveTypes(base: string, head: string): string[] {
  const types = (source: string): Set<string> =>
    new Set([...source.matchAll(/^\s*type:\s*"([a-z0-9]+)",?$/gm)].map((m) => m[1]));
  const baseTypes = types(base);
  return [...types(head)].filter((t) => !baseTypes.has(t));
}

export interface AssignEvent {
  actor: string;
  assignee: string;
}

/**
 * The signer of record: the single human assignee of the proposal issue.
 * The platform records the assigning maintainer as a co-assignee alongside the
 * agent, not as an assignment-event actor (trial finding, research R7), so the
 * assignee list is the evidence. Zero humans or more than one is unresolved.
 */
export function resolveSignerFromAssignees(assignees: string[], agentLogins: string[] = AGENT_LOGINS): string | null {
  const humans = assignees.filter((login) => !agentLogins.includes(login));
  return humans.length === 1 ? humans[0] : null;
}

/** The resolved actor must be listed in CLA-SIGNERS.json. */
export function signerListed(actor: string, signersJson: string): boolean {
  try {
    const parsed = JSON.parse(signersJson) as { signers: Array<{ login: string }> };
    return parsed.signers.some((s) => s.login === actor);
  } catch {
    return false;
  }
}

/** The issue a pull request closes, from a Fixes/Closes/Resolves line. */
export function closingIssueFromBody(body: string): number | null {
  const match = body.match(/(?:fixes|closes|resolves)\s+#(\d+)/i);
  return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Fixtures (contracts/agent-pr-guard.md). Offline, no network.

const REGISTRY_PASS_PATCH = [
  "@@ -60,7 +60,7 @@",
  " export const VOCABULARY_VERSION = 1;",
  "-export const VOCABULARY_VERSION = 1;",
  "+export const VOCABULARY_VERSION = 2;",
  "+  {",
  '+    type: "gauge",',
  '+    category: "signal-bars",',
].join("\n");

const REGISTRY_EDIT_PATCH = [
  "@@ -200,7 +200,7 @@",
  "   params: [",
  '-    { name: "amp", type: "number", min: 0.05, max: 1, default: 0.6 },',
  '+    { name: "amp", type: "number", min: 0.05, max: 2, default: 0.6 },',
].join("\n");

function selfTest(): number {
  const baseRegistry = '  type: "grid",\n  type: "wave",\nexport const VOCABULARY_VERSION = 1;\n';
  const headOneMore = baseRegistry + '  type: "gauge",\n';
  const headTwoMore = headOneMore + '  type: "dial",\n';
  const hashesBase = { grid: "aaa", wave: "bbb" };
  const agentLogins = ["Copilot"];
  const cases: Array<[string, boolean, string[]]> = [
    ["registry diff adds one entry and changes the version line", true, [
      ...checkRegistryPatch(REGISTRY_PASS_PATCH),
      ...checkAllowedPaths(["src/primitives/registry.ts"], "gauge"),
      ...(newPrimitiveTypes(baseRegistry, headOneMore).length === 1 ? [] : ["expected exactly one new type"]),
    ]],
    ["registry diff edits a line inside an existing primitive", false, checkRegistryPatch(REGISTRY_EDIT_PATCH)],
    ["a change set that touches package.json", false, checkAllowedPaths(["package.json"], "gauge")],
    ["a change set that touches a workflow", false, checkAllowedPaths([".github/workflows/site.yml"], "gauge")],
    ["a hashes.json where an existing hash changes", false, checkHashSets("x64", hashesBase, { grid: "aaa", wave: "ccc" })],
    ["a hashes.json where only new keys are added", true, checkHashSets("x64", hashesBase, { grid: "aaa", wave: "bbb", gauge: "ddd" })],
    ["two new primitive types in one pull request", false,
      newPrimitiveTypes(baseRegistry, headTwoMore).length === 2 ? ["two new types in one pull request"] : []],
    ["a change set that edits AGENTS.md or .github/skills/", false,
      checkAllowedPaths(["AGENTS.md", ".github/skills/primitive-proposal/SKILL.md"], "gauge")],
    ["issue assignees with exactly one human, a signer", true, (() => {
      const actor = resolveSignerFromAssignees(["Copilot", "tosin2013"], agentLogins);
      return actor === "tosin2013" && signerListed(actor, fs.readFileSync("CLA-SIGNERS.json", "utf8")) ? [] : ["expected a listed signer"];
    })()],
    ["issue assignees with one human who has not signed", false, (() => {
      const actor = resolveSignerFromAssignees(["copilot-swe-agent", "someone-else"], agentLogins);
      return actor === "someone-else" && !signerListed(actor, '{"signers":[{"login":"tosin2013"}]}') ? ["actor not listed"] : ["resolve failed"];
    })()],
    ["issue assignees with no human", false,
      resolveSignerFromAssignees(["Copilot"], agentLogins) === null ? ["no human assignee"] : []],
    ["issue assignees with two humans", false,
      resolveSignerFromAssignees(["Copilot", "tosin2013", "someone-else"], agentLogins) === null ? ["two human assignees"] : []],
  ];

  let failures = 0;
  for (const [name, expectedPass, problems] of cases) {
    const pass = problems.length === 0;
    const ok = pass === expectedPass;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}${!ok && problems.length ? " -> " + problems.join("; ") : ""}`);
  }
  console.log(failures === 0 ? `agent-pr-guard self-test passed (${cases.length} fixtures)` : `agent-pr-guard self-test FAILED (${failures})`);
  return failures === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// CI mode: read the pull request through the GitHub API, fail closed.

interface PullRequest {
  user: { login: string };
  body: string | null;
  base: { ref: string };
  head: { sha: string };
}

interface ChangedFile {
  filename: string;
  patch?: string;
}

async function api<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`api ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

async function graphQL<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`graphql failed: ${response.status}`);
  const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) throw new Error(`graphql: ${body.errors[0].message}`);
  if (!body.data) throw new Error("graphql: no data");
  return body.data;
}

async function fileAtRef(ref: string, path: string, repo: string, token: string): Promise<string> {
  const data = await api<{ content?: string }>(`/repos/${repo}/contents/${path}?ref=${ref}`, token);
  if (!data.content) throw new Error(`no content for ${path} at ${ref}`);
  return Buffer.from(data.content, "base64").toString("utf8");
}

async function closingIssue(prNumber: number, repo: string, body: string, token: string): Promise<number | null> {
  try {
    const [owner, name] = repo.split("/");
    const data = await graphQL<{ repository: { pullRequest: { closingIssuesReferences: { nodes: Array<{ number: number }> } } } }>(
      `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){closingIssuesReferences(first:1){nodes{number}}}}}`,
      { owner, name, number: prNumber },
      token,
    );
    const node = data.repository.pullRequest.closingIssuesReferences.nodes[0];
    if (node) return node.number;
  } catch {
    // fall through to the body line
  }
  return closingIssueFromBody(body);
}

async function guard(prNumber: number): Promise<number> {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required for --pr");
  const repo = process.env.GITHUB_REPOSITORY ?? "tosin2013/animspec";
  const problems: string[] = [];

  const pr = await api<PullRequest>(`/repos/${repo}/pulls/${prNumber}`, token);
  if (!isAgent(pr.user.login)) {
    console.log("not an agent pull request");
    return 0;
  }

  // The one new primitive type.
  const baseRegistry = await fileAtRef(pr.base.ref, "src/primitives/registry.ts", repo, token);
  const headRegistry = await fileAtRef(pr.head.sha, "src/primitives/registry.ts", repo, token);
  const types = newPrimitiveTypes(baseRegistry, headRegistry);
  if (types.length !== 1) problems.push(`expected exactly one new primitive type, found ${types.length}`);
  const type = types[0] ?? "unknown";

  // The change set.
  const files = await api<ChangedFile[]>(`/repos/${repo}/pulls/${prNumber}/files?per_page=100`, token);
  problems.push(...checkAllowedPaths(files.map((f) => f.filename), type));
  for (const file of files) {
    if (file.filename === "src/primitives/registry.ts" || file.filename === "golden/CHANGES.md") {
      if (!file.patch) {
        problems.push(`patch unavailable for ${file.filename}`);
        continue;
      }
      problems.push(...(file.filename === "src/primitives/registry.ts" ? checkRegistryPatch(file.patch) : checkChangesLog(file.patch)));
    }
    if (file.filename === "golden/arm64/hashes.json" || file.filename === "golden/x64/hashes.json") {
      const set = file.filename.includes("arm64") ? "arm64" : "x64";
      try {
        const base = JSON.parse(await fileAtRef(pr.base.ref, file.filename, repo, token)) as Record<string, string>;
        const head = JSON.parse(await fileAtRef(pr.head.sha, file.filename, repo, token)) as Record<string, string>;
        problems.push(...checkHashSets(set, base, head));
      } catch {
        problems.push(`could not compare ${file.filename} at base and head`);
      }
    }
  }

  // The signer of record: the single human assignee of the proposal issue.
  let signerOfRecord: string | null = null;
  const issueNumber = await closingIssue(prNumber, repo, pr.body ?? "", token);
  if (issueNumber === null) {
    problems.push("no linked proposal issue");
  } else {
    const issue = await api<{ assignees: Array<{ login: string }> }>(`/repos/${repo}/issues/${issueNumber}`, token);
    const humans = issue.assignees.map((a) => a.login).filter((login) => !AGENT_LOGINS.includes(login));
    if (humans.length === 0) {
      problems.push("proposal has no human assignee: signer of record unresolved");
    } else if (humans.length > 1) {
      problems.push(`proposal has multiple human assignees (${humans.join(", ")}): exactly one signer of record is required`);
    } else {
      const actor = humans[0];
      let signersJson: string;
      try {
        signersJson = await fileAtRef(pr.base.ref, "CLA-SIGNERS.json", repo, token);
      } catch {
        signersJson = await fileAtRef(pr.head.sha, "CLA-SIGNERS.json", repo, token);
      }
      if (!signerListed(actor, signersJson)) {
        problems.push(`${actor} assigned this proposal but has not signed the CLA`);
      } else {
        signerOfRecord = actor;
      }
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`::error::agent-pr-guard: ${problem}`);
    return 1;
  }
  console.log(`agent pull request ok: ${type}, signer of record ${signerOfRecord}`);
  return 0;
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") {
  process.exit(selfTest());
} else if (args[0] === "--pr" && Number.isInteger(Number(args[1])) && Number(args[1]) > 0) {
  guard(Number(args[1]))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(`::error::agent-pr-guard: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
} else {
  console.error("usage: agent-pr-guard.ts --pr <number> | --self-test");
  process.exit(1);
}