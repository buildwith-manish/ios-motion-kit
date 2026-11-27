import type {TimedWord} from './types';

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const smooth = (n: number): number => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};

/**
 * How "active" a spoken word is at `time`, 0..1: eases in around `start`, holds, eases out around `end`.
 * The ramp is centred on the boundary and lasts `fade` seconds, so back-to-back words cross-fade instead of popping.
 * @example wordActivity(1.05, 1.0, 1.4) // ~1
 */
export const wordActivity = (time: number, start: number, end: number, fade: number = 0.1): number => {
  const f = Math.max(fade, 1e-6);
  const inn = smooth((time - (start - f / 2)) / f);
  const out = 1 - smooth((time - (end - f / 2)) / f);
  return Math.min(inn, out);
};

/**
 * Index of the word being spoken at `time` (start <= time < end), or -1.
 * @example activeWordIndex(timings, 2.3)
 */
export const activeWordIndex = (timings: readonly TimedWord[], time: number): number => {
  for (let i = 0; i < timings.length; i++) {
    if (time >= timings[i].start && time < timings[i].end) return i;
  }
  return -1;
};

/**
 * Returns a copy with every start/end shifted by `offset` seconds (e.g. to place a voice-over clip on a timeline).
 * @example shiftTimings(words, 12.5)
 */
export const shiftTimings = (timings: readonly TimedWord[], offset: number): TimedWord[] =>
  timings.map((w) => ({...w, start: w.start + offset, end: w.end + offset}));

/**
 * Lists problems in a timing table: empty text, end before start, words out of order. Empty array = fine.
 * @example validateTimings(words).forEach(console.warn)
 */
export const validateTimings = (timings: readonly TimedWord[]): string[] => {
  const issues: string[] = [];
  timings.forEach((w, i) => {
    if (!w.text || /\s/.test(w.text)) issues.push(`word ${i}: text must be one non-empty word without spaces (got ${JSON.stringify(w.text)})`);
    if (!(w.end >= w.start)) issues.push(`word ${i} "${w.text}": end ${w.end} is before start ${w.start}`);
    if (i > 0 && w.start < timings[i - 1].start) issues.push(`word ${i} "${w.text}": starts before the previous word`);
  });
  return issues;
};
