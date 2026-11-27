import {useCurrentFrame} from 'remotion';
import type {Canvas, Theme} from '../tokens/types';
import {useKitCanvas} from './canvas';
import {cameraAt, type CameraAtOptions} from './sample';
import type {CameraKeyframe, CameraSample} from './types';

/**
 * Thin optional hook: camera sample for the current Remotion frame. Everything else in the camera kit takes `frame`
 * as a prop; use this only at the composition level.
 * @example const cam = useCameraSample(keyframes, {handheld: true});
 */
export const useCameraSample = (keyframes: readonly CameraKeyframe[], options: CameraAtOptions & {canvas?: Canvas; theme?: Theme} = {}): CameraSample => {
  const frame = useCurrentFrame();
  const canvas = useKitCanvas(options.canvas, options.theme);
  return cameraAt(frame, keyframes, canvas, options);
};
