import {INTER_700, measureText, type FontMetrics} from './metrics';

/** Options for numberSize(). `min`/`max` are in the same unit as `maxWidth` (usually px at the canvas size). */
export interface NumberSizeOptions {
  min: number;
  max: number;
  /** Width table (default Inter Bold, the number role's weight). */
  metrics?: FontMetrics;
  /** Letter spacing in em (default -0.02, the number role's tracking). */
  tracking?: number;
  /** Safety factor on the predicted width (default 1.03, as layoutText). */
  slack?: number;
  /** Size step (default 0.5 px). */
  step?: number;
}

/**
 * Largest font size in [min, max] at which `valueText` fits on one line within `maxWidth`, from the width table (pure,
 * no DOM). Returns `min` when even `min` does not fit (the caller decides what to do), `max` when it fits at `max`.
 * Pass the widest text the number will show (e.g. the final value), so the size never changes during a roll.
 * @example numberSize('$12,400', 1500, {min: 120, max: 200}) // 200
 */
export const numberSize = (valueText: string, maxWidth: number, opts: NumberSizeOptions): number => {
  const {min, max, metrics = INTER_700, tracking = -0.02, slack = 1.03, step = 0.5} = opts;
  if (!(max > min)) return min;
  const em = measureText(valueText, 1, metrics, tracking) * slack;
  if (!(em > 0) || !(maxWidth > 0)) return em > 0 ? min : max;
  const fit = Math.floor(maxWidth / em / step) * step;
  return Math.max(min, Math.min(max, fit));
};
