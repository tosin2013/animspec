import { ROLE_NAME, addExternal, paramSpecProblems, type PrimitiveDef } from "./primitives/registry.js";
import { isSpdxExpression } from "./spdx.js";

/**
 * The plugin slot (spec 024, issue #92). A host registers plugins at startup;
 * each primitive becomes the namespaced external type `ext:<id>/<type>` in the
 * `external` tier, outside the core registry, so nothing derived from core
 * (selection, the vocabulary record, references, gates) ever sees it. A spec
 * declares the plugins it uses (`plugins: { id: { version } }`) and the
 * validator keeps a plugin layer only when the declared version is the one
 * registered. Plugin output is outside the core byte-identical guarantee; it
 * is proven by `verifyPlugin` (`animspec/verify`).
 */

export interface Plugin {
  /** Lowercase letters, digits and `-`, starting with a letter, at most 16 long. */
  id: string;
  /** Matched exactly against a spec's declaration; at most 64 characters. */
  version: string;
  /** A valid SPDX license expression, at most 128 characters. */
  licence: string;
  primitives: PrimitiveDef[];
}

interface PluginRecord {
  id: string;
  version: string;
  licence: string;
  types: string[];
}

const PLUGINS = new Map<string, PluginRecord>();

/** The namespaced type of a plugin primitive. */
export const externalType = (id: string, type: string): string => `ext:${id}/${type}`;

/**
 * Register a plugin for the life of the process. Throws with the reason on a
 * bad id, version or licence, a bad or duplicate primitive type, malformed
 * params, or the same id already registered at another version. Registering
 * the same id at the same version again is a no-op.
 */
export function registerPlugin(plugin: Plugin): void {
  const p = plugin as Partial<Plugin> | null;
  if (!p || typeof p !== "object") throw new Error("plugin must be an object");
  const id = p.id, version = p.version, licence = p.licence;
  if (typeof id !== "string" || !ROLE_NAME.test(id)) throw new Error(`plugin id must be lowercase letters, digits and -, starting with a letter, at most 16 long (got ${JSON.stringify(id)})`);
  if (typeof version !== "string" || version.length < 1 || version.length > 64) throw new Error(`plugin ${id}: version must be a string of 1 to 64 characters`);
  if (typeof licence !== "string" || licence.length > 128 || !isSpdxExpression(licence)) throw new Error(`plugin ${id}: licence must be a valid SPDX license expression (got ${JSON.stringify(licence)})`);
  const existing = PLUGINS.get(id);
  if (existing) {
    if (existing.version === version) return;
    throw new Error(`plugin ${id} is already registered at version ${existing.version}; one version per plugin per process (got ${version})`);
  }
  if (!Array.isArray(p.primitives) || p.primitives.length === 0) throw new Error(`plugin ${id}: primitives must be a non-empty array`);
  const seen = new Set<string>();
  const defs: PrimitiveDef[] = [];
  for (const def of p.primitives) {
    const type = (def as Partial<PrimitiveDef> | null)?.type;
    if (typeof type !== "string" || !ROLE_NAME.test(type)) throw new Error(`plugin ${id}: primitive type must be lowercase letters, digits and -, starting with a letter, at most 16 long (got ${JSON.stringify(type)})`);
    if (seen.has(type)) throw new Error(`plugin ${id}: duplicate primitive type ${type}`);
    seen.add(type);
    const problems = paramSpecProblems(def);
    if (problems.length > 0) throw new Error(`plugin ${id}: primitive ${type}: ${problems.join("; ")}`);
    defs.push({ ...def, type: externalType(id, type), tier: "external" });
  }
  for (const def of defs) addExternal(def);
  PLUGINS.set(id, { id, version, licence, types: [...seen].sort() });
}

/** The plugins registered in this process. */
export function registeredPlugins(): PluginRecord[] {
  return [...PLUGINS.values()].map((r) => ({ ...r, types: [...r.types] }));
}

/** A registered plugin, if any. */
export const registeredPlugin = (id: string): PluginRecord | undefined => PLUGINS.get(id);

/**
 * Read a spec's `plugins` map: `{ id: { version } }`. Bad entries are dropped
 * and reported; key order cannot matter.
 */
export function sanitizePlugins(raw: unknown): { plugins: Record<string, { version: string }>; problems: string[] } {
  const plugins: Record<string, { version: string }> = {};
  const problems: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { plugins, problems: ["plugins dropped (not an object)"] };
  for (const id of Object.keys(raw as object).sort()) {
    const e = (raw as Record<string, unknown>)[id] as Record<string, unknown> | null;
    if (!ROLE_NAME.test(id)) problems.push(`plugins: ${id} dropped (invalid id: use lowercase letters, digits and "-", start with a letter, max 16)`);
    else if (!e || typeof e !== "object" || typeof e.version !== "string" || e.version.length < 1 || e.version.length > 64) problems.push(`plugins: ${id} dropped (version must be a string of 1 to 64 characters)`);
    else plugins[id] = { version: e.version };
  }
  return { plugins, problems };
}

/** Split `ext:<id>/<type>`; null when the type is not external. */
export function parseExternalType(type: string): { id: string; type: string } | null {
  const m = /^ext:([^/]+)\/(.+)$/.exec(type);
  return m ? { id: m[1], type: m[2] } : null;
}
