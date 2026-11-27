import {clamp} from './math';
import {fbm1D} from './noise';

/** Hard ceiling on handheld translation, px. */
export const HANDHELD_MAX_PX = 2;
/** Hard ceiling on handheld roll, degrees. */
export const HANDHELD_MAX_DEG = 0.15;

/** Options for {@link handheld}. Amplitudes above the ceilings are clamped. */
export interface HandheldOptions {
  /** Noise seed. Same seed = same shake on every render. Default 1. */
  seed?: number;
  /** Peak translation in px, clamped to {@link HANDHELD_MAX_PX}. Default 1. */
  amplitude?: number;
  /** Peak roll in degrees, clamped to {@link HANDHELD_MAX_DEG}. Default 0.08. */
  rotation?: number;
  /** Main noise frequency in Hz. Default 0.8. */
  frequency?: number;
}

/**
 * Tiny deterministic camera shake as a function of time in seconds (so it is the same at 30 and 60 fps).
 * Built from seeded fractal value noise, never Math.random. |x|, |y| <= 2px and |rotate| <= 0.15 degrees.
 * @example const s = handheld(frame / 60, {seed: 4, amplitude: 1.5}); // {x, y, rotate}
 */
export const handheld = (time: number, options: HandheldOptions = {}): {x: number; y: number; rotate: number} => {
  const seed = options.seed ?? 1;
  const amp = clamp(Math.abs(options.amplitude ?? 1), 0, HANDHELD_MAX_PX);
  const rot = clamp(Math.abs(options.rotation ?? 0.08), 0, HANDHELD_MAX_DEG);
  const f = options.frequency ?? 0.8;
  const t = time * f;
  return {
    x: clamp(fbm1D(t, seed * 3 + 1), -1, 1) * amp,
    y: clamp(fbm1D(t, seed * 3 + 2), -1, 1) * amp,
    rotate: clamp(fbm1D(t * 0.7, seed * 3 + 3), -1, 1) * rot,
  };
};
