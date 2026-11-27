/**
 * iOS-style motion primitives (SwiftUI-like critically-damped springs, no hard overshoot).
 *
 * Moved here from src/video4/motion4.ts and made video-agnostic: time is in SECONDS, the frame rate is a
 * parameter (default 60) and nothing reads Remotion hooks. Every function is a pure function of its numeric
 * arguments, so it is safe in Remotion's parallel renderer. src/video4/motion4.ts re-exports these with
 * frame-based adapters so video 4 keeps working unchanged.
 */
import type {CSSProperties} from 'react';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const EPS = 1e-9;

/** Default frame rate used when a function needs one and none is passed. */
export const DEFAULT_FPS = 60;

/**
 * CSS-style cubic-bezier easing as a function x(0..1) -> y(0..1), solved with Newton-Raphson + bisection fallback.
 * @example const ease = cubicBezier(0.32, 0.72, 0, 1); ease(0.5);
 */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number): ((x: number) => number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
};

/**
 * iOS spring parameterised by `response` (seconds). Without `bounce`, it stays critically damped and monotonic.
 * Underdamped mode uses damping ratio `1 - 2 * bounce`; values are capped at 0.4 so the tail remains bounded.
 * @param t seconds since the spring started
 * @param response seconds to settle
 * @param options optional underdamped motion; `bounce` is between 0 and 0.4
 * @example iosSpring(0.25, 0.5) // ~0.54
 */
export interface SpringOptions {
  /** 0 is critically damped; larger values add overshoot, up to 0.4. */
  bounce?: number;
}

export const iosSpring = (t: number, response: number, options?: SpringOptions): number => {
  const bounce = options?.bounce ?? 0;
  if (!Number.isFinite(bounce) || bounce < 0 || bounce > 0.4) throw new RangeError('iosSpring: bounce must be between 0 and 0.4');
  if (bounce > 0 && (!Number.isFinite(response) || response <= 0)) throw new RangeError('iosSpring: response must be > 0');
  if (t <= 0) return 0;
  const w = (2 * Math.PI) / response;
  if (bounce > 0) {
    const damping = 1 - 2 * bounce;
    const wd = w * Math.sqrt(1 - damping * damping);
    const ratio = damping / Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ratio * Math.sin(wd * t));
  }
  return 1 - (1 + w * t) * Math.exp(-w * t);
};

/** Named spring response times in seconds. */
export const SPRING = {
  /** Default feel for most enters/exits. */
  SMOOTH: 0.5,
  /** Slower, for big or heavy elements (cards, camera). */
  GENTLE: 0.7,
  /** Quicker, for small chips/labels/ticks. */
  SNAPPY: 0.4,
} as const;

/** A spring preset with a restrained underdamped landing for large visual hits. */
export const SPRING_PRESETS = {
  hero: {response: 0.8, bounce: 0.15},
} as const;

/**
 * iOS system ease curve (close to UIKit's default) for fixed-duration moves.
 * @example iosEase(0.5)
 */
export const iosEase = cubicBezier(0.32, 0.72, 0, 1);

/** Result of enter()/leave(): everything needed to style one element for one frame. */
export interface EnterState {
  opacity: number;
  /** px, downward-positive translateY. */
  y: number;
  scale: number;
  /** px Gaussian blur radius (per-element, max 8). */
  blur: number;
  /** px travelled on y since the previous frame (signed, negative = up). Feed to gatedTravelBlur()/travelBlur(). */
  vy: number;
}

const ENTER_MOVE_PX = 18;
const ENTER_SCALE_FROM = 0.96;
const ENTER_BLUR_FROM_PX = 8;
const LEAVE_MOVE_PX = ENTER_MOVE_PX;
const LEAVE_SCALE_TO = 1.02;
const LEAVE_BLUR_TO_PX = ENTER_BLUR_FROM_PX;

/**
 * Standard "enter": fade in, rise 18px, scale 0.96 -> 1, blur 8 -> 0px, on an iOS spring.
 * @param time current time in seconds
 * @param start second the enter begins
 * @param response spring response in seconds (default SPRING.SMOOTH)
 * @param fps frame rate, used only to derive `vy` (per-frame travel); default 60
 * @example const s = enter(frame / fps, 1.2, SPRING.SNAPPY, fps); <div style={enterStyle(s)} />
 */
export const enter = (time: number, start: number, response: number = SPRING.SMOOTH, fps: number = DEFAULT_FPS): EnterState => {
  const elapsed = time - start;
  if (elapsed <= EPS) {
    return {opacity: 0, y: ENTER_MOVE_PX, scale: ENTER_SCALE_FROM, blur: ENTER_BLUR_FROM_PX, vy: 0};
  }
  const p = iosSpring(elapsed, response);
  const y = (1 - p) * ENTER_MOVE_PX;
  const prev = elapsed - 1 / fps;
  const yPrev = prev <= EPS ? ENTER_MOVE_PX : (1 - iosSpring(prev, response)) * ENTER_MOVE_PX;
  return {opacity: p, y, scale: ENTER_SCALE_FROM + (1 - ENTER_SCALE_FROM) * p, blur: (1 - p) * ENTER_BLUR_FROM_PX, vy: y - yPrev};
};

