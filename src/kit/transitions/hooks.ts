import {useCurrentFrame, useVideoConfig} from 'remotion';
import {transitionProgress, type TimingOptions} from './progress';

/**
 * Thin optional wrapper: transition progress for the current Remotion frame. The kit primitives themselves never call
 * this; they take `frame` as a prop.
 * @example const p = useTransitionProgress(1, 0.8); // progress of a 0.8s transition starting at 1s
 */
export const useTransitionProgress = (startSeconds: number, durationSeconds: number, timing?: TimingOptions): number => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return transitionProgress(frame, startSeconds, durationSeconds, fps, timing);
};
