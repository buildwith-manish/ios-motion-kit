import type {Canvas} from '../tokens/types';
import {cameraScreenDelta, sampleCamera} from './keyframes';
import {handheld, type HandheldOptions} from './handheld';
import type {CameraKeyframe, CameraSample} from './types';

/** Options for {@link cameraAt}. */
export interface CameraAtOptions {
  /** Add deterministic handheld shake. `true` = defaults. Default off. */
  handheld?: boolean | HandheldOptions;
}

/**
 * Full camera sample for a frame number: pose from the keyframes, optional handheld shake, and the on-screen
 * velocity since the previous render frame. A pure function of `frame`; time is `frame / canvas.fps`.
 * @example const cam = cameraAt(frame, [{t: 0}, {t: 2, scale: 1.3}], {fps: 60, width: 1920, height: 1080});
 */
export const cameraAt = (frame: number, keyframes: readonly CameraKeyframe[], canvas: Canvas, options: CameraAtOptions = {}): CameraSample => {
  const time = frame / canvas.fps;
  const base = sampleCamera(keyframes, time);
  const prev = sampleCamera(keyframes, (frame - 1) / canvas.fps);
  const hh = options.handheld;
  const shake = hh ? handheld(time, hh === true ? {} : hh) : {x: 0, y: 0, rotate: 0};
  const delta = cameraScreenDelta(prev, base);
  return {
    state: {x: base.x + shake.x, y: base.y + shake.y, scale: base.scale, rotate: base.rotate + shake.rotate},
    base,
    shake,
    delta,
    speed: Math.hypot(delta.dx, delta.dy),
    time,
    canvas,
  };
};
