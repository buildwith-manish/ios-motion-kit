import React from 'react';
import type {CSSProperties, ReactElement, ReactNode} from 'react';
import {idleDrift} from '../motion';
import type {Canvas, Theme} from '../tokens/types';
import {useKitCanvas} from './canvas';
import {clamp} from './math';
import type {CameraState} from './types';

/** Slow idle drift (replaces SlowPush-style wrappers). */
export interface DepthIdle {
  /** Peak extra translation at depth 1 vs the focus plane, px. Default 14. */
  amplitude?: number;
  /** Seconds per drift cycle. Default 24. */
  periodSeconds?: number;
  /** Peak extra scale at depth 1 vs the focus plane (0.01 = 1%). Default 0.01. */
  scale?: number;
}

/** Layer offset for one depth. */
export interface DepthTransform {
  x: number;
  y: number;
  scale: number;
}

/** Parallax settings shared by {@link depthTransform} and {@link DepthLayers}. */
export interface DepthOptions {
  /** How strongly pan separates the layers. 0 = none, 1 = near layer moves 2x, far layer stands still. Default 0.5. */
  parallax?: number;
  /** How strongly zoom separates the layers. Default 0.35. */
  zoomParallax?: number;
  /** Depth that moves exactly with the rig (the reference plane). Default 0.5. */
  focusDepth?: number;
}

/**
 * Extra transform for a layer at `depth` (0 far .. 1 near), given the camera pose and optional idle drift. The rig
 * already moves the whole world; this adds the difference: layers nearer than `focusDepth` move more, farther
 * layers less. With no camera and no idle, returns the identity. Pure.
 * @example depthTransform(1, {x: 200, y: 0, scale: 1.2, rotate: 0}, 3.5) // near layer: shifted left, a touch bigger
 */
export const depthTransform = (depth: number, camera: CameraState | undefined, time: number, idle?: DepthIdle, options: DepthOptions = {}): DepthTransform => {
  const d = clamp(depth, 0, 1);
  const focus = options.focusDepth ?? 0.5;
  const parallax = options.parallax ?? 0.5;
  const zoomParallax = options.zoomParallax ?? 0.35;
  const rel = d - focus;
  let x = 0;
  let y = 0;
  let scale = 1;
  if (camera) {
    // world already moves by -camera; a nearer layer should move by -camera * (1 + k), a farther one by -camera * (1 - k)
    x += -camera.x * rel * parallax * 2;
    y += -camera.y * rel * parallax * 2;
    scale *= Math.exp(Math.log(camera.scale) * rel * zoomParallax * 2);
  }
  if (idle) {
    const period = idle.periodSeconds ?? 24;
    const amp = idle.amplitude ?? 14;
    x += amp * rel * 2 * idleDrift(time, period);
    y += amp * rel * 2 * 0.6 * idleDrift(time + period / 4, period * 1.31);
    scale *= 1 + (idle.scale ?? 0.01) * rel * 2 * idleDrift(time, period * 0.77);
  }
  return {x, y, scale};
};

/** Props for {@link DepthLayer}. */
export interface DepthLayerProps {
  /** 0 = far, 1 = near. */
  depth: number;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Marker wrapper that carries a `depth`. Renders a plain full-size element; {@link DepthLayers} reads the `depth`.
 * @example <DepthLayer depth={0.8}><Glass tier="card" /></DepthLayer>
 */
export const DepthLayer: React.FC<DepthLayerProps> = ({style, children}) => <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;

/** Props for {@link DepthLayers}. */
export interface DepthLayersProps extends DepthOptions {
  /** Camera pose from the rig (`cam.state`). Omit for idle-only drift. */
  camera?: CameraState;
  /** Frame number, used for idle drift. */
  frame?: number;
  /** Slow idle drift. `true` = defaults. Default off. */
  idle?: boolean | DepthIdle;
  canvas?: Canvas;
  theme?: Theme;
  style?: CSSProperties;
  /** Children with a `depth` prop (0 far .. 1 near); children without one use `focusDepth`. */
  children?: ReactNode;
}

/**
 * 2.5D parallax. Every child is wrapped in one full-size layer that is offset and scaled by the child's `depth`
 * prop (0 = far, 1 = near) from the rig's pan and zoom and/or a slow idle drift. Put it inside `<CameraRig>`
 * (via the render-prop) so one move drives every layer; this replaces nested SlowPush wrappers. Pure.
 *
 * @example
 * <CameraRig frame={frame} keyframes={kf}>
 *   {(cam) => (
 *     <DepthLayers camera={cam.state} frame={frame} idle>
 *       <DepthLayer depth={0}><Backdrop /></DepthLayer>
 *       <DepthLayer depth={0.8}><Card /></DepthLayer>
 *     </DepthLayers>
 *   )}
 * </CameraRig>
 */
export const DepthLayers: React.FC<DepthLayersProps> = ({camera, frame, idle, canvas, theme, style, children, parallax, zoomParallax, focusDepth}) => {
  const cv = useKitCanvas(canvas, theme);
  const time = frame !== undefined ? frame / cv.fps : 0;
  const idleOpts = idle && frame !== undefined ? (idle === true ? {} : idle) : undefined;
  const fd = focusDepth ?? 0.5;
  return (
    <div style={{position: 'absolute', inset: 0, ...style}}>
      {React.Children.map(children, (child, i) => {
        const depth = React.isValidElement(child) && typeof (child as ReactElement<{depth?: number}>).props.depth === 'number' ? (child as ReactElement<{depth: number}>).props.depth : fd;
        const t = depthTransform(depth, camera, time, idleOpts, {parallax, zoomParallax, focusDepth});
        return (
          <div key={i} style={{position: 'absolute', inset: 0, transformOrigin: '50% 50%', transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`}}>
            {child}
          </div>
        );
      })}
    </div>
  );
};
