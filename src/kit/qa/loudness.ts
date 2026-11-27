/** Pure parsing and judging of ffmpeg loudnorm analysis. No React, no Node APIs. */

/**
 * What to hit.
 * @example const podcast: LoudnessTarget = {integrated: -16, tolerance: 1, truePeak: -1};
 */
export interface LoudnessTarget {
  /** Integrated loudness, LUFS. */
  integrated: number;
  /** Allowed distance from `integrated`, LU. */
  tolerance: number;
  /** Highest allowed true peak, dBTP. */
  truePeak: number;
}

/**
 * YouTube plays at about -14 LUFS; -1 dBTP leaves room for lossy transcoding.
 * @example judgeLoudness(measure, YOUTUBE_LOUDNESS).ok
 */
export const YOUTUBE_LOUDNESS: LoudnessTarget = {integrated: -14, tolerance: 1, truePeak: -1};

/**
 * Measured values. Silence gives -Infinity.
 * @example const m: LoudnessMeasure = {integrated: -14.2, truePeak: -1.4, range: 5, threshold: -24.5};
 */
export interface LoudnessMeasure {
  integrated: number;
  truePeak: number;
  range: number;
  threshold: number;
}

/**
 * Reads the JSON block `loudnorm=print_format=json` writes to stderr.
 * @example parseLoudnorm(ffmpegStderr).integrated // -15.3
 */
export const parseLoudnorm = (stderr: string): LoudnessMeasure => {
  const blocks = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!blocks) throw new Error('parseLoudnorm: no loudnorm JSON in the ffmpeg output');
  const raw = JSON.parse(blocks[blocks.length - 1]) as Record<string, string>;
  const num = (key: string) => {
    const v = raw[key];
    const n = v === '-inf' ? -Infinity : v === 'inf' ? Infinity : Number(v);
    if (v === undefined || Number.isNaN(n)) throw new Error(`parseLoudnorm: bad value for ${key}: ${v}`);
    return n;
  };
  return {integrated: num('input_i'), truePeak: num('input_tp'), range: num('input_lra'), threshold: num('input_thresh')};
};

/**
 * Pass or fail, with the reason and the plain gain that would hit the target.
 * @example const why = (v: LoudnessVerdict) => v.problems.join('; ');
 */
export interface LoudnessVerdict {
  ok: boolean;
  problems: string[];
  /** dB of static gain to reach the integrated target (null for silence). */
  gainDb: number | null;
  /** True peak after that gain; above the ceiling means gain alone is not enough (limit or re-mix). */
  truePeakAfterGain: number | null;
}

/**
 * Judges a measurement against a target.
 * @example judgeLoudness({integrated: -18, truePeak: -6, range: 5, threshold: -28}).gainDb // 4
 */
export const judgeLoudness = (m: LoudnessMeasure, target: LoudnessTarget = YOUTUBE_LOUDNESS): LoudnessVerdict => {
  if (!Number.isFinite(m.integrated)) return {ok: false, problems: ['silent, or too quiet or short to measure'], gainDb: null, truePeakAfterGain: null};
  const problems: string[] = [];
  const off = m.integrated - target.integrated;
  if (Math.abs(off) > target.tolerance + 1e-9) problems.push(`${Math.abs(off).toFixed(1)} LU too ${off > 0 ? 'loud' : 'quiet'}`);
  if (m.truePeak > target.truePeak + 1e-9) problems.push(`true peak ${m.truePeak.toFixed(1)} dBTP is over ${target.truePeak}`);
  return {ok: !problems.length, problems, gainDb: -off, truePeakAfterGain: m.truePeak - off};
};
