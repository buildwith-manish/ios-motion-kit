/**
 * Ground truth for the QA demo composition: what each checker must report, and what it must not.
 * Pure data and maths so scripts and the demo share it.
 */

/**
 * Demo length and motion holds, in seconds.
 * @example QA_FIXTURE.longHold.start // 3
 */
export const QA_FIXTURE = {
  seconds: 10,
  /** Held for 2.5 s: the motion audit must report this. */
  longHold: {start: 3, end: 5.5},
  /** Held for 0.6 s: shorter than the 1 s limit, must NOT be reported. */
  shortHold: {start: 7.5, end: 8.1},
  /** Texts / elements the safe-area check must flag (faulty variants only). */
  unsafe: ['EDGE LABEL', 'unsafe-box'],
  /** Texts the contrast check must flag (faulty variants only). */
  lowContrast: ['Dim footnote text', 'White on a pale card'],
} as const;

/**
 * Seconds of motion elapsed by time t: advances like t but stands still during the holds.
 * @example qaMotionTime(5, true) // 3
 */
export const qaMotionTime = (t: number, holds: boolean): number => {
  if (!holds) return t;
  let held = 0;
  for (const h of [QA_FIXTURE.longHold, QA_FIXTURE.shortHold]) held += Math.min(Math.max(t - h.start, 0), h.end - h.start);
  return t - held;
};
