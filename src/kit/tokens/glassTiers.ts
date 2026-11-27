import {rgba} from './color';
import type {GlassTierName, GlassTierSpec, RadiusKey, ShadowSpec} from './types';

/** Parameters for buildGlassTiers(): a handful of colours and gains produce all four tiers consistently. */
export interface GlassRecipe {
  /** Colour of the translucent fill gradient (white for dark themes and light themes alike). */
  fill: string;
  /** Multiplies the fill alpha at the top-left / bottom-right stops. */
  fillFromGain: number;
  fillToGain: number;
  /** Underlay colour and base alpha (alpha is further scaled per tier). */
  underlay: string;
  underlayAlpha: number;
  /** Absolute underlay alpha per tier; overrides `underlayAlpha * tier multiplier` for the tiers listed. Tuned so text passes over the worst-case backdrops. */
  tierUnderlayAlpha?: Partial<Record<GlassTierName, number>>;
  /** Rim and inset-highlight colour; gains scale their alphas. */
  highlight: string;
  rimGain: number;
  insetGain: number;
  /** Shadow colour and gain. */
  ink: string;
  inkGain: number;
  /** Shimmer colour and alpha. */
  shimmer: string;
  shimmerAlpha: number;
}

interface TierShape {
  underlayMul: number;
  fill: [number, number];
  blurPx: number;
  saturatePct: number;
  rim: [number, number];
  inset: number;
  tight: [number, number, number];
  wide: [number, number, number];
  radius: RadiusKey;
}

const SHAPES: Record<GlassTierName, TierShape> = {
  card: {underlayMul: 1, fill: [0.16, 0.06], blurPx: 24, saturatePct: 180, rim: [0.6, 0.12], inset: 0.35, tight: [2, 6, 0.32], wide: [18, 48, 0.34], radius: 'xl'},
  pill: {underlayMul: 1.18, fill: [0.18, 0.07], blurPx: 24, saturatePct: 180, rim: [0.7, 0.16], inset: 0.35, tight: [2, 6, 0.36], wide: [12, 32, 0.38], radius: 'pill'},
  chip: {underlayMul: 0.88, fill: [0.14, 0.05], blurPx: 16, saturatePct: 160, rim: [0.5, 0.1], inset: 0.3, tight: [1, 3, 0.28], wide: [8, 20, 0.28], radius: 'md'},
  sheet: {underlayMul: 1.35, fill: [0.2, 0.08], blurPx: 28, saturatePct: 180, rim: [0.7, 0.14], inset: 0.4, tight: [2, 8, 0.36], wide: [24, 64, 0.42], radius: 'xxl'},
};

/**
 * Builds the four glass tiers (card, pill, chip, sheet) from one recipe, so a reskin only changes a few numbers.
 * @example const glass = buildGlassTiers({fill: '#fff', fillFromGain: 1, fillToGain: 1, underlay: '#050E1D', underlayAlpha: 0.34,
 *   highlight: '#fff', rimGain: 1, insetGain: 1, ink: '#000', inkGain: 1, shimmer: '#fff', shimmerAlpha: 0.4});
 */
export const buildGlassTiers = (r: GlassRecipe): Record<GlassTierName, GlassTierSpec> => {
  const out = {} as Record<GlassTierName, GlassTierSpec>;
  (Object.keys(SHAPES) as GlassTierName[]).forEach((name) => {
    const s = SHAPES[name];
    const shadow = (v: [number, number, number]): ShadowSpec => ({x: 0, y: v[0], blur: v[1], spread: 0, color: rgba(r.ink, v[2] * r.inkGain)});
    out[name] = {
      underlay: rgba(r.underlay, r.tierUnderlayAlpha?.[name] ?? r.underlayAlpha * s.underlayMul),
      fillFrom: rgba(r.fill, s.fill[0] * r.fillFromGain),
      fillTo: rgba(r.fill, s.fill[1] * r.fillToGain),
      blurPx: s.blurPx,
      saturatePct: s.saturatePct,
      rimFrom: rgba(r.highlight, s.rim[0] * r.rimGain),
      rimMid: rgba(r.highlight, s.rim[1] * r.rimGain),
      rimTo: rgba(r.highlight, 0),
      rimWidthPx: 1,
      insetHighlight: {y: 1, color: rgba(r.highlight, s.inset * r.insetGain)},
      shadowTight: shadow(s.tight),
      shadowWide: shadow(s.wide),
      shimmer: rgba(r.shimmer, r.shimmerAlpha),
      radius: s.radius,
    };
  });
  return out;
};
