import type {Canvas} from '../tokens/types';
import type {CameraState} from './types';

/** Canvas-space rectangle, with x/y at its top-left. */
export interface CameraRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LookAtOptions {
  canvas: Canvas;
  /** Explicit zoom; otherwise fit the whole rectangle within the canvas and padding. */
  zoom?: number;
  /** Minimum free margin around a fitted rectangle, in canvas pixels. */
  padding?: number;
  /** Rectangles indexed by element id, keeping id-based lookups deterministic and server-safe. */
  elementRects?: Readonly<Record<string, CameraRect>>;
}

/** Resolve a canvas rectangle (or a supplied element id) to a camera target keyframe. */
export const lookAt = (
  target: CameraRect | string,
  {canvas, zoom, padding = 0, elementRects}: LookAtOptions,
): Pick<CameraState, 'x' | 'y' | 'scale'> => {
  const rect = typeof target === 'string' ? elementRects?.[target] : target;
  if (!rect) throw new Error(`lookAt: no rectangle provided for element id "${target}"`);
  if (![rect.x, rect.y, rect.width, rect.height, canvas.width, canvas.height, padding].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0 || padding < 0) {
    throw new RangeError('lookAt: rectangle, canvas, and padding must be finite and positive');
  }
  const availableWidth = canvas.width - 2 * padding;
  const availableHeight = canvas.height - 2 * padding;
  if (availableWidth <= 0 || availableHeight <= 0) throw new RangeError('lookAt: padding leaves no available canvas area');
  const scale = zoom ?? Math.min(availableWidth / rect.width, availableHeight / rect.height);
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('lookAt: zoom must be finite and > 0');
  return {
    x: rect.x + rect.width / 2 - canvas.width / 2,
    y: rect.y + rect.height / 2 - canvas.height / 2,
    scale,
  };
};
