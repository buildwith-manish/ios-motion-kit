import type {ReactNode} from 'react';

/** Direction the *content* travels (push: both scenes move this way; wipe: the mask edge travels this way). */
export type Direction = 'left' | 'right' | 'up' | 'down';

/** The six built-in transitions. */
export type TransitionKind = 'push' | 'blurDissolve' | 'sheet' | 'zoomThrough' | 'matchedGeometry' | 'wipeMask';

/** Everything needed to draw one scene layer at one instant. All pure numbers. */
export interface LayerState {
  /** 0..1 */
  opacity: number;
  /** px */
  tx: number;
  /** px */
  ty: number;
  scale: number;
  /** Gaussian blur radius, px (always <= 20). */
  blur: number;
  /** 0..1 scrim over the layer. */
  dim: number;
  /** Corner radius in px (0 = square). */
  radius: number;
  /** 0..1 drop shadow strength (lifted sheets). */
  shadow: number;
  /** CSS mask-image value, if any. */
  mask?: string;
}

/** Both layers of a transition at progress p, plus which one is drawn on top. */
export interface TransitionLayers {
  outgoing: LayerState;
  incoming: LayerState;
  incomingOnTop: boolean;
}

/** Layer-function context: canvas size and travel direction. */
export interface EffectContext {
  width: number;
  height: number;
  direction: Direction;
}

/** A transition is a pure function of progress. */
export type TransitionFn = (p: number, ctx: EffectContext) => TransitionLayers;

/** Directional motion blur setting: off, on with defaults, or a custom shutter (0..1, 0.5 = 180 degrees). */
export type MotionBlurOption = boolean | {shutter?: number; cap?: number};

/** Axis-aligned rectangle in canvas px. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius, px. */
  radius?: number;
}

/** Registered content of a matched element. */
export interface MatchedEntry {
  rect: Rect;
  children: ReactNode;
}
