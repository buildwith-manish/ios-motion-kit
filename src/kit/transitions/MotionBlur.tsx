import React, {useId} from 'react';
import {DIRECTIONAL_BLUR_MIN_SPEED} from '../motion';

/**
 * Blur length (Gaussian sigma, px) for a move of `pxPerFrame` on one axis. Returns 0 at or below `minSpeed`
 * (1 px/frame by default) so slow moves stay crisp. Pure.
 * @example motionBlurLength(24, 0.5, 20) // 12
 */
export const motionBlurLength = (pxPerFrame: number, shutter = 0.5, cap = 20, minSpeed = DIRECTIONAL_BLUR_MIN_SPEED): number => {
  const d = Math.abs(pxPerFrame);
  if (d <= minSpeed) return 0;
  return Math.min(cap, d * shutter);
};

/** Props for {@link MotionBlur}. */
export interface MotionBlurProps {
  /** px moved along x since the previous render frame. */
  dx?: number;
  /** px moved along y since the previous render frame. */
  dy?: number;
  /** Shutter, 0..1 (0.5 = 180 degrees). */
  shutter?: number;
  /** Max blur sigma in px. Kept at 20 or below so no full-layer blur is expensive. */
  cap?: number;
  /** Speed (px/frame) at or below which nothing is drawn. */
  minSpeed?: number;
  /** Optional filter-id prefix (the id also contains a React useId). */
  idPrefix?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Kit-local directional motion blur (same idea as src/components/MotionBlur.tsx, but takes px per *render* frame, has
 * no fps assumptions, and no Math.random). Blurs only along the direction of travel, only when speed > minSpeed.
 * The element tree has the same shape with or without blur (children never remount).
 * @example <MotionBlur dx={vx} dy={0} style={{position: 'absolute', inset: 0}}>{scene}</MotionBlur>
 */
export const MotionBlur: React.FC<MotionBlurProps> = ({dx = 0, dy = 0, shutter = 0.5, cap = 20, minSpeed = DIRECTIONAL_BLUR_MIN_SPEED, idPrefix = 'kmb', style, children}) => {
  const id = idPrefix + useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const bx = motionBlurLength(dx, shutter, cap, minSpeed);
  const by = motionBlurLength(dy, shutter, cap, minSpeed);
  const blurring = bx !== 0 || by !== 0;
  return (
    <div style={blurring ? {...style, filter: `url(#${id})`} : style}>
      {children}
      {blurring && (
        <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
          <defs>
            <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${bx} ${by}`} />
            </filter>
          </defs>
        </svg>
      )}
    </div>
  );
};
