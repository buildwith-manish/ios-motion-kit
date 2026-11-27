import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {DIRECTIONAL_BLUR_MIN_SPEED} from '../motion';
import type {Canvas, Theme} from '../tokens/types';
import {MotionBlur} from '../transitions/MotionBlur';
import {useKitCanvas} from './canvas';
import {cameraAt} from './sample';
import {cameraTransform} from './keyframes';
import type {HandheldOptions} from './handheld';
import type {CameraKeyframe, CameraSample} from './types';

/** Hard cap on camera motion-blur travel, px (full-layer blur stays <= 20px). */
export const CAMERA_BLUR_CAP = 20;

/** Options for camera motion blur. */
export interface CameraMotionBlurOptions {
  /** Apparent picture speed in px/frame above which blur starts (never below 1), including pan/zoom/roll. Default 3. */
  threshold?: number;
  /** Shutter, 0..1 (0.5 = 180 degrees). Default 0.5. */
  shutter?: number;
  /** Max blur travel in px, clamped to {@link CAMERA_BLUR_CAP}. Default 14. */
  cap?: number;
}

/**
 * Blur travel (px) for a camera moving `speed` px/frame: 0 up to `threshold`, then ramps from 0 (no pop at the
 * threshold) at `shutter` px of blur per extra px/frame, capped. Pure.
 * @example cameraBlurLength(13, {threshold: 3, shutter: 0.5}) // 5
 */
export const cameraBlurLength = (speed: number, options: CameraMotionBlurOptions = {}): number => {
  const threshold = Math.max(DIRECTIONAL_BLUR_MIN_SPEED, options.threshold ?? 3);
  const shutter = options.shutter ?? 0.5;
  const cap = Math.min(CAMERA_BLUR_CAP, options.cap ?? 14);
  if (speed <= threshold) return 0;
  return Math.min(cap, (speed - threshold) * shutter);
};

/** Props for {@link CameraRig}. */
export interface CameraRigProps {
  /** Current frame number, passed in (never read from a hook here). */
  frame: number;
  /** Keyframes, times in seconds. */
  keyframes: readonly CameraKeyframe[];
  /** Canvas override (fps, width, height). Default: `theme.canvas`, else the nearest ThemeProvider's. */
  canvas?: Canvas;
  theme?: Theme;
  /** Deterministic handheld shake (<= 2px, <= 0.15 deg). Default off. */
  handheld?: boolean | HandheldOptions;
  /** Camera motion blur from the rig's velocity, only above a speed threshold. Default off; see README for cost. */
  motionBlur?: boolean | CameraMotionBlurOptions;
  /** Clip the world to the canvas. Default true. */
  clip?: boolean;
  style?: CSSProperties;
  /** The world. Either nodes, or a function that receives the {@link CameraSample} (to feed `<DepthLayers camera>`). */
  children?: ReactNode | ((cam: CameraSample) => ReactNode);
}

/**
 * 2D camera: pan, zoom and roll between keyframes (seconds), each segment eased (`iosEase` by default). Wraps the
 * world in one transformed element; optional handheld shake and optional velocity-gated motion blur. A pure function
 * of `frame`; no clock hooks.
 *
 * Keep the world larger than the canvas where the camera will pan or zoom out, or the edges will show.
 *
 * @example
 * <CameraRig frame={frame} theme={theme} keyframes={[{t: 0, x: -200}, {t: 2, x: 200, scale: 1.3, ease: 'spring'}]}>
 *   {(cam) => <DepthLayers camera={cam.state} frame={frame}>...</DepthLayers>}
 * </CameraRig>
 */
export const CameraRig: React.FC<CameraRigProps> = ({frame, keyframes, canvas, theme, handheld, motionBlur, clip = true, style, children}) => {
  const cv = useKitCanvas(canvas, theme);
  const cam = cameraAt(frame, keyframes, cv, {handheld});
  const mb = motionBlur ? (motionBlur === true ? {} : motionBlur) : null;
  let bdx = 0;
  let bdy = 0;
  if (mb) {
    const len = cameraBlurLength(cam.motionSpeed, mb);
    if (len > 0) {
      bdx = (cam.motion.dx / cam.motionSpeed) * len;
      bdy = (cam.motion.dy / cam.motionSpeed) * len;
    }
  }
  const content = typeof children === 'function' ? children(cam) : children;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: clip ? 'hidden' : 'visible', ...style}}>
      {/* shutter 1 / minSpeed 0: bdx, bdy are already the blur length in px (see cameraBlurLength). */}
      <MotionBlur dx={bdx} dy={bdy} shutter={1} minSpeed={0} cap={CAMERA_BLUR_CAP} idPrefix="kcam" style={{position: 'absolute', inset: 0}}>
        <div style={{position: 'absolute', inset: 0, transformOrigin: '50% 50%', transform: cameraTransform(cam.state)}}>{content}</div>
      </MotionBlur>
    </div>
  );
};
