import {iosEase} from '../motion';

/** One roll: from `from` to `to` starting at second `start`, lasting `duration` seconds. */
export interface RollSegment {
  start: number;
  duration: number;
  from: number;
  to: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Value of a chain of rolls at `time` (seconds). Before the first segment it is that segment's `from`; between
 * segments it holds the previous `to`. Pure, so the previous frame's value (needed for blur) is just valueAt(t - 1/fps).
 * @example rollValueAt(1.5, [{start: 1, duration: 1, from: 0, to: 100}])
 */
export const rollValueAt = (time: number, segments: readonly RollSegment[], ease: (x: number) => number = iosEase): number => {
  if (segments.length === 0) return 0;
  let value = segments[0].from;
  for (const s of segments) {
    if (time < s.start) return value;
    const t = s.duration <= 0 ? 1 : clamp01((time - s.start) / s.duration);
    value = s.from + (s.to - s.from) * ease(t);
    if (t < 1) return value;
  }
  return value;
};

/** Convenience chain: first roll `from` -> `to`, then each `then` entry rolls on from where the last one ended. */
export const buildRollSegments = (o: {from: number; to: number; start: number; duration: number; then?: ReadonlyArray<{at: number; to: number; duration?: number}>}): RollSegment[] => {
  const out: RollSegment[] = [{start: o.start, duration: o.duration, from: o.from, to: o.to}];
  (o.then ?? []).forEach((n) => {
    const prev = out[out.length - 1];
    out.push({start: n.at, duration: n.duration ?? o.duration, from: prev.to, to: n.to});
  });
  return out;
};
