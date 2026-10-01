/**
 * Deterministic seeded PRNG + a byte hash for deriving seeds (ADR 0012 §1).
 * The ONLY randomness permitted in the visual path is `mulberry32`, seeded from
 * source data — never `Math.random()`. Same seed ⇒ same sequence ⇒ same frames.
 */

/** Seeded PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a byte buffer, for deriving a stable seed. */
export function hashBytes(buf: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix two 32-bit values into one (e.g. seed ⊕ frame index) — deterministic. */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}
