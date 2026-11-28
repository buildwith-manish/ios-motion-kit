import type {Bezier} from '../tokens/types';
import type {Canvas} from '../tokens/types';

/** Easing: maps segment progress 0..1 to 0..1 (overshoot allowed). */
export type EaseFn = (u: number) => number;

/**
 * Easing of the segment that *leaves* a keyframe.
 * - `'ios'` (default): `iosEase` over the segment, lands exactly on the next keyframe's time.
 * - `'spring'`: iOS critically-damped spring, renormalised to land exactly on the next keyframe (see `response`).
 * - `'linear'`
 * - a cubic-bezier `[x1, y1, x2, y2]`, or any `(u) => number`.
 */
export type SegmentEase = 'ios' | 'spring' | 'linear' | Bezier | EaseFn;

/**
 * One camera keyframe. `t` is in **seconds**. Omitted x / y / scale / rotate carry over from the previous keyframe
 * (the first keyframe defaults to x 0, y 0, scale 1, rotate 0).
 */
export interface CameraKeyframe {
  /** Time in seconds. */
  t: number;
  /** World point (px from the canvas centre) the camera looks at. Positive x looks right, positive y looks down. */
  x?: number;
  y?: number;
  /** Zoom, > 0. 1 = no zoom, 2 = twice as close. Interpolated in log space. */
  scale?: number;
  /** Camera roll in degrees. Positive = camera rolls clockwise, so the picture turns counter-clockwise. */
  rotate?: number;
  /** Easing of the segment from this keyframe to the next. Default `'ios'`. */
  ease?: SegmentEase;
  /** Spring response in seconds for `ease: 'spring'`. Default 0.95 x the segment length. */
  response?: number;
  /** Underdamped spring bounce (0..0.4) for `ease: 'spring'`; default 0 keeps existing critically-damped motion. */
  bounce?: number;
}

/** A resolved camera pose. */
export interface CameraState {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

/** Screen-space motion of the picture between two render frames, in px per frame. */
export interface CameraDelta {
  dx: number;
  dy: number;
}

/** Everything a camera rig knows about one frame. */
export interface CameraSample {
  /** Pose actually applied (rig + handheld). */
  state: CameraState;
  /** Pose from the keyframes alone. */
  base: CameraState;
  /** Handheld offset that was added (zero when handheld is off). */
  shake: {x: number; y: number; rotate: number};
  /** On-screen motion of the picture at the screen centre since the previous render frame (rig only), px/frame. */
  delta: CameraDelta;
  /** `hypot(delta.dx, delta.dy)`, px/frame. */
  speed: number;
  /** Apparent picture motion at a right-of-centre screen anchor, including translation, zoom, and roll. */
  motion: CameraDelta;
  /** `hypot(motion.dx, motion.dy)`, px/frame. */
  motionSpeed: number;
  /** Time in seconds. */
  time: number;
  canvas: Canvas;
}
