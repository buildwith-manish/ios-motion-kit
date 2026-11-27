import {iosSpring} from '../motion';
import {parseColor, rgbToHex} from '../tokens/contrast';

/** Canvas-space rectangle, such as a DOMRect captured during layout. */
export interface FocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A normalized key-light position at a time in seconds. */
export interface LightBeat {
  t: number;
  x: number;
  y: number;
  colour?: string;
}

export interface FocusCanvas {
  width: number;
  height: number;
}

export interface FocusPointOptions {
  /** First beat time in seconds. Default 0. */
  start?: number;
  /** Time from the first to last beat in seconds. Default 6. */
  duration?: number;
  colour?: string;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const mixColour = (a: string, b: string, t: number): string => {
  const x = parseColor(a).rgb;
  const y = parseColor(b).rgb;
  return rgbToHex(x.map((c, i) => Math.round(c + (y[i] - c) * t)) as [number, number, number]);
};

/**
 * Converts canvas-space element rectangles into normalized key-light beats.
 * @example focusPoints([{x: 400, y: 200, width: 300, height: 100}], {width: 1920, height: 1080})
 */
export const focusPoints = (rects: readonly FocusRect[], canvas: FocusCanvas, options: FocusPointOptions = {}): LightBeat[] => {
  if (!(canvas.width > 0) || !(canvas.height > 0)) throw new RangeError('focusPoints: canvas dimensions must be positive');
  const start = options.start ?? 0;
  const duration = options.duration ?? 6;
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration < 0) {
    throw new RangeError('focusPoints: start must be finite and duration must be finite and non-negative');
  }
  if (rects.length === 0) return [];
  return rects.map((rect, i) => ({
    t: start + (rects.length === 1 ? 0 : (duration * i) / (rects.length - 1)),
    x: clamp01((rect.x + rect.width / 2) / canvas.width),
    y: clamp01((rect.y + rect.height / 2) / canvas.height),
    ...(options.colour ? {colour: options.colour} : {}),
  }));
};

/** Spring-eased interpolation between consecutive beats; the last beat is held. */
export const lightAt = (time: number, beats: readonly LightBeat[], response: number): Pick<LightBeat, 'x' | 'y'> & {colour?: string} => {
  if (!Number.isFinite(time)) throw new RangeError('lightAt: time must be finite');
  if (!Number.isFinite(response) || !(response > 0)) throw new RangeError('lightAt: response must be finite and positive');
  if (beats.length === 0) return {x: 0.5, y: 0.5};
  for (let i = 0; i < beats.length; i++) {
    if (![beats[i].t, beats[i].x, beats[i].y].every(Number.isFinite) || beats[i].x < 0 || beats[i].x > 1 || beats[i].y < 0 || beats[i].y > 1) {
      throw new RangeError('lightAt: beat times must be finite and positions normalized to 0..1');
    }
    if (i === 0) continue;
    if (beats[i].t < beats[i - 1].t) throw new RangeError('lightAt: beats must be sorted by time');
  }
  if (time <= beats[0].t || beats.length === 1) return {x: beats[0].x, y: beats[0].y, colour: beats[0].colour};
  for (let i = 0; i < beats.length - 1; i++) {
    const from = beats[i];
    const to = beats[i + 1];
    if (time >= to.t) continue;
    const span = to.t - from.t;
    if (span <= 0) return {x: to.x, y: to.y, colour: to.colour ?? from.colour};
    const elapsed = time - from.t;
    const normalization = iosSpring(span, response);
    const p = normalization > 0 ? clamp01(iosSpring(elapsed, response) / normalization) : 1;
    return {
      x: from.x + (to.x - from.x) * p,
      y: from.y + (to.y - from.y) * p,
      colour: from.colour && to.colour ? mixColour(from.colour, to.colour, p) : from.colour ?? to.colour,
    };
  }
  const last = beats[beats.length - 1];
  return {x: last.x, y: last.y, colour: last.colour};
};
