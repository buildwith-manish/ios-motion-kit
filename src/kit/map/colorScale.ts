/**
 * Choropleth colour scales built only from theme tokens (pure). Colour-blind safety by construction:
 * sequential scales change lightness monotonically (readable with no hue at all); diverging scales run cool <-> warm
 * (blue <-> orange; mono: bright grey <-> amber) around a quiet neutral. Check: scripts/map_check_scales.ts.
 */
import type {Theme} from '../tokens/types';

export type ChoroplethData = Record<string, number | null | undefined>;

export interface ColorScaleSpec {
  type: 'sequential' | 'diverging';
  /** sequential: [min, max]; diverging: [min, mid, max]. Omit to take it from the data (diverging mid defaults to 0). */
  domain?: number[];
  /** Number of classes (default 5 sequential, 7 diverging). 0 = continuous. Diverging rounds up to an odd number. */
  steps?: number;
}

export interface ColorScale {
  type: ColorScaleSpec['type'];
  domain: number[];
  /** Empty when continuous. */
  classes: {from: number; to: number; color: string}[];
  /** Evenly spaced samples along the ramp, for drawing a continuous legend. */
  ramp: string[];
  color: (v: number) => string;
}

type RGB = [number, number, number];
const hexRgb = (hex: string): RGB => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};
const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const unlin = (x: number) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)));

/** sRGB hex -> OKLab. */
export const oklab = (hex: string): RGB => {
  const [r, g, b] = hexRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const fromOklab = ([L, a, b]: RGB): string => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `#${rgb.map((v) => unlin(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};
/** Perceptual mix of two hex colours. */
export const mixColor = (a: string, b: string, t: number): string => {
  const x = oklab(a), y = oklab(b);
  return fromOklab([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
};
const along = (stops: string[], t: number): string => {
  const u = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(u));
  return mixColor(stops[i], stops[i + 1], u - i);
};

/** Ramp stops from theme tokens: sequential low -> high, or diverging low -> mid -> high. */
export const scaleStops = (theme: Theme, type: ColorScaleSpec['type']): string[] => {
  const c = theme.colors;
  const isLight = theme.name === 'light';
  const isMono = theme.name === 'mono';
  if (type === 'sequential') {
    if (isLight) return [mixColor(c.background.lift, c.tint.a, 0.35), c.accent, mixColor(c.accent, c.text.primary, 0.65)];
    if (isMono) return [mixColor(c.background.lift, c.tint.c, 0.25), c.tint.c, c.text.primary];
    return [mixColor(c.background.lift, c.tint.a, 0.15), c.tint.a, mixColor(c.accent, c.text.primary, 0.35)];
  }
  if (isLight) return [mixColor(c.accent, c.text.primary, 0.3), mixColor(c.accent, c.background.lift, 0.35), c.background.base, mixColor(c.semantic.warning, c.background.lift, 0.2), mixColor(c.semantic.warning, c.text.primary, 0.45)];
  if (isMono) return [c.text.primary, c.text.secondary, c.background.lift, mixColor(c.semantic.warning, c.background.lift, 0.4), c.semantic.warning];
  // midnight: a darker neutral than `lift` leaves each arm enough lightness range for three separable classes
  const mid = mixColor(c.background.lift, c.background.base, 0.6);
  return [mixColor(c.tint.a, c.text.primary, 0.8), c.tint.a, mid, mixColor(c.semantic.warning, c.semantic.negative, 0.2), mixColor(c.semantic.warning, c.text.primary, 0.6)];
};

/** Finite values of a data object. */
export const dataValues = (data: ChoroplethData): number[] => Object.values(data).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

/** Builds a scale. `data` is only needed when the spec has no domain. */
export const makeColorScale = (theme: Theme, spec: ColorScaleSpec, data: ChoroplethData = {}): ColorScale => {
  const diverging = spec.type === 'diverging';
  const values = dataValues(data);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const domain = spec.domain ?? (diverging ? [Math.min(lo, 0), 0, Math.max(hi, 0)] : [lo, hi]);
  if (domain.length !== (diverging ? 3 : 2) || domain.some((v, i) => i > 0 && v < domain[i - 1])) {
    throw new Error(`makeColorScale: ${spec.type} needs an ascending domain of ${diverging ? 3 : 2} numbers, got ${JSON.stringify(domain)}`);
  }
  const stops = scaleStops(theme, spec.type);
  const frac = (a: number, b: number, v: number) => (b === a ? 0.5 : Math.min(1, Math.max(0, (v - a) / (b - a))));
  /** value -> 0..1 position on the ramp (diverging: mid always lands on 0.5). */
  const position = (v: number) => (diverging ? (v < domain[1] ? 0.5 * frac(domain[0], domain[1], v) : 0.5 + 0.5 * frac(domain[1], domain[2], v)) : frac(domain[0], domain[1], v));
  let steps = spec.steps ?? (diverging ? 7 : 5);
  if (diverging && steps > 0 && steps % 2 === 0) steps += 1;
  const valueAt = (t: number) => (diverging ? (t < 0.5 ? domain[0] + (domain[1] - domain[0]) * t * 2 : domain[1] + (domain[2] - domain[1]) * (t - 0.5) * 2) : domain[0] + (domain[1] - domain[0]) * t);
  const classes = Array.from({length: steps}, (_, i) => ({from: valueAt(i / steps), to: valueAt((i + 1) / steps), color: along(stops, steps === 1 ? 0.5 : i / (steps - 1))}));
  const color = (v: number) => (steps ? classes[Math.min(steps - 1, Math.floor(position(v) * steps))].color : along(stops, position(v)));
  return {type: spec.type, domain, classes, ramp: Array.from({length: 11}, (_, i) => along(stops, i / 10)), color};
};

/** Hatch pattern for "no data" as a CSS background (legend swatches). */
export const hatchCss = (line: string, fill: string): string => `repeating-linear-gradient(45deg, ${line} 0px, ${line} 2px, ${fill} 2px, ${fill} 7px)`;
