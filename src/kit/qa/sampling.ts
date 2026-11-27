/** Pure time-sampling helpers shared by the QA scripts. Times are in seconds. No React, no Node APIs. */

/**
 * One sampled moment: the requested time snapped to a real frame.
 * @example const first: Sample = {frame: 0, time: 0};
 */
export interface Sample {
  /** Frame number in the composition's own fps. */
  frame: number;
  /** Time of that frame in seconds (frame / fps). */
  time: number;
}

/**
 * Options for {@link sampleTimes}.
 * @example const opts: SampleOptions = {duration: 10, fps: 60, every: 1};
 */
export interface SampleOptions {
  /** Composition length in seconds. */
  duration: number;
  fps: number;
  /** Gap between samples in seconds (> 0). */
  every: number;
  /** First sample in seconds (default 0). */
  start?: number;
  /** Last time that may be sampled in seconds (default: the end of the composition). */
  end?: number;
  /** Also sample the very last frame (default false). */
  includeLast?: boolean;
}

/**
 * Sample moments every `every` seconds, snapped to frames, never past the last frame, without duplicates.
 * @example sampleTimes({duration: 10, fps: 60, every: 2.5}) // frames 0, 150, 300, 450
 */
export const sampleTimes = ({duration, fps, every, start = 0, end = duration, includeLast = false}: SampleOptions): Sample[] => {
  if (!(every > 0) || !(fps > 0) || !(duration > 0)) throw new Error('sampleTimes: duration, fps and every must be > 0');
  const last = Math.max(0, Math.round(duration * fps) - 1);
  const frames = new Set<number>();
  for (let i = 0; ; i++) {
    const t = Math.max(0, start) + i * every;
    const frame = Math.round(t * fps);
    if (t > end + 1e-9 || frame > last) break;
    frames.add(frame);
  }
  if (includeLast) frames.add(Math.min(last, Math.round(end * fps)));
  return [...frames].sort((a, b) => a - b).map((frame) => ({frame, time: frame / fps}));
};

/**
 * "m:ss.ss" label for a time in seconds.
 * @example formatTimestamp(75.5) // "1:15.50"
 */
export const formatTimestamp = (seconds: number): string => {
  const cs = Math.round(Math.max(0, seconds) * 100);
  const m = Math.floor(cs / 6000);
  return `${m}:${((cs - m * 6000) / 100).toFixed(2).padStart(5, '0')}`;
};

/**
 * Fixed-width text table for terminal reports.
 * @example formatTable(['comp', 'issues'], [['Kit-Qa-Demo', '2']])
 */
export const formatTable = (head: readonly string[], rows: ReadonlyArray<readonly string[]>): string => {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (r: readonly string[]) => widths.map((w, i) => (r[i] ?? '').padEnd(w)).join('  ').trimEnd();
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
};
