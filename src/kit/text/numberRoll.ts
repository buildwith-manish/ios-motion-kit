import {iosEase, iosSpring} from '../motion';

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

/** A leading column (10^e, e > 0) starts to carry from blank to '1' once the value reaches this share of 10^e. */
const CARRY_FROM = 0.9;

/** Whether the column at place 10^e (e > 0) shows a digit for value `v`. */
export const placeShown = (v: number, e: number): boolean => Math.abs(v) / 10 ** e > CARRY_FROM + 1e-9;

/**
 * Width share (0..1) of the leading column at place 10^e on `frame`: a spring that follows {@link placeShown} as
 * digits appear and disappear. Pure: every earlier change is found again from the roll segments, and each one adds a
 * spring step from the frame where it happened.
 * @example digitPresence(90, 60, buildRollSegments({from: 0, to: 316, start: 1, duration: 1}), 2)
 */
export const digitPresence = (frame: number, fps: number, segments: readonly RollSegment[], e: number, response = 0.28): number => {
  if (segments.length === 0) return 0;
  let shown = placeShown(segments[0].from, e);
  let width = shown ? 1 : 0;
  // The value only changes inside segments, so only those frames are scanned.
  let scanned = -Infinity;
  for (const s of segments) {
    const first = Math.max(scanned + 1, Math.floor(s.start * fps));
    const last = Math.min(Math.floor(frame), Math.ceil((s.start + Math.max(0, s.duration)) * fps) + 1);
    for (let f = first; f <= last; f++) {
      const next = placeShown(rollValueAt(f / fps, segments), e);
      if (next !== shown) {
        // Counted from the frame before the change, so the column already has some width when its digit appears.
        width += (next ? 1 : -1) * iosSpring((frame - f + 1) / fps, response);
        shown = next;
      }
    }
    scanned = Math.max(scanned, last);
  }
  return clamp01(width);
};
