import {useTheme} from '../tokens/ThemeProvider';
import type {Canvas, Theme} from '../tokens/types';

/**
 * Resolve the canvas (fps, width, height) a camera primitive should use: an explicit `canvas` prop wins, then the
 * `theme` prop, then the nearest ThemeProvider. Reads React context only, never the Remotion clock.
 * @example const canvas = useKitCanvas(props.canvas, props.theme);
 */
export const useKitCanvas = (canvas?: Canvas, theme?: Theme): Canvas => {
  const ctx = useTheme();
  return canvas ?? (theme ?? ctx).canvas;
};
