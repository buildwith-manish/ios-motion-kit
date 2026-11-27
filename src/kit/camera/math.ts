/** Small pure math helpers for the camera kit. */

/**
 * Clamp `v` to `[lo, hi]`.
 * @example clamp(8, -6, 6) // 6
 */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Linear interpolation.
 * @example lerp(0, 100, 0.25) // 25
 */
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

/**
 * Interpolate a positive scale in log space, so 1 -> 2 and 2 -> 4 take the same perceived time.
 * @example lerpScale(1, 4, 0.5) // 2
 */
export const lerpScale = (a: number, b: number, p: number): number => Math.exp(lerp(Math.log(a), Math.log(b), p));
