/**
 * Broken sprite characters for the character rule (spec 020). Each breaks one
 * rule; `verify-registry.ts` fails if `characterProblems` does not catch it.
 * Fixtures live outside `src/` so the library can never import them.
 */
import type { Character } from "../../src/primitives/sprites";

const palette: Character["palette"] = { O: { role: "outline", mono: "D" }, B: { role: "body", mono: "B" } };
const square = ["OOOO", "OBBO", "OBBO", "OOOO"];

export const BAD_CHARACTERS: Array<{ name: string; chars: Record<string, Character>; subject: string }> = [
  {
    name: "undeclared-letter",
    subject: "undeclared",
    chars: { undeclared: { walk: [["OOOO", "OBXO", "OBBO", "OOOO"]], palette } },
  },
  {
    name: "mismatched-frame",
    subject: "mismatched",
    chars: { mismatched: { walk: [square, square.slice(0, 3)] } },
  },
  {
    name: "oversize-v2",
    subject: "oversize",
    chars: { oversize: { walk: [Array.from({ length: 4 }, () => "O".repeat(33))], palette } },
  },
  {
    name: "bad-mono",
    subject: "badmono",
    chars: { badmono: { walk: [square], palette: { O: { role: "outline", mono: "Q" as "D" }, B: { role: "body", mono: "B" } } } },
  },
];
