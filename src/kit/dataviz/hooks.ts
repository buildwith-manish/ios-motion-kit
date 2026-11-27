/**
 * Thin optional hook wrappers. Primitives themselves never call Remotion hooks: they take `frame` or `progress`.
 * Use these only where you want the wrapper to read the clock for you.
 */
import {useCurrentFrame} from 'remotion';
import {SPRING} from '../motion';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {springProgress} from './common';

/**
 * Spring progress (0..1) for the current Remotion frame, starting at `startSeconds`.
 * @example const p = useSpringProgress(1.2); return <SpringBar progress={p} data={data} />;
 */
export const useSpringProgress = (startSeconds: number = 0, response: number = SPRING.GENTLE, theme?: Theme): number => {
  const frame = useCurrentFrame();
  const ctx = useTheme();
  const fps = (theme ?? ctx).canvas.fps;
  return springProgress(frame / fps - startSeconds, response);
};
