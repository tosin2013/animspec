/**
 * Community / custom LED icons (ADR 0018, Increment 5b). '1' or '#' = lit.
 * Add an entry here to extend the LED sign beyond the pixelarticons font — the
 * "let people add more" path. These are checked BEFORE the font, so a custom
 * icon overrides a font icon of the same name. (A future upload flow writes here.)
 */
export const customIcons: Record<string, string[]> = {
  // Seed example proving the community path — a smiley the font doesn't have.
  smile: [
    "0011111100",
    "0100000010",
    "1001001001",
    "1000000001",
    "1000000001",
    "1010000101",
    "1001111001",
    "0100000010",
    "0011111100",
  ],
};
