import type {Canvas} from '../tokens/types';
import {cameraScreenDelta, sampleCamera} from './keyframes';
import {handheld, type HandheldOptions} from './handheld';
import type {CameraDelta, CameraKeyframe, CameraSample, CameraState} from './types';

/** Options for {@link cameraAt}. */
export interface CameraAtOptions {
  /** Add deterministic handheld shake. `true` = defaults. Default off. */
  handheld?: boolean | HandheldOptions;
}

/** Apparent screen-space movement of a point near the right edge, including translation, zoom, and roll. */
export const cameraMotionDelta = (previous: CameraState, current: CameraState, canvas: Canvas): CameraDelta => {
  const anchorX = Math.min(canvas.width, canvas.height) * 0.35;
  const project = (state: CameraState) => {
    const x = anchorX - state.x;
    const y = -state.y;
    const angle = (-state.rotate * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: state.scale * (x * cos - y * sin),
      y: state.scale * (x * sin + y * cos),
    };
  };
  const from = project(previous);
  const to = project(current);
  return {dx: to.x - from.x, dy: to.y - from.y};
};

/**
 * Full camera sample for a frame number: pose from the keyframes, optional handheld shake, translation velocity, and
 * apparent pan/zoom/roll velocity since the previous render frame. A pure function of `frame`.
 * @example const cam = cameraAt(frame, [{t: 0}, {t: 2, scale: 1.3}], {fps: 60, width: 1920, height: 1080});
 */
export const cameraAt = (frame: number, keyframes: readonly CameraKeyframe[], canvas: Canvas, options: CameraAtOptions = {}): CameraSample => {
  const time = frame / canvas.fps;
  const base = sampleCamera(keyframes, time);
  const prev = sampleCamera(keyframes, (frame - 1) / canvas.fps);
  const hh = options.handheld;
  const shake = hh ? handheld(time, hh === true ? {} : hh) : {x: 0, y: 0, rotate: 0};
  const delta = cameraScreenDelta(prev, base);
  const motion = cameraMotionDelta(prev, base, canvas);
  return {
    state: {x: base.x + shake.x, y: base.y + shake.y, scale: base.scale, rotate: base.rotate + shake.rotate},
    base,
    shake,
    delta,
    speed: Math.hypot(delta.dx, delta.dy),
    motion,
    motionSpeed: Math.hypot(motion.dx, motion.dy),
    time,
    canvas,
  };
};
