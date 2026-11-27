/** Small numeric helpers local to the transitions kit. */

/** Clamp to [0, 1]. @example clamp01(1.4) // 1 */
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Linear interpolation. @example lerp(10, 20, 0.5) // 15 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
