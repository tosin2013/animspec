import { SPDX_EXCEPTION_IDS, SPDX_LICENSE_IDS } from "./spdxData.js";

/**
 * SPDX license expressions (spec 024): a plugin's `licence` must be one, so
 * hosts can read it reliably. Grammar (SPDX spec, annex D), case-sensitive ids
 * and operators:
 *
 *   expr   := and ("OR" and)*
 *   and    := with ("AND" with)*
 *   with   := simple ("WITH" exception)?
 *   simple := "(" expr ")" | id ["+"] | "LicenseRef-" idstring
 */
const LICENSES = new Set(SPDX_LICENSE_IDS);
const EXCEPTIONS = new Set(SPDX_EXCEPTION_IDS);
const LICENSE_REF = /^(DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+$/;

export function isSpdxExpression(s: string): boolean {
  if (typeof s !== "string" || s.trim() === "") return false;
  const tokens = s.replace(/\(/g, " ( ").replace(/\)/g, " ) ").trim().split(/\s+/);
  let i = 0;
  const peek = () => tokens[i];
  const simple = (): boolean => {
    const t = tokens[i];
    if (t === undefined) return false;
    if (t === "(") {
      i++;
      if (!expr() || tokens[i] !== ")") return false;
      i++;
      return true;
    }
    if (LICENSE_REF.test(t)) { i++; return true; }
    const id = t.endsWith("+") ? t.slice(0, -1) : t;
    if (!LICENSES.has(id)) return false;
    i++;
    return true;
  };
  const withExpr = (): boolean => {
    if (!simple()) return false;
    if (peek() === "WITH") {
      i++;
      const ex = tokens[i];
      if (ex === undefined || !EXCEPTIONS.has(ex)) return false;
      i++;
    }
    return true;
  };
  const andExpr = (): boolean => {
    if (!withExpr()) return false;
    while (peek() === "AND") { i++; if (!withExpr()) return false; }
    return true;
  };
  const expr = (): boolean => {
    if (!andExpr()) return false;
    while (peek() === "OR") { i++; if (!andExpr()) return false; }
    return true;
  };
  return expr() && i === tokens.length;
}
