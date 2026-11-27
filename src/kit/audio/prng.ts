/**
 * Tiny deterministic helpers so cue variants are repeatable across renders and across Remotion's parallel workers.
 * No Math.random anywhere in the audio kit.
 */

/**
 * 32-bit FNV-1a hash of a string.
 * @example hashString('tap:3') // 2166136261-based uint32
 */
export const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * Seeded PRNG (mulberry32). Returns a function producing floats in [0, 1).
 * @example const rnd = mulberry32(hashString('seed:tap:0')); rnd() // always the same first value
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
