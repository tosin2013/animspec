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
 */
export const SHADE: Record<string, string> = { D: "#3a3a3a", B: "#9a9a9a", W: "#ffffff" };

export interface Character {
  /** Moving cycle (required). */
  walk: string[][];
  /** At-rest cycle, e.g. breathing/blink (optional). */
  idle?: string[][];
  /** One airborne frame, shown while hopping on a beat (optional). */
  jump?: string[];
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
};

export const CHARACTER_NAMES = Object.keys(CHARACTERS);
