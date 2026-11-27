/**
 * Seeded, deterministic 1D noise. No Math.random, no state: the same (x, seed) always gives the same value, so any
 * frame can be rendered on any worker in any order.
 */

const hash = (i: number, seed: number): number => {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((seed | 0) + 0x9e3779b9, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
};

/**
 * Smooth value noise in [-1, 1] (quintic interpolation between hashed lattice points).
 * @example valueNoise1D(12.3, 7) // some number in [-1, 1], always the same for (12.3, 7)
 */
export const valueNoise1D = (x: number, seed = 0): number => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
};

/**
 * Fractal sum of `octaves` value-noise octaves (each 2.3x the frequency, half the weight), normalised so the result
 * stays inside [-1, 1].
 * @example fbm1D(t * 0.8, 3) // |result| <= 1
 */
export const fbm1D = (x: number, seed = 0, octaves = 2): number => {
  let sum = 0;
  let weight = 1;
  let total = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise1D(x * freq + o * 31.7, seed + o * 101) * weight;
    total += weight;
    weight *= 0.5;
    freq *= 2.3;
  }
  return sum / total;
};
