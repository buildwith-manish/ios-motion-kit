import {clamp01, lerp} from './math';
import type {Direction, EffectContext, LayerState, TransitionFn, TransitionKind, TransitionLayers} from './types';

/** Hard cap for any full-layer Gaussian blur in the kit (px). */
export const MAX_LAYER_BLUR = 20;

const REST: LayerState = {opacity: 1, tx: 0, ty: 0, scale: 1, blur: 0, dim: 0, radius: 0, shadow: 0};
const layer = (over: Partial<LayerState>): LayerState => ({...REST, ...over, blur: Math.min(MAX_LAYER_BLUR, over.blur ?? 0)});

/** Unit vector of content travel for a direction ('left' = content moves toward -x). */
const vec = (d: Direction): [number, number] => (d === 'left' ? [-1, 0] : d === 'right' ? [1, 0] : d === 'up' ? [0, -1] : [0, 1]);
/** The canvas extent along the travel axis. */
const extent = (d: Direction, c: EffectContext): number => (d === 'left' || d === 'right' ? c.width : c.height);

/** Options for {@link push}. */
export interface PushOptions {
  /** Outgoing travels this fraction of the incoming distance. Default 0.3. */
  parallax?: number;
  /** Max dimming of the outgoing scene, 0..1. Default 0.25. */
  dim?: number;
}

/**
 * push: the incoming scene pushes the outgoing one. Outgoing moves 30% as far (parallax) and dims slightly.
 * @example push({parallax: 0.3, dim: 0.25})(0.5, {width: 1920, height: 1080, direction: 'left'})
 */
export const push = (o: PushOptions = {}): TransitionFn => (p, c) => {
  const [dx, dy] = vec(c.direction);
  const dist = extent(c.direction, c);
  const par = o.parallax ?? 0.3;
  return {
    incomingOnTop: true,
    outgoing: layer({tx: dx * dist * par * p, ty: dy * dist * par * p, dim: (o.dim ?? 0.25) * p, opacity: p >= 1 ? 0 : 1}),
    incoming: layer({tx: -dx * dist * (1 - p), ty: -dy * dist * (1 - p)}),
  };
};

/** Options for {@link blurDissolve}. */
export interface BlurDissolveOptions {
  /** Max blur radius, px (capped at 20). Default 16. */
  maxBlur?: number;
  /** Scale difference between the layers. Default 0.02. */
  scaleDelta?: number;
}

/**
 * blurDissolve: incoming fades in over the outgoing (so there is never a both-half-opaque dip), the outgoing blurs and
 * grows a hair while the incoming comes out of blur from slightly smaller. Outgoing is at opacity 0 by p = 1.
 * @example blurDissolve({maxBlur: 16})(0.5, {width: 1920, height: 1080, direction: 'left'})
 */
export const blurDissolve = (o: BlurDissolveOptions = {}): TransitionFn => (p) => {
  const mb = o.maxBlur ?? 16;
  const sd = o.scaleDelta ?? 0.02;
  return {
    incomingOnTop: true,
    outgoing: layer({opacity: p >= 1 ? 0 : 1 - clamp01((p - 0.8) / 0.2), blur: mb * p, scale: 1 + sd * p}),
    incoming: layer({opacity: clamp01(p / 0.8), blur: mb * (1 - p), scale: 1 - sd * (1 - p)}),
  };
};

/** Options for {@link sheet}. */
export interface SheetOptions {
  /** Outgoing scale at the end. Default 0.94. */
  outgoingScale?: number;
  /** Max dimming of the outgoing scene. Default 0.3. */
  dim?: number;
  /** Corner radius of the rising sheet, px. Default 36. */
  radius?: number;
}

/**
 * sheet: incoming rises like an iOS sheet (direction 'up' = from the bottom, the default); the outgoing scales to ~0.94
 * and dims. The incoming keeps rounded corners and a shadow until it lands.
 * @example sheet({outgoingScale: 0.94})(0.5, {width: 1920, height: 1080, direction: 'up'})
 */
export const sheet = (o: SheetOptions = {}): TransitionFn => (p, c) => {
  const [dx, dy] = vec(c.direction);
  const radius = o.radius ?? 36;
  const landed = p >= 1;
  return {
    incomingOnTop: true,
    outgoing: layer({scale: lerp(1, o.outgoingScale ?? 0.94, p), dim: (o.dim ?? 0.3) * p, radius: radius * p * 0.8, opacity: landed ? 0 : 1}),
    incoming: layer({tx: -dx * c.width * (1 - p), ty: -dy * c.height * (1 - p), radius: landed ? 0 : radius, shadow: landed ? 0 : 1 - p * 0.5}),
  };
};

