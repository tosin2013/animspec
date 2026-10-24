/**
 * Built-in character sprites for the `sprite` primitive (ADR 0021, level 1).
 *
 * A character is a set of named POSES; each pose is a list of animation frames;
 * each frame is rows of shade chars:
 *   '.' transparent, 'D' dark outline, 'B' body, 'W' highlight.
 * Poses:
 *   walk  — cycled while the sprite is moving (required).
 *   idle  — cycled while the sprite is static/at rest (optional).
 *   jump  — a single airborne frame, shown mid-hop on a beat (optional).
 * Shades draw as greys so the ADR 0020 quantizer maps them to palette tones;
 * they also read fine un-quantized. Adding a character is one entry — the same
 * "scales like a library" pattern as the LED icons. Keep every frame in a
 * character the same width and height so motion/facing stay stable.
 *
 * A single-bitmap pixel icon (via getIconBitmap) is used as a one-frame walk
 * pose when the name is not a character here.
 *
 * Format v2 (spec 020): a character may declare a `palette` mapping each
 * bitmap letter to a palette role and the legacy shade (D/B/W) it falls back
 * to outside creative mode. In creative mode a role takes the spec's `roles`
 * colour when one is given. Every letter of a v2 character must be declared,
 * and a v2 bitmap is at most 32 wide × 48 tall (checked by verify-registry).
 */
export const SHADE: Record<string, string> = { D: "#3a3a3a", B: "#9a9a9a", W: "#ffffff" };

export interface Character {
  /** Moving cycle (required). */
  walk: string[][];
  /** At-rest cycle, e.g. breathing/blink (optional). */
  idle?: string[][];
  /** One airborne frame, shown while hopping on a beat (optional). */
  jump?: string[];
  /**
   * Sprite format v2 (spec 020): each bitmap letter's palette role and the
   * legacy shade it falls back to outside creative mode; letters must all be
   * declared; at most 32 wide × 48 tall.
   */
  palette?: Record<string, { role: string; mono: "D" | "B" | "W" }>;
}