/**
 * Standard "leave": keeps moving the way it was going (continues up, scale 1 -> 1.02, blur 0 -> 8px, fade out).
 * Before `exit` it returns the settled state.
 * @example const s = leave(frame / fps, 4.0, SPRING.SMOOTH, fps);
 */
export const leave = (time: number, exit: number, response: number = SPRING.SMOOTH, fps: number = DEFAULT_FPS): EnterState => {
  const elapsed = time - exit;
  if (elapsed <= EPS) return {opacity: 1, y: 0, scale: 1, blur: 0, vy: 0};
  const p = iosSpring(elapsed, response);
  const y = -p * LEAVE_MOVE_PX;
  const prev = elapsed - 1 / fps;
  const yPrev = prev <= EPS ? 0 : -iosSpring(prev, response) * LEAVE_MOVE_PX;
  return {opacity: 1 - p, y, scale: 1 + p * (LEAVE_SCALE_TO - 1), blur: p * LEAVE_BLUR_TO_PX, vy: y - yPrev};
};

/**
 * Slow ambient drift in [-1, 1].
 * @param time seconds
 * @example const x = idleDrift(frame / fps, 24) * 40;
 */
export const idleDrift = (time: number, periodSeconds: number = 24): number => Math.sin((2 * Math.PI * time) / periodSeconds);

/**
 * "Breathing" scale multiplier in [1-amplitude, 1+amplitude].
 * @example transform: `scale(${heartbeat(frame / fps)})`
 */
export const heartbeat = (time: number, periodSeconds: number = 2, amplitude: number = 0.015): number =>
  1 + amplitude * Math.sin((2 * Math.PI * time) / periodSeconds);

/**
 * Periodic pulse in [0, 1]: rises over the first half of `pulseSeconds`, falls over the second, rests until the
 * next `cadenceSeconds` window.
 * @example const glow = microEvent(frame / fps, 2.5, 0.3);
 */
export const microEvent = (time: number, cadenceSeconds: number = 2.5, pulseSeconds: number = 0.3): number => {
  const phase = ((time % cadenceSeconds) + cadenceSeconds) % cadenceSeconds;
  if (phase >= pulseSeconds) return 0;
  const half = pulseSeconds / 2;
  const response = Math.max(half, 0.001);
  const norm = iosSpring(half, response) || 1;
  if (phase <= half) return clamp01(iosSpring(phase, response) / norm);
  return clamp01(1 - iosSpring(phase - half, response) / norm);
};

/** Design frame rate that directional-blur lengths were tuned against (30 fps). */
const BLUR_DESIGN_FPS = 30;

/**
 * px moved per render frame -> the dx/dy units a directional blur (e.g. <MotionBlur>) expects. Scales with fps so
 * the same on-screen speed gives the same blur at 30 and 60 fps.
 * @example travelBlur(s.vy, 60)
 */
export const travelBlur = (pxPerFrame: number, fps: number = DEFAULT_FPS): number => pxPerFrame * (fps / BLUR_DESIGN_FPS);

/** Minimum speed (px/frame) below which per-element directional blur is skipped. */
export const DIRECTIONAL_BLUR_MIN_SPEED = 1;

/**
 * Like travelBlur, but returns 0 unless the element moves faster than 1px/frame (perf rule: no directional blur on
 * slow moves).
 * @example const len = gatedTravelBlur(s.vy, fps); if (len > 0) { ...render blur... }
 */
export const gatedTravelBlur = (pxPerFrame: number, fps: number = DEFAULT_FPS): number =>
  Math.abs(pxPerFrame) > DIRECTIONAL_BLUR_MIN_SPEED ? travelBlur(pxPerFrame, fps) : 0;

/**
 * EnterState -> inline style patch (opacity + transform + per-element blur filter).
 * @example <div style={enterStyle(enter(t, 0.5))} />
 */
export const enterStyle = (s: EnterState): CSSProperties => ({
  opacity: s.opacity,
  transform: `translateY(${s.y}px) scale(${s.scale})`,
  filter: s.blur > 0.01 ? `blur(${s.blur}px)` : undefined,
});

/**
 * Delay for the `index`-th item of a staggered group, in seconds.
 * @example enter(t, 1 + staggerDelay(i, 0.13))
 */
export const staggerDelay = (index: number, gapSeconds: number = 0.15): number => index * gapSeconds;
