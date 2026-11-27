import React from 'react';
import {SCRIM_COLOR, SHADOW_COLOR} from './style';
import {MotionBlur} from './MotionBlur';
import type {LayerState, MotionBlurOption} from './types';

const parseBlur = (o: MotionBlurOption | undefined): {on: boolean; shutter: number; cap: number} => {
  if (!o) return {on: false, shutter: 0.5, cap: 20};
  if (o === true) return {on: true, shutter: 0.5, cap: 20};
  return {on: true, shutter: o.shutter ?? 0.5, cap: Math.min(20, o.cap ?? 20)};
};

/** Props for {@link TransitionLayer}. */
export interface TransitionLayerProps {
  state: LayerState;
  /** px per render frame the layer moved on x since the previous frame (for optional directional blur). */
  vx?: number;
  /** px per render frame on y. */
  vy?: number;
  motionBlur?: MotionBlurOption;
  zIndex?: number;
  children?: React.ReactNode;
}

/**
 * Pure renderer for one scene layer: transform, opacity, Gaussian blur (<= 20px), scrim, radius, shadow and mask from a
 * {@link LayerState}. Directional motion blur wraps only this moving layer, and only when its speed is > 1 px/frame.
 * @example <TransitionLayer state={layers.incoming} vx={12} motionBlur>{scene}</TransitionLayer>
 */
export const TransitionLayer: React.FC<TransitionLayerProps> = ({state, vx = 0, vy = 0, motionBlur, zIndex = 0, children}) => {
  const mb = parseBlur(motionBlur);
  const s = state;
  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    opacity: s.opacity,
    transform: `translate3d(${s.tx}px, ${s.ty}px, 0) scale(${s.scale})`,
    transformOrigin: '50% 50%',
    filter: s.blur > 0.1 ? `blur(${Math.min(20, s.blur)}px)` : undefined,
    borderRadius: s.radius > 0 ? s.radius : undefined,
    overflow: s.radius > 0 ? 'hidden' : undefined,
    boxShadow: s.shadow > 0.001 ? `0 -12px 60px ${SHADOW_COLOR}` : undefined,
    WebkitMaskImage: s.mask,
    maskImage: s.mask,
  };
  return (
    <MotionBlur dx={mb.on ? vx : 0} dy={mb.on ? vy : 0} shutter={mb.shutter} cap={mb.cap} style={{position: 'absolute', inset: 0, zIndex}}>
      <div style={style}>
        {children}
        {s.dim > 0.001 && <div style={{position: 'absolute', inset: 0, background: SCRIM_COLOR, opacity: s.dim, pointerEvents: 'none'}} />}
      </div>
    </MotionBlur>
  );
};
