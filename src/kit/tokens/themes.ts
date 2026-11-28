import {buildGlassTiers} from './glassTiers';
import {CANVAS} from './canvas';
import './fonts';
import type {MotionTokens, RadiusKey, SafeAreaSet, SpacingKey, Theme, TypeRole, TypeStyle} from './types';

const RADIUS: Theme['radius'] = {xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 44, pill: 9999} satisfies Record<RadiusKey, number>;

const SPACING: Theme['spacing'] = {0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80} satisfies Record<SpacingKey, number>;

import {TYPE_SCALE} from './typeScale';

const TYPE: Record<TypeRole, TypeStyle> = {
  display: {size: 112, lineHeight: 1.04, tracking: -0.03, family: 'display', weight: 'bold', tabular: false},
  title: {size: 56, lineHeight: 1.1, tracking: -0.02, family: 'display', weight: 'bold', tabular: false},
  body: {size: 32, lineHeight: 1.3, tracking: -0.01, family: 'body', weight: 'regular', tabular: false},
  caption: {size: 24, lineHeight: 1.25, tracking: 0.08, family: 'body', weight: 'regular', tabular: false},
  number: {size: 88, lineHeight: 1, tracking: -0.02, family: 'display', weight: 'bold', tabular: true},
};

/** Platform safe areas. 16:9 uses broadcast 93% / 90%; 9:16 also clears the Shorts/Reels UI at the bottom and top. */
const SAFE_AREA: Theme['safeArea'] = {
  landscape: {
    action: {top: 0.035, right: 0.035, bottom: 0.035, left: 0.035},
    title: {top: 0.05, right: 0.05, bottom: 0.05, left: 0.05},
  } satisfies SafeAreaSet,
  portrait: {
    action: {top: 0.05, right: 0.035, bottom: 0.1, left: 0.035},
    title: {top: 0.1, right: 0.06, bottom: 0.22, left: 0.06},
  } satisfies SafeAreaSet,
};

const MOTION: MotionTokens = {
  spring: {SNAPPY: 0.4, SMOOTH: 0.5, GENTLE: 0.7},
  duration: {instant: 0.12, fast: 0.2, base: 0.3, slow: 0.5, hero: 0.8},
  stagger: {tight: 0.083, base: 0.13, loose: 0.2},
  easing: {
    ios: [0.32, 0.72, 0, 1],
    standard: [0.4, 0, 0.2, 1],
    decelerate: [0, 0, 0.2, 1],
    accelerate: [0.4, 0, 1, 1],
  },
};

/** Bundled Inter first (loaded from public/kit/fonts, matches the width tables in text/fonts), then iOS-flavoured fallbacks. A video that loads its own fonts overrides `fonts` via createTheme(). */
const FONTS: Theme['fonts'] = {
  display: '"Inter", -apple-system, "SF Pro Display", system-ui, "Helvetica Neue", Arial, sans-serif',
  body: '"Inter", -apple-system, "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif',
};

/** Exactly two weights. */
const WEIGHTS: Theme['weights'] = {regular: 600, bold: 700};

/**
 * "midnight": deep navy with a mint accent (the Video 4 look).
 * @example <ThemeProvider theme={midnight}>...</ThemeProvider>
 */
export const midnight: Theme = {
  name: 'midnight',
  canvas: CANVAS.landscape60,
  colors: {
    background: {deep: '#050E1D', base: '#0A1D38', lift: '#143A66'},
    text: {primary: '#FFFFFF', secondary: '#E5EAEF', tertiary: '#CFD6DE'},
    accent: '#3DF0A8',
    accentText: '#40F0AA',
    orbMaxAlpha: 0.35,
    onAccent: '#04130D',
    semantic: {positive: '#67ECB5', warning: '#FFCD73', negative: '#FFC7C7'},
    tint: {a: '#2AA7D6', b: '#7A5CF0', c: '#3DF0A8', d: '#143A66'},
  },
  glass: buildGlassTiers({
    fill: '#FFFFFF', fillFromGain: 1, fillToGain: 1,
    underlay: '#050E1D', underlayAlpha: 0.34,
    // Per-tier alphas tuned so white text on glass over the lightest orb backdrop is no harder than on bare canvas.
    tierUnderlayAlpha: {card: 0.38, pill: 0.44, chip: 0.33, sheet: 0.51},
    highlight: '#FFFFFF', rimGain: 1, insetGain: 1,
    ink: '#000000', inkGain: 1,
    shimmer: '#FFFFFF', shimmerAlpha: 0.4,
  }),
  radius: RADIUS,
  spacing: SPACING,
  type: TYPE,
  typeScale: TYPE_SCALE,
  fonts: FONTS,
  weights: WEIGHTS,
  safeArea: SAFE_AREA,
  motion: MOTION,
};

/**
 * "light": iOS light. Bright frosted glass, soft cool shadows, system blue accent.
 * @example createTheme({canvas: CANVAS.vertical60}, light)
 */
export const light: Theme = {
  ...midnight,
  name: 'light',
  colors: {
    background: {deep: '#E5E5EA', base: '#F2F2F7', lift: '#FFFFFF'},
    text: {primary: '#111114', secondary: '#333338', tertiary: '#464649'},
    accent: '#004797',
    accentText: '#004490',
    orbMaxAlpha: 0.35,
    onAccent: '#FFFFFF',
    semantic: {positive: '#155124', warning: '#663D00', negative: '#92000E'},
    tint: {a: '#64D2FF', b: '#BF5AF2', c: '#30D158', d: '#FFD60A'},
  },
  glass: buildGlassTiers({
    fill: '#FFFFFF', fillFromGain: 3.8, fillToGain: 5.6,
    underlay: '#141C30', underlayAlpha: 0.05,
    highlight: '#FFFFFF', rimGain: 1.45, insetGain: 2.4,
    ink: '#1E2846', inkGain: 0.45,
    shimmer: '#FFFFFF', shimmerAlpha: 0.75,
  }),
};

/**
 * "mono": graphite. Neutral greys, white accent, restrained glass.
 * @example <ThemeProvider theme={mono}>...</ThemeProvider>
 */
export const mono: Theme = {
  ...midnight,
  name: 'mono',
  colors: {
    background: {deep: '#0B0B0C', base: '#161618', lift: '#232326'},
    text: {primary: '#FFFFFF', secondary: '#DBDBDC', tertiary: '#BFBFC1'},
    accent: '#F5F5F7',
    accentText: '#F5F5F7',
    orbMaxAlpha: 0.25,
    onAccent: '#111113',
    semantic: {positive: '#64D591', warning: '#EAB75A', negative: '#F1AFAC'},
    tint: {a: '#3A3A3F', b: '#5A5A60', c: '#8A8A90', d: '#2A2A2E'},
  },
  glass: buildGlassTiers({
    fill: '#FFFFFF', fillFromGain: 0.85, fillToGain: 0.8,
    underlay: '#0A0A0C', underlayAlpha: 0.42,
    highlight: '#FFFFFF', rimGain: 0.85, insetGain: 0.85,
    ink: '#000000', inkGain: 1.1,
    shimmer: '#FFFFFF', shimmerAlpha: 0.32,
  }),
};

/** All built-in themes by name, for non-React code and theme pickers. */
export const themes = {midnight, light, mono} as const;

/** Name of a built-in theme. */
export type ThemeName = keyof typeof themes;
