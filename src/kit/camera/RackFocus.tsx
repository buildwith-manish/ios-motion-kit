import React from 'react';
import type {CSSProperties, ReactElement, ReactNode} from 'react';
import {iosSpring, SPRING} from '../motion';
import type {Canvas, Theme} from '../tokens/types';
import {useKitCanvas} from './canvas';
import {clamp} from './math';

/** Hard cap on rack-focus blur, px. */
export const RACK_BLUR_CAP = 20;
/** Below this many px the filter is not applied at all (so a settled layer is truly un-filtered). */
export const RACK_BLUR_EPSILON = 0.05;

/** Move focus to `layer` at time `t` (seconds). The first keyframe is the starting focus. */
export interface FocusKeyframe {
  t: number;
  layer: string;
}

/** Options for {@link rackBlur}. */
export interface RackOptions {
  /** Blur of an out-of-focus layer, px. Default 10, capped at {@link RACK_BLUR_CAP}. */
  maxBlur?: number;
  /** Spring response in seconds for each focus pull. Default `SPRING.GENTLE` (0.7). */
  response?: number;
}

/**
 * How sharp `layer` is at `time` seconds, 0 (fully defocused) .. 1 (in focus). Each keyframe after the first starts
 * a spring toward 1 for its layer and toward 0 for the others; a pull that interrupts another continues from
 * where the layer is, so there are no jumps. Pure.
 * @example rackSharpness(5, [{t: 0, layer: 'a'}, {t: 4, layer: 'b'}], 'b', 0.7) // ~0.99
 */
export const rackSharpness = (time: number, schedule: readonly FocusKeyframe[], layer: string, response: number = SPRING.GENTLE): number => {
  const ks = [...schedule].sort((a, b) => a.t - b.t);
  if (ks.length === 0) return 1;
  const init = ks[0].layer === layer ? 1 : 0;
  let anim: {from: number; target: number; t0: number} | null = null;
  const valueAt = (a: {from: number; target: number; t0: number}, tau: number): number => a.from + (a.target - a.from) * iosSpring(tau - a.t0, response);
  for (let i = 1; i < ks.length; i++) {
    const k = ks[i];
    if (time < k.t) break;
    const from: number = anim ? valueAt(anim, k.t) : init;
    anim = {from, target: k.layer === layer ? 1 : 0, t0: k.t};
  }
  return clamp(anim ? valueAt(anim, time) : init, 0, 1);
};

/**
 * Blur (px) of `layer` at `time` seconds for a focus schedule. 0 when in focus. Pure.
 * @example rackBlur(0, [{t: 0, layer: 'a'}, {t: 4, layer: 'b'}], 'b') // 10
 */
export const rackBlur = (time: number, schedule: readonly FocusKeyframe[], layer: string, options: RackOptions = {}): number => {
  const max = Math.min(RACK_BLUR_CAP, Math.max(0, options.maxBlur ?? 10));
  return max * (1 - rackSharpness(time, schedule, layer, options.response));
};

/** Props for {@link RackLayer}. */
export interface RackLayerProps {
  /** Layer id used by the focus schedule. */
  layer: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Marker wrapper that carries a `layer` id. Renders a plain full-size element; {@link RackFocus} reads the id.
 * @example <RackLayer layer="card-a"><CardA /></RackLayer>
 */
export const RackLayer: React.FC<RackLayerProps> = ({style, children}) => <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;

/** Props for {@link RackFocus}. */
export interface RackFocusProps extends RackOptions {
  /** Focus schedule, times in seconds. */
  focus: readonly FocusKeyframe[];
  /** Frame number, passed in. */
  frame: number;
  canvas?: Canvas;
  theme?: Theme;
  style?: CSSProperties;
  /** Children with a `layer` prop (string). Children without one are left sharp. */
  children?: ReactNode;
}

/**
 * Rack focus: one blur per **layer** (never per element), springing between layers. The in-focus layer has no
 * filter at all; the others carry `blur(<= maxBlur px)` (default 10, hard cap 20). A pure function of `frame`.
 *
 * Note: a CSS `filter` makes a layer a backdrop root, so a `<Glass>` inside a *currently blurred* layer shows its
 * un-blurred fill instead of sampling what is behind it until the layer is back in focus.
 *
 * @example
 * <RackFocus frame={frame} theme={theme} focus={[{t: 0, layer: 'a'}, {t: 4, layer: 'b'}]}>
 *   <RackLayer layer="a"><CardA /></RackLayer>
 *   <RackLayer layer="b"><CardB /></RackLayer>
 * </RackFocus>
 */
export const RackFocus: React.FC<RackFocusProps> = ({focus, frame, canvas, theme, style, maxBlur, response, children}) => {
  const cv = useKitCanvas(canvas, theme);
  const time = frame / cv.fps;
  return (
    <div style={{position: 'absolute', inset: 0, ...style}}>
      {React.Children.map(children, (child, i) => {
        const layer = React.isValidElement(child) ? (child as ReactElement<{layer?: unknown}>).props.layer : undefined;
        const blur = typeof layer === 'string' ? rackBlur(time, focus, layer, {maxBlur, response}) : 0;
        return (
          <div key={i} style={{position: 'absolute', inset: 0, filter: blur > RACK_BLUR_EPSILON ? `blur(${blur}px)` : undefined}}>
            {child}
          </div>
        );
      })}
    </div>
  );
};
