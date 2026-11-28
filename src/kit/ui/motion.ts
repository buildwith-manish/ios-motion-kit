import type {CSSProperties} from 'react';
import {iosSpring} from '../motion';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';

export interface UIMotionProps {
  frame: number;
  start: number;
  end?: number;
  response?: number;
  theme?: Theme;
  style?: CSSProperties;
  className?: string;
}

export interface UIMotionState {
  time: number;
  enter: number;
  exit: number;
  opacity: number;
  y: number;
  scale: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const springProgress = (time: number, at: number, response: number): number => {
  if (!Number.isFinite(time) || !Number.isFinite(at) || !Number.isFinite(response) || response <= 0) {
    throw new RangeError('Spring progress requires finite time/at and a positive response');
  }
  return clamp01(iosSpring(time - at, response));
};

export const uiMotionAt = (frame: number, fps: number, start: number, end?: number, response = 0.5): UIMotionState => {
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0 || !Number.isFinite(start) || !Number.isFinite(response) || response <= 0) {
    throw new RangeError('UI motion requires finite frame/start and positive fps/response');
  }
  if (end !== undefined && (!Number.isFinite(end) || end < start)) throw new RangeError('UI motion end must be finite and no earlier than start');
  const time = frame / fps;
  const enter = springProgress(time, start, response);
  const exit = end === undefined ? 0 : springProgress(time, end, response);
  return {
    time,
    enter,
    exit,
    opacity: enter * (1 - exit),
    y: (1 - enter) * 16 + exit * 16,
    scale: 0.96 + enter * 0.04 - exit * 0.02,
  };
};

export const uiMotionStyle = (state: UIMotionState): CSSProperties => ({
  opacity: state.opacity,
  transform: `translate3d(0, ${state.y}px, 0) scale(${state.scale})`,
});

export const useUIMotion = (props: UIMotionProps): {theme: Theme; motion: UIMotionState} => {
  const contextTheme = useTheme();
  const theme = props.theme ?? contextTheme;
  return {
    theme,
    motion: uiMotionAt(props.frame, theme.canvas.fps, props.start, props.end, props.response ?? theme.motion.spring.SMOOTH),
  };
};
