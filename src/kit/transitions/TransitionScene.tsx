import React from 'react';
import {radius, type Theme} from '../tokens';
import {TransitionLayer} from './Layer';
import {MatchedContext, MatchedOverlay, type MatchedRegistry} from './Matched';
import {defaultDirection, getTransition, type TransitionOptionsByKind} from './effects';
import {transitionProgress} from './progress';
import type {Direction, LayerState, MotionBlurOption, TransitionKind} from './types';

/** Props for {@link TransitionScene}. */
export interface TransitionSceneProps {
  /** Current frame (a plain number; this component never reads the clock). */
  frame: number;
  /** Kit theme: canvas size/fps, backdrop colour, font, sheet radius. */
  theme: Theme;
  kind: TransitionKind;
  /** Transition start, seconds. */
  start: number;
  /** Transition duration, seconds. */
  duration: number;
  /** Scene shown before and during the transition; unmounted when it ends. */
  outgoing: React.ReactNode;
  /** Scene revealed by the transition; stays mounted afterwards. */
  incoming: React.ReactNode;
  /** Direction of travel. Defaults per kind (push 'left', sheet 'up', wipeMask 'right'). */
  direction?: Direction;
  /** Spring response in seconds (default 0.95 x duration). */
  response?: number;
  /** 'spring' (default) or 'ease' (iosEase over the duration). */
  curve?: 'spring' | 'ease';
  /** Optional directional motion blur on the moving layer: true, or {shutter, cap}. Default off. */
  motionBlur?: MotionBlurOption;
  /** Per-kind tuning (parallax, maxBlur, softness, ...). */
  options?: TransitionOptionsByKind;
}

const REST: LayerState = {opacity: 1, tx: 0, ty: 0, scale: 1, blur: 0, dim: 0, radius: 0, shadow: 0};

/**
 * Scene-to-scene transition as a pure function of `frame`. Before `start` only the outgoing scene is mounted; during
 * the window both are; from `start + duration` on, only the incoming scene is (the outgoing is unmounted, its
 * opacity is 0 on the last frame). Spring progress is renormalised to land on exactly 1.
 * @example
 * <TransitionScene frame={frame} theme={theme} kind="push" start={1} duration={0.8} outgoing={<A />} incoming={<B />} motionBlur />
 */
export const TransitionScene: React.FC<TransitionSceneProps> = ({frame, theme, kind, start, duration, outgoing, incoming, direction, response, curve, motionBlur, options}) => {
  const {fps, width, height} = theme.canvas;
  const dir = direction ?? defaultDirection[kind];
  const timing = {curve, response};
  const t = frame / fps - start;
  const p = transitionProgress(frame, start, duration, fps, timing);
  const pPrev = transitionProgress(frame - 1, start, duration, fps, timing);
  const fn = getTransition(kind, {...options, sheet: {radius: radius(theme, 'xxl'), ...options?.sheet}});
  const ctx = {width, height, direction: dir};
  const cur = fn(p, ctx);
  const prev = fn(pPrev, ctx);

  const before = t <= 0;
  const after = t >= duration;
  const morphing = kind === 'matchedGeometry' && !before && !after;
  const registry: MatchedRegistry = {outgoing: new Map(), incoming: new Map()};

  const outState = before ? REST : cur.outgoing;
  const inState = after ? REST : cur.incoming;
  const showOut = !after && outState.opacity > 0.0005;
  const showIn = !before;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden', background: theme.colors.background.deep, fontFamily: theme.fonts.body}}>
      {showOut && (
        <MatchedContext.Provider key="out" value={{role: 'outgoing', morphing, registry}}>
          <TransitionLayer
            state={outState}
            vx={outState.tx - prev.outgoing.tx}
            vy={outState.ty - prev.outgoing.ty}
            motionBlur={before ? false : motionBlur}
            zIndex={cur.incomingOnTop ? 1 : 2}
          >
            {outgoing}
          </TransitionLayer>
        </MatchedContext.Provider>
      )}
      {showIn && (
        <MatchedContext.Provider key="in" value={{role: 'incoming', morphing, registry}}>
          <TransitionLayer
            state={inState}
            vx={inState.tx - prev.incoming.tx}
            vy={inState.ty - prev.incoming.ty}
            motionBlur={after ? false : motionBlur}
            zIndex={cur.incomingOnTop ? 2 : 1}
          >
            {incoming}
          </TransitionLayer>
        </MatchedContext.Provider>
      )}
      {morphing && <MatchedOverlay registry={registry} p={p} pPrev={pPrev} motionBlur={motionBlur} />}
    </div>
  );
};
