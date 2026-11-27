import {iosEase, iosSpring} from '../motion';
import {clamp01} from './math';

/** How a transition's 0..1 progress is shaped over its duration. */
export interface TimingOptions {
  /** 'spring' (default): iOS critically-damped spring. 'ease': iosEase over the duration. */
  curve?: 'spring' | 'ease';
  /** Spring response in seconds. Default: 0.95 x duration (lets the spring spend the whole window). */
  response?: number;
}

/**
 * Progress 0..1 of a transition at `frame`. The spring is renormalised so it lands on exactly 1 at the end of the
 * window (a raw spring only approaches 1), which is what guarantees the outgoing scene is fully gone. Pure; time is in
 * seconds, converted with `fps`.
 * @example transitionProgress(90, 1.0, 0.8, 60, {curve: 'spring'}) // progress at frame 90 of a 0.8s transition starting at 1.0s
 */
export const transitionProgress = (frame: number, startSeconds: number, durationSeconds: number, fps: number, timing: TimingOptions = {}): number => {
  const t = frame / fps - startSeconds;
  if (t <= 0) return 0;
  if (t >= durationSeconds) return 1;
  if (timing.curve === 'ease') return iosEase(t / durationSeconds);
  const response = timing.response ?? durationSeconds * 0.95;
  const end = iosSpring(durationSeconds, response);
  return clamp01(iosSpring(t, response) / end);
};
