/**
 * LED-sign/sprite icon lookup (specs/001-primitive-vetting-gates,
 * contracts/icon-data.md). A PURE in-memory read: the bitmaps were pre-generated
 * into `iconData.ts` by `npm run icons:generate`, so drawing performs no file
 * access and does not depend on the working directory.
 *
 *   a name in customIcons   → that custom bitmap, at its own size, whatever
 *                             height is asked for
 *   a generated icon name,
 *   height 11 or 14         → the generated bitmap
 *   a generated icon name,
 *   any other height        → null
 *   an unknown name         → null
 *
 * Names are trimmed and lower-cased before lookup; custom icons take precedence
 * over generated icons of the same name; decoded bitmaps are memoised.
 */
import { customIcons } from "./customIcons";
import { ICON_DATA } from "./iconData";

const cache = new Map<string, boolean[][] | null>();

/** Bitmap for `name` at ~`size` rows tall; null if the name is unknown. */
export function getIconBitmap(name: string, size = 12): boolean[][] | null {
  const key = `${name}@${size}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let grid: boolean[][] | null = null;
  const clean = name.trim().toLowerCase();

  const custom = customIcons[clean];
  if (custom) {
    grid = custom.map((row) => row.split("").map((ch) => ch === "1" || ch === "#"));
  } else {
    const entry = ICON_DATA[clean];
    if (entry && (size === 11 || size === 14)) {
      const [width, bits] = entry[size];
      // Decode the hex-packed row-major bits.
      grid = [];
      for (let y = 0; y < size; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const nibble = parseInt(bits[Math.floor(idx / 4)], 16);
          row.push(((nibble >> (3 - (idx % 4))) & 1) === 1);
        }
        grid.push(row);
      }
    }
  }

  cache.set(key, grid);
  return grid;
}