/** Options for {@link zoomThrough}. */
export interface ZoomThroughOptions {
  /** Outgoing end scale. Default 1.4. */
  outgoingScale?: number;
  /** Incoming start scale. Default 1.06. */
  incomingFrom?: number;
  /** Outgoing max blur, px (capped at 20). Default 6. */
  maxBlur?: number;
}

/**
 * zoomThrough: the outgoing zooms in and fades (drawn on top); the incoming settles from 1.06 to 1 underneath, opaque.
 * @example zoomThrough({outgoingScale: 1.4})(0.5, {width: 1920, height: 1080, direction: 'left'})
 */
export const zoomThrough = (o: ZoomThroughOptions = {}): TransitionFn => (p) => ({
  incomingOnTop: false,
  outgoing: layer({scale: lerp(1, o.outgoingScale ?? 1.4, p), opacity: p >= 1 ? 0 : 1 - clamp01(p / 0.85), blur: (o.maxBlur ?? 6) * p}),
  incoming: layer({scale: lerp(o.incomingFrom ?? 1.06, 1, p)}),
});

/** Options for {@link wipeMask}. */
export interface WipeMaskOptions {
  /** Width of the soft edge as a fraction of the canvas along the travel axis. Default 0.3. */
  softness?: number;
}

/** CSS linear-gradient mask whose soft edge sits at progress p (fully hidden at 0, fully shown at 1). */
export const wipeMaskImage = (p: number, direction: Direction, softness: number): string | undefined => {
  if (p >= 1) return undefined;
  const h = softness / 2;
  const c = -h + p * (1 + 2 * h);
  const a = ((c - h) * 100).toFixed(3);
  const b = ((c + h) * 100).toFixed(3);
  const to = direction === 'right' ? 'to right' : direction === 'left' ? 'to left' : direction === 'down' ? 'to bottom' : 'to top';
  return `linear-gradient(${to}, #000 ${a}%, transparent ${b}%)`;
};

/**
 * wipeMask: soft-edged directional mask reveal of the incoming over the outgoing (direction = the way the edge travels).
 * @example wipeMask({softness: 0.3})(0.5, {width: 1920, height: 1080, direction: 'right'})
 */
export const wipeMask = (o: WipeMaskOptions = {}): TransitionFn => (p, c) => ({
  incomingOnTop: true,
  outgoing: layer({opacity: p >= 1 ? 0 : 1}),
  incoming: layer({mask: wipeMaskImage(p, c.direction, o.softness ?? 0.3)}),
});

/** Options for {@link matchedGeometry}'s background cross-fade. */
export interface MatchedGeometryOptions {
  /** Max blur on the cross-fading scenes, px. Default 6. */
  maxBlur?: number;
}

/**
 * matchedGeometry background: the rest of the scene cross-fades (like blurDissolve, softer); the matched elements are
 * drawn separately by the overlay in <TransitionScene>, interpolating their registered rects.
 * @example matchedGeometry({maxBlur: 6})(0.5, {width: 1920, height: 1080, direction: 'left'})
 */
export const matchedGeometry = (o: MatchedGeometryOptions = {}): TransitionFn => blurDissolve({maxBlur: o.maxBlur ?? 6, scaleDelta: 0.01});

/** Per-kind option bag accepted by <TransitionScene> (`options` prop). */
export interface TransitionOptionsByKind {
  push?: PushOptions;
  blurDissolve?: BlurDissolveOptions;
  sheet?: SheetOptions;
  zoomThrough?: ZoomThroughOptions;
  matchedGeometry?: MatchedGeometryOptions;
  wipeMask?: WipeMaskOptions;
}

/** Default direction for each kind when none is given. */
export const defaultDirection: Record<TransitionKind, Direction> = {
  push: 'left',
  blurDissolve: 'left',
  sheet: 'up',
  zoomThrough: 'left',
  matchedGeometry: 'left',
  wipeMask: 'right',
};

/**
 * Resolve a kind (+ options) to its pure layer function.
 * @example const fn = getTransition('push', {parallax: 0.3}); const layers = fn(0.5, {width: 1920, height: 1080, direction: 'left'});
 */
export const getTransition = (kind: TransitionKind, options: TransitionOptionsByKind = {}): TransitionFn => {
  switch (kind) {
    case 'push': return push(options.push);
    case 'blurDissolve': return blurDissolve(options.blurDissolve);
    case 'sheet': return sheet(options.sheet);
    case 'zoomThrough': return zoomThrough(options.zoomThrough);
    case 'matchedGeometry': return matchedGeometry(options.matchedGeometry);
    case 'wipeMask': return wipeMask(options.wipeMask);
  }
};

export type {TransitionLayers};
