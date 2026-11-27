/** Type definitions for the kit theme system. Pure types, no runtime code. */

/** A CSS cubic-bezier as [x1, y1, x2, y2]. */
export type Bezier = readonly [number, number, number, number];

/** Output canvas. The kit works at any size; defaults are 1920x1080 @ 60 fps. */
export interface Canvas {
  fps: number;
  width: number;
  height: number;
}

/** Page background tiers, deepest to lightest-lifted. */
export interface BackgroundColors {
  /** Deepest tier (page edge / vignette). */
  deep: string;
  /** Main page tier. */
  base: string;
  /** Raised tier (gradient highlight, big surfaces). */
  lift: string;
}

export interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface SemanticColors {
  positive: string;
  warning: string;
  negative: string;
}

/** Decorative tints for ambient backdrops, so glass has colour to blur. Never for text or data. */
export interface TintColors {
  a: string;
  b: string;
  c: string;
  d: string;
}

export interface ThemeColors {
  background: BackgroundColors;
  text: TextColors;
  accent: string;
  /** Text/icon colour that sits on top of `accent`. */
  onAccent: string;
  semantic: SemanticColors;
  tint: TintColors;
}

export type GlassTierName = 'card' | 'pill' | 'chip' | 'sheet';
export type RadiusKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'pill';
export type SpacingKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20;
export type TypeRole = 'display' | 'title' | 'body' | 'caption' | 'number';
export type FontRole = 'display' | 'body';
export type WeightRole = 'regular' | 'bold';
export type EasingName = 'ios' | 'standard' | 'decelerate' | 'accelerate';
export type SafeKind = 'title' | 'action';

/** One box-shadow layer. Values are px at the 1080 design size; they scale with the canvas. */
export interface ShadowSpec {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

/** Everything needed to draw one glass tier. */
export interface GlassTierSpec {
  /** Faint dark underlay so text stays readable over bright backdrops. */
  underlay: string;
  /** Gradient fill over the underlay, from top-left (`fillFrom`) to bottom-right (`fillTo`). */
  fillFrom: string;
  fillTo: string;
  /** backdrop-filter blur radius, px at the 1080 design size. */
  blurPx: number;
  /** backdrop-filter saturate, percent. */
  saturatePct: number;
  /** Specular rim gradient: bright top-left -> `rimMid` at 45% -> near 0 bottom-right. */
  rimFrom: string;
  rimMid: string;
  rimTo: string;
  /** Rim thickness, px at the 1080 design size. */
  rimWidthPx: number;
  /** Inset top highlight (a 1px line along the top edge). */
  insetHighlight: {y: number; color: string};
  /** Tight contact shadow and wide soft shadow. */
  shadowTight: ShadowSpec;
  shadowWide: ShadowSpec;
  /** Colour of the one-shot shimmer sweep. */
  shimmer: string;
  /** Default corner radius, a key of `Theme.radius`. */
  radius: RadiusKey;
}

/** Type-scale entry. `size` is px at the 1080 design size. */
export interface TypeStyle {
  size: number;
  /** Unitless line-height multiplier. */
  lineHeight: number;
  /** Letter-spacing in em. */
  tracking: number;
  family: FontRole;
  weight: WeightRole;
  /** Apply tabular figures. */
  tabular: boolean;
}

/** Fractions (0-1) of the canvas to inset on each side. Left/right are of width, top/bottom of height. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SafeAreaSet {
  title: Insets;
  action: Insets;
}

export interface MotionTokens {
  /** Spring response times in seconds (kit/motion iosSpring). */
  spring: {SNAPPY: number; SMOOTH: number; GENTLE: number};
  /** Fixed durations in seconds. */
  duration: {instant: number; fast: number; base: number; slow: number; hero: number};
  /** Stagger gaps in seconds. */
  stagger: {tight: number; base: number; loose: number};
  /** Easing curves as cubic-bezier control points. */
  easing: Record<EasingName, Bezier>;
}

/** The complete theme. Every kit component reads only from this. */
export interface Theme {
  name: string;
  canvas: Canvas;
  colors: ThemeColors;
  glass: Record<GlassTierName, GlassTierSpec>;
  /** px at the 1080 design size. */
  radius: Record<RadiusKey, number>;
  /** 4pt grid: key n = n * 4 px at the 1080 design size. */
  spacing: Record<SpacingKey, number>;
  type: Record<TypeRole, TypeStyle>;
  fonts: Record<FontRole, string>;
  /** Exactly two weights. */
  weights: Record<WeightRole, number>;
  safeArea: {landscape: SafeAreaSet; portrait: SafeAreaSet};
  motion: MotionTokens;
}

/** Recursive partial for theme overrides. Tuples (beziers) are replaced whole, not merged. */
export type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object ? {[K in keyof T]?: DeepPartial<T[K]>} : T;

/** Rectangle in canvas px, as returned by safeRect(). */
export interface SafeRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}