export const CHARACTERS: Record<string, Character> = {
  // A little mascot: 2-frame walk, 2-frame idle (blink), and a jump pose.
  mascot: {
    walk: [
      [
        "...DDDDD...",
        "..DBBBBBD..",
        "..DBWBWBD..",
        "..DBBBBBD..",
        "..DBBBBBD..",
        ".DBBBBBBBD.",
        "..DBBBBBD..",
        "..DB.D.BD..",
        "...D...D...",
        "..DD...DD..",
      ],
      [
        "...DDDDD...",
        "..DBBBBBD..",
        "..DBWBWBD..",
        "..DBBBBBD..",
        "..DBBBBBD..",
        "DBBBBBBBBBD",
        "..DBBBBBD..",
        "...DBDBD...",
        "..DD.D.DD..",
        ".DD.....DD.",
      ],
    ],
    idle: [
      [
        "...DDDDD...",
        "..DBBBBBD..",
        "..DBWBWBD..",
        "..DBBBBBD..",
        ".DBBBBBBBD.",
        ".DBBBBBBBD.",
        "..DBBBBBD..",
        "..DBBBBBD..",
        "..DD.D.DD..",
        "..DD...DD..",
      ],
      [
        "...DDDDD...",
        "..DBBBBBD..",
        "..DBBBBBD..",
        "..DBBBBBD..",
        ".DBBBBBBBD.",
        ".DBBBBBBBD.",
        "..DBBBBBD..",
        "..DBBBBBD..",
        "..DD.D.DD..",
        "..DD...DD..",
      ],
    ],
    jump: [
      "..D.....D..",
      "...DDDDD...",
      "..DBBBBBD..",
      "..DBWBWBD..",
      "..DBBBBBD..",
      "..DBBBBBD..",
      "..DBBBBBD..",
      "..DBBBBBD..",
      "..DBB.BBD..",
      "...DD.DD...",
    ],
  },

  // A blinking robot: walk = the blink cycle (eyes open / shut).
  bot: {
    walk: [
      [
        ".DDDDDDD.",
        ".DBBBBBD.",
        ".DWDBDWD.",
        ".DBBBBBD.",
        ".DBWWWBD.",
        ".DDDDDDD.",
        "..D...D..",
        ".DD...DD.",
      ],
      [
        ".DDDDDDD.",
        ".DBBBBBD.",
        ".DDDBDDD.",
        ".DBBBBBD.",
        ".DBWWWBD.",
        ".DDDDDDD.",
        "..D...D..",
        ".DD...DD.",
      ],
    ],
  },

  // A wavy ghost: 2-frame walk (eyes glance + hem shifts).
  ghost: {
    walk: [
      [
        "..DDDDD..",
        ".DBBBBBD.",
        ".DWDBDWD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".D.D.D.D.",
      ],
      [
        "..DDDDD..",
        ".DBBBBBD.",
        ".DBDWDBD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        "D.D.D.D.D",
      ],
    ],
    idle: [
      [
        "..DDDDD..",
        ".DBBBBBD.",
        ".DWDBDWD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".DBBBBBD.",
        ".D.D.D.D.",
      ],
    ],
  },

  // A 16-bit-era adventurer (spec 020, issue #103): format v2, ten roles.
  // In creative mode each part takes the spec's `roles` colour; otherwise the
  // parts fall back to the legacy greys and read like any other character.
  hero: {
    walk: [
      [
        ".....OOOOOO.....",
        "....OHHhhHHO....",
        "...OHHhHHHHHO...",
        "...OHHSSSSHHO...",
        "...OHSESSESHO...",
        "...OHSSSSSSHO...",
        "....OSSSSSSO....",
        ".....OGGGGO.....",
        "...OCCTTTTCCO...",
        "..OCCTTGGTTCCO..",
        "..OCcTTTTTTcCO..",
        "..OSCTTTTTTCSO..",
        "..OOCTTGGTTCOO..",
        "...OCTTTTTTCO...",
        "...OcTTTTTTcO...",
        "....OTTO.OTTO...",
        "...OTTO...OTTO..",
        "...OKKO...OKKO..",
        "..OKKKO...OKKKO.",
        "..OOOOO...OOOOO.",
      ],
      [
        ".....OOOOOO.....",
        "....OHHhhHHO....",
        "...OHHhHHHHHO...",
        "...OHHSSSSHHO...",
        "...OHSESSESHO...",
        "...OHSSSSSSHO...",
        "....OSSSSSSO....",
        ".....OGGGGO.....",
        "...OCCTTTTCCO...",
        "..OCCTTGGTTCCO..",
        "..OCcTTTTTTcCO..",
        "..OSCTTTTTTCSO..",
        "..OOCTTGGTTCOO..",
        "...OCTTTTTTCO...",
        "...OcTTTTTTcO...",
        ".....OTTTTO.....",
        ".....OTOOTO.....",
        ".....OKOOKO.....",
        "....OKKOOKKO....",
        "....OOOOOOOO....",
      ],
    ],
    idle: [
      [
        ".....OOOOOO.....",
        "....OHHhhHHO....",
        "...OHHhHHHHHO...",
        "...OHHSSSSHHO...",
        "...OHSESSESHO...",
        "...OHSSSSSSHO...",
        "....OSSSSSSO....",
        ".....OGGGGO.....",
        "...OCCTTTTCCO...",
        "..OCCTTGGTTCCO..",
        "..OCcTTTTTTcCO..",
        "..OSCTTTTTTCSO..",
        "..OOCTTGGTTCOO..",
        "...OCTTTTTTCO...",
        "...OcTTTTTTcO...",
        ".....OTTTTO.....",
        ".....OTOOTO.....",
        ".....OKOOKO.....",
        "....OKKOOKKO....",
        "....OOOOOOOO....",
      ],
      [
        ".....OOOOOO.....",
        "....OHHhhHHO....",
        "...OHHhHHHHHO...",
        "...OHHSSSSHHO...",
        "...OHSOSSOSHO...",
        "...OHSSSSSSHO...",
        "....OSSSSSSO....",
        ".....OGGGGO.....",
        "...OCCTTTTCCO...",
        "..OCCTTGGTTCCO..",
        "..OCcTTTTTTcCO..",
        "..OSCTTTTTTCSO..",
        "..OOCTTGGTTCOO..",
        "...OCTTTTTTCO...",
        "...OcTTTTTTcO...",
        ".....OTTTTO.....",
        ".....OTOOTO.....",
        ".....OKOOKO.....",
        "....OKKOOKKO....",
        "....OOOOOOOO....",
      ],
    ],
    palette: {
      O: { role: "outline", mono: "D" },
      H: { role: "hair", mono: "B" },
      h: { role: "hair-light", mono: "W" },
      S: { role: "skin", mono: "W" },
      E: { role: "eyes", mono: "D" },
      G: { role: "gold", mono: "W" },
      C: { role: "cloak", mono: "B" },
      c: { role: "cloak-shade", mono: "D" },
      T: { role: "tunic", mono: "B" },
      K: { role: "boots", mono: "D" },
    },
  },
};

export const CHARACTER_NAMES = Object.keys(CHARACTERS);

/** Every named role a v2 character declares (spec 020), sorted, without the built-ins. */
export function declaredRoles(): string[] {
  const names = new Set<string>();
  for (const c of Object.values(CHARACTERS)) {
    for (const { role } of Object.values(c.palette ?? {})) {
      if (role !== "bg" && role !== "fg" && role !== "accent") names.add(role);
    }
  }
  return [...names].sort();
}
