import {cubicBezier, iosEase, iosSpring} from '../motion';
import {clamp} from './math';
import {lerp, lerpScale} from './math';
import type {CameraDelta, CameraKeyframe, CameraState, EaseFn, SegmentEase} from './types';

/** Camera at rest: centred, no zoom, no roll. */
export const IDENTITY_CAMERA: CameraState = {x: 0, y: 0, scale: 1, rotate: 0};

type Resolved = CameraState & {t: number; ease?: SegmentEase; response?: number; bounce?: number};

/**
 * Validate, sort by time, and fill carried-over values. Throws on non-finite numbers or `scale <= 0`.
 * @example normalizeKeyframes([{t: 2, scale: 1.4}, {t: 0}]) // [{t:0,x:0,y:0,scale:1,rotate:0}, {t:2,...,scale:1.4}]
 */
export const normalizeKeyframes = (keyframes: readonly CameraKeyframe[]): Resolved[] => {
  const sorted = keyframes.map((k, i) => ({k, i})).sort((a, b) => a.k.t - b.k.t || a.i - b.i);
  const out: Resolved[] = [];
  let prev: CameraState = IDENTITY_CAMERA;
  for (const {k} of sorted) {
    const r: Resolved = {
      t: k.t,
      x: k.x ?? prev.x,
      y: k.y ?? prev.y,
      scale: k.scale ?? prev.scale,
      rotate: k.rotate ?? prev.rotate,
      ease: k.ease,
      response: k.response,
      bounce: k.bounce,
    };
    if (![r.t, r.x, r.y, r.scale, r.rotate].every(Number.isFinite)) throw new RangeError('camera keyframe has a non-finite value');
    if (r.scale <= 0) throw new RangeError('camera keyframe scale must be > 0');
    if (r.bounce !== undefined && (!Number.isFinite(r.bounce) || r.bounce < 0 || r.bounce > 0.4)) throw new RangeError('camera keyframe bounce must be between 0 and 0.4');
    out.push(r);
    prev = r;
  }
  return out;
};

/**
 * Resolve a {@link SegmentEase} into a `(u) => p` function for a segment `durationSeconds` long.
 * The spring is renormalised so it lands on exactly 1 at u = 1.
 * @example resolveEase('spring', 2)(1) // 1
 */
export const resolveEase = (ease: SegmentEase | undefined, durationSeconds: number, response?: number, bounce?: number): EaseFn => {
  if (ease === undefined || ease === 'ios') return iosEase;
  if (ease === 'linear') return (u) => u;
  if (ease === 'spring') {
    const r = response ?? durationSeconds * 0.95;
    const options = bounce === undefined ? undefined : {bounce};
    const end = iosSpring(durationSeconds, r, options);
    return (u) => {
      const progress = iosSpring(u * durationSeconds, r, options) / end;
      return (bounce ?? 0) === 0 ? clamp(progress, 0, 1) : progress;
    };
  }
  if (typeof ease === 'function') return ease;
  return cubicBezier(ease[0], ease[1], ease[2], ease[3]);
};

/**
 * Camera pose at `time` seconds. Holds the first pose before the first keyframe and the last after the last one.
 * Pan and roll interpolate linearly, zoom in log space; each segment uses the easing of the keyframe it leaves.
 * Pure.
 * @example sampleCamera([{t: 0, x: 0}, {t: 2, x: 300, scale: 1.4}], 1) // pose halfway through the move
 */
export const sampleCamera = (keyframes: readonly CameraKeyframe[], time: number): CameraState => {
  const ks = normalizeKeyframes(keyframes);
  if (ks.length === 0) return IDENTITY_CAMERA;
  const first = ks[0];
  const last = ks[ks.length - 1];
  if (time <= first.t) return {x: first.x, y: first.y, scale: first.scale, rotate: first.rotate};
  if (time >= last.t) return {x: last.x, y: last.y, scale: last.scale, rotate: last.rotate};
  let i = 0;
  while (i < ks.length - 2 && time >= ks[i + 1].t) i++;
  const a = ks[i];
  const b = ks[i + 1];
  const dur = b.t - a.t;
  if (dur <= 0) return {x: b.x, y: b.y, scale: b.scale, rotate: b.rotate};
  const p = resolveEase(a.ease, dur, a.response, a.bounce)((time - a.t) / dur);
  return {x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), scale: lerpScale(a.scale, b.scale, p), rotate: lerp(a.rotate, b.rotate, p)};
};

/**
 * CSS transform for a camera pose, to be applied to the "world" element with `transform-origin: 50% 50%`.
 * The world point (x, y) lands on the screen centre, then it is zoomed and rolled about the centre.
 * @example cameraTransform({x: 120, y: 0, scale: 1.2, rotate: 1}) // 'scale(1.2) rotate(-1deg) translate(-120px, -0px)'
 */
export const cameraTransform = (s: CameraState): string => `scale(${s.scale}) rotate(${-s.rotate}deg) translate(${-s.x}px, ${-s.y}px)`;

/**
 * How far the picture moved on screen between two poses one render frame apart, measured at the screen centre
 * (the world point the camera looks at now, versus where it was drawn one frame ago). Translation only: zoom and
 * roll are not part of this vector. Pure.
 * @example cameraScreenDelta({x: 0, y: 0, scale: 1, rotate: 0}, {x: 10, y: 0, scale: 1, rotate: 0}) // {dx: -10, dy: 0}
 */
export const cameraScreenDelta = (prev: CameraState, cur: CameraState): CameraDelta => {
  const a = (-prev.rotate * Math.PI) / 180;
  const wx = cur.x - prev.x;
  const wy = cur.y - prev.y;
  const px = prev.scale * (wx * Math.cos(a) - wy * Math.sin(a));
  const py = prev.scale * (wx * Math.sin(a) + wy * Math.cos(a));
  return {dx: -px, dy: -py};
};
