import type React from 'react';
import {iosSpring} from '../motion';

/** Motion of one text unit (word, line or character). */
export interface UnitMotion {
  /** Spring response in seconds. */
  response: number;
  /** Rise distance in px (canvas px). */
  rise: number;
  /** Starting blur radius in px (per element, max 8 recommended). */
  blur: number;
  /** Starting scale (1 = none). */
  scale: number;
  /** Fade faster than the move (used with the overflow mask, where the clip hides the rise). */
  fastFade?: boolean;
}

/** State of one unit for one frame. */
export interface UnitState {
  opacity: number;
  /** px, downward-positive. */
  y: number;
  scale: number;
  blur: number;
}

/**
 * Standard text-unit enter on an iOS spring: opacity 0 -> 1, rises `rise` px, blur `blur` -> 0, optional scale.
 * Same curve as kit `enter()`, but with configurable rise/blur because titles want 12-24 px, not a fixed 18.
 * @param time current time, seconds
 * @param start second this unit begins
 * @example const s = unitEnter(frame / fps, 1.0, {response: 0.5, rise: 18, blur: 8, scale: 1});
 */
export const unitEnter = (time: number, start: number, m: UnitMotion): UnitState => {
  const e = time - start;
  if (e <= 0) return {opacity: 0, y: m.rise, scale: m.scale, blur: m.blur};
  const p = iosSpring(e, m.response);
  return {
    opacity: m.fastFade ? Math.min(1, p * 2.5) : p,
    y: (1 - p) * m.rise,
    scale: m.scale + (1 - m.scale) * p,
    blur: (1 - p) * m.blur,
  };
};

/** Fully settled state. */
export const SETTLED: UnitState = {opacity: 1, y: 0, scale: 1, blur: 0};

/**
 * UnitState -> CSS patch (translate, scale, blur only when visible).
 * @example <span style={unitStyle(s)}>word</span>
 */
export const unitStyle = (s: UnitState): React.CSSProperties => ({
  opacity: s.opacity,
  transform: s.y === 0 && s.scale === 1 ? undefined : `translate3d(0, ${s.y}px, 0)${s.scale === 1 ? '' : ` scale(${s.scale})`}`,
  filter: s.blur > 0.05 ? `blur(${s.blur}px)` : undefined,
});
