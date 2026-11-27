/** Pure motion-audit maths: frame difference and "static stretch" detection. No React, no Node APIs. */

/**
 * Difference between two frames.
 * @example const same: FrameDiff = {mean: 0, changed: 0};
 */
export interface FrameDiff {
  /** Mean absolute channel difference over all pixels, 0-255. */
  mean: number;
  /** Fraction (0-1) of pixels whose largest channel difference is above the pixel tolerance. */
  changed: number;
}

/**
 * Compares two packed 8-bit frames of equal size. A pixel counts as changed when any channel moved by more than
 * `pixelTolerance` (ignores dithering). `changed` catches small moving things that barely move the mean.
 * @example diffFrames(prevRgb, nextRgb, {channels: 3}).changed
 */
export const diffFrames = (a: Uint8Array, b: Uint8Array, {channels = 3, pixelTolerance = 3}: {channels?: number; pixelTolerance?: number} = {}): FrameDiff => {
  if (a.length !== b.length || a.length === 0 || a.length % channels !== 0) throw new Error('diffFrames: frames must be non-empty and the same size');
  const pixels = a.length / channels;
  let sum = 0;
  let changed = 0;
  for (let p = 0; p < a.length; p += channels) {
    let max = 0;
    for (let c = 0; c < channels; c++) {
      const d = Math.abs(a[p + c] - b[p + c]);
      sum += d;
      if (d > max) max = d;
    }
    if (max > pixelTolerance) changed++;
  }
  return {mean: sum / a.length, changed: changed / pixels};
};

/**
 * The difference between two consecutive samples, with their times in seconds.
 * @example const pair: DiffSample = {from: 0, to: 0.1, mean: 0, changed: 0};
 */
export interface DiffSample extends FrameDiff {
  from: number;
  to: number;
}

/**
 * When a pair of samples counts as static: BOTH values must be at or under their limit.
 * @example const strict: StaticThresholds = {mean: 0.05, changed: 0.0002};
 */
export interface StaticThresholds {
  /** Mean difference limit, 0-255 (default 0.15). */
  mean: number;
  /** Changed-pixel fraction limit, 0-1 (default 0.001 = 0.1 % of pixels). */
  changed: number;
}

/**
 * Default thresholds, tuned for 0.25-scale renders.
 * @example findStaticStretches(pairs, {thresholds: STATIC_THRESHOLDS})
 */
export const STATIC_THRESHOLDS: StaticThresholds = {mean: 0.15, changed: 0.001};

/**
 * A run of consecutive static sample pairs.
 * @example const label = (s: StaticStretch) => `${s.start}-${s.end}`;
 */
export interface StaticStretch {
  /** Time of the first sample of the run, seconds. */
  start: number;
  /** Time of the last sample of the run, seconds. */
  end: number;
  duration: number;
  /** Largest values seen inside the run (how close it came to counting as motion). */
  peakMean: number;
  peakChanged: number;
}

/**
 * Finds runs that stay static for longer than `minSeconds`. `pairs` must be in time order and contiguous.
 * @example findStaticStretches(pairs, {minSeconds: 1}).map((s) => [s.start, s.end])
 */
export const findStaticStretches = (pairs: readonly DiffSample[], {minSeconds = 1, thresholds = STATIC_THRESHOLDS}: {minSeconds?: number; thresholds?: StaticThresholds} = {}): StaticStretch[] => {
  const out: StaticStretch[] = [];
  let run: DiffSample[] = [];
  const flush = () => {
    if (run.length) {
      const start = run[0].from;
      const end = run[run.length - 1].to;
      // 1e-6 so that a run of exactly minSeconds is not reported because of floating point.
      if (end - start > minSeconds + 1e-6) {
        out.push({start, end, duration: end - start, peakMean: Math.max(...run.map((r) => r.mean)), peakChanged: Math.max(...run.map((r) => r.changed))});
      }
    }
    run = [];
  };
  for (const p of pairs) {
    if (p.mean <= thresholds.mean && p.changed <= thresholds.changed) run.push(p);
    else flush();
  }
  flush();
  return out;
};
