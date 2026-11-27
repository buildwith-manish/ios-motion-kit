import type {Canvas} from './types';

/**
 * Ready-made canvases. Use as `createTheme({canvas: CANVAS.vertical60})`.
 * @example const theme = createTheme({canvas: CANVAS.landscape30});
 */
export const CANVAS = {
  landscape60: {fps: 60, width: 1920, height: 1080},
  landscape30: {fps: 30, width: 1920, height: 1080},
  vertical60: {fps: 60, width: 1080, height: 1920},
  vertical30: {fps: 30, width: 1080, height: 1920},
} as const satisfies Record<string, Canvas>;
