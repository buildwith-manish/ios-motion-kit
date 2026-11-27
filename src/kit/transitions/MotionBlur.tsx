import React, {useId} from 'react';
import {DIRECTIONAL_BLUR_MIN_SPEED} from '../motion';

/**
 * Blur travel (px) for a move of `pxPerFrame` on one axis. Returns 0 at or below `minSpeed`
 * (1 px/frame by default) so slow moves stay crisp. Pure.
 * @example motionBlurLength(24, 0.5, 20) // 12
 */
export const motionBlurLength = (pxPerFrame: number, shutter = 0.5, cap = 20, minSpeed = DIRECTIONAL_BLUR_MIN_SPEED): number => {
  const d = Math.abs(pxPerFrame);
  if (![d, shutter, cap, minSpeed].every(Number.isFinite) || d <= Math.max(0, minSpeed) || shutter <= 0) return 0;
  return Math.min(20, Math.max(0, cap), d * Math.min(1, shutter));
};

export interface DirectionalBlurVector {
  dx: number;
  dy: number;
  length: number;
}

/** Clamp a per-frame velocity vector to one along-path blur no longer than 20px. */
export const directionalBlurVector = (dx: number, dy: number, shutter = 0.5, cap = 20, minSpeed = DIRECTIONAL_BLUR_MIN_SPEED): DirectionalBlurVector => {
  const speed = Math.hypot(dx, dy);
  const limit = Math.max(0, Math.min(20, cap));
  if (![dx, dy, speed, shutter, cap, minSpeed].every(Number.isFinite) || speed <= Math.max(0, minSpeed) || shutter <= 0 || limit === 0) {
    return {dx: 0, dy: 0, length: 0};
  }
  const length = Math.min(limit, speed * Math.min(1, shutter));
  return {dx: (dx / speed) * length, dy: (dy / speed) * length, length};
};

/** Props for {@link MotionBlur}. */
export interface MotionBlurProps {
  /** px moved along x since the previous render frame. */
  dx?: number;
  /** px moved along y since the previous render frame. */
  dy?: number;
  /** Shutter, 0..1 (0.5 = 180 degrees). */
  shutter?: number;
  /** Max blur travel in px. Kept at 20 or below so no full-layer blur is expensive. */
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
  const vector = directionalBlurVector(dx, dy, shutter, cap, minSpeed);
  const blurring = vector.length > 0;
  const taps = 7;
  const samples = Array.from({length: taps}, (_, i) => {
    const position = i / (taps - 1) - 0.5;
    return {dx: vector.dx * position, dy: vector.dy * position};
  });
  return (
    <div style={blurring ? {...style, filter: `url(#${id})`} : style}>
      {children}
      {blurring && (
        <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
          <defs>
            <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              {samples.map((sample, i) => <feOffset key={`offset-${i}`} in="SourceGraphic" dx={sample.dx} dy={sample.dy} result={`sample-${i}`} />)}
              {samples.slice(1).map((_, i) => {
                const count = i + 2;
                return <feComposite key={`average-${count}`} in={count === 2 ? 'sample-0' : `average-${count - 1}`} in2={`sample-${count - 1}`} operator="arithmetic" k2={(count - 1) / count} k3={1 / count} result={`average-${count}`} />;
              })}
            </filter>
          </defs>
        </svg>
      )}
    </div>
  );
};
