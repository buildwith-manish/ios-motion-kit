import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {idleDrift} from '../motion';
import type {Canvas, Theme} from '../tokens/types';
import {useKitCanvas} from './canvas';
import {clamp} from './math';

/** Default max tilt per axis, degrees. */
export const TILT_MAX_DEG = 6;

/** Slow idle sway added on top of the base tilt. */
export interface TiltSway {
  /** Peak extra rotateX, degrees. Default 1. */
  amplitudeX?: number;
  /** Peak extra rotateY, degrees. Default 1.5. */
  amplitudeY?: number;
  /** Seconds per cycle. Default 8. */
  periodSeconds?: number;
}

/**
 * Tilt angles at `time` seconds: base angle plus optional sway, clamped to +-`maxTilt`. Pure.
 * @example tiltAngles(1, 3, -2, {amplitudeY: 1}) // {rotateX, rotateY}, both inside +-6
 */
export const tiltAngles = (time: number, rotateX: number, rotateY: number, sway?: TiltSway, maxTilt: number = TILT_MAX_DEG): {rotateX: number; rotateY: number} => {
  const period = sway?.periodSeconds ?? 8;
  const sx = sway ? (sway.amplitudeX ?? 1) * idleDrift(time + period / 4, period) : 0;
  const sy = sway ? (sway.amplitudeY ?? 1.5) * idleDrift(time, period) : 0;
  return {rotateX: clamp(rotateX + sx, -maxTilt, maxTilt), rotateY: clamp(rotateY + sy, -maxTilt, maxTilt)};
};

/**
 * CSS for a perspective tilt: `perspective()` + rotateX/rotateY with an explicit transform-origin.
 * @example tiltStyle(3, -4) // {transform: 'perspective(1400px) rotateX(3deg) rotateY(-4deg)', transformOrigin: '50% 50%'}
 */
export const tiltStyle = (rotateX: number, rotateY: number, perspective = 1400, origin = '50% 50%'): CSSProperties => ({
  transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
  transformOrigin: origin,
});

/** Props for {@link Tilt3D}. */
export interface Tilt3DProps {
  /** Tilt about the horizontal axis, degrees. Positive tips the top edge away. Default 0. */
  rotateX?: number;
  /** Tilt about the vertical axis, degrees. Positive turns the right edge away. Default 0. */
  rotateY?: number;
  /** Clamp per axis, degrees. Default 6. */
  maxTilt?: number;
  /** Perspective distance, px. Default 1400 (subtle). */
  perspective?: number;
  /** CSS transform-origin. Default '50% 50%'. */
  origin?: string;
  /** Slow idle sway. Needs `frame`. */
  sway?: TiltSway;
  /** Frame number, only used for `sway`. */
  frame?: number;
  canvas?: Canvas;
  theme?: Theme;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Subtle 3D tilt for glass cards and device mockups. Wraps children in one element with `perspective()`,
 * rotateX/rotateY (<= 6 degrees by default) and an explicit transform-origin. Pure: no hooks on the clock.
 *
 * Note: tilted glass keeps its `backdrop-filter`; the tilt itself does not create a backdrop root.
 *
 * @example
 * <Tilt3D rotateX={3} rotateY={-5} sway={{periodSeconds: 10}} frame={frame}>
 *   <Glass tier="card" width={520} height={320} />
 * </Tilt3D>
 */
export const Tilt3D: React.FC<Tilt3DProps> = ({rotateX = 0, rotateY = 0, maxTilt = TILT_MAX_DEG, perspective = 1400, origin = '50% 50%', sway, frame, canvas, theme, width, height, style, children}) => {
  const cv = useKitCanvas(canvas, theme);
  const time = frame !== undefined ? frame / cv.fps : 0;
  const a = tiltAngles(time, rotateX, rotateY, frame !== undefined ? sway : undefined, maxTilt);
  return <div style={{width, height, position: 'relative', ...tiltStyle(a.rotateX, a.rotateY, perspective, origin), ...style}}>{children}</div>;
};
