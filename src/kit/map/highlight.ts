/** Highlight timing (pure, seconds in, 0..1 out). */
import {iosSpring, SPRING} from '../motion';

/** One highlight: these regions light up at `at` seconds and, if `until` is given, fade out from then. */
export interface HighlightStep {
  ids: string[];
  at: number;
  until?: number;
  /** Spring response in seconds (default SPRING.SMOOTH). */
  response?: number;
}

const settle = (p: number) => (p > 0.999 ? 1 : p < 0.001 ? 0 : p);

/** Spring in from `at`, spring out from `until`. */
export const highlightProgress = (time: number, at: number, until?: number, response: number = SPRING.SMOOTH): number => {
  const rise = iosSpring(time - at, response);
  const fall = until === undefined ? 0 : iosSpring(time - until, response);
  return settle(rise * (1 - fall));
};

/** Progress of every region named by any step (the strongest step wins). Ids at 0 are omitted. */
export const highlightStateAt = (time: number, steps: readonly HighlightStep[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const s of steps) {
    const p = highlightProgress(time, s.at, s.until, s.response);
    if (p <= 0) continue;
    for (const id of s.ids) out.set(id, Math.max(p, out.get(id) ?? 0));
  }
  return out;
};

/**
 * How dimmed the rest of the map is: the sum of the steps' progress, capped at 1, so it stays dimmed (no flash) while
 * one step hands over to the next.
 */
export const dimAmountAt = (time: number, steps: readonly HighlightStep[]): number =>
  settle(Math.min(1, steps.reduce((a, s) => a + highlightProgress(time, s.at, s.until, s.response), 0)));
