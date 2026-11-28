import {formatNumber, resolveSpec, type FormatPresetName, type FormatSpec} from '../text/format';
/**
 * Shared plumbing for the dataviz primitives: timing, theme tones, number formatting, text measuring.
 * Pure functions of their arguments. Nothing here reads the Remotion frame, so it is safe in parallel renders.
 *
 * Generic helpers (`clamp01`, `lerp`...) are internal and NOT re-exported from `dataviz/index.ts`, because the kit
 * barrel already exports helpers with those names.
 */
import {iosSpring, SPRING} from '../motion';
import {unit} from '../tokens/helpers';
import type {Theme, TypeRole, WeightRole} from '../tokens/types';
import {advanceOf, metricsForWeight} from '../text/metrics';

/** @internal */
export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
/** @internal */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A rectangle in the local px space of one primitive. */
export interface DvRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A plain point in px. */
export interface DvPoint {
  x: number;
  y: number;
}

/**
 * Theme colour a data element can take. Only theme keys are allowed (no raw colours), so it is plain JSON and a
 * theme swap restyles everything.
 */
export type Tone = 'accent' | 'positive' | 'negative' | 'warning' | 'primary' | 'secondary' | 'tertiary';

/**
 * Resolves a tone to the theme's colour.
 * @example toneColor(theme, 'negative') // theme.colors.semantic.negative
 */
export const toneColor = (theme: Theme, tone: Tone): string => {
  const c = theme.colors;
  switch (tone) {
    case 'accent': return c.accent;
    case 'positive': return c.semantic.positive;
    case 'negative': return c.semantic.negative;
    case 'warning': return c.semantic.warning;
    case 'primary': return c.text.primary;
    case 'secondary': return c.text.secondary;
    case 'tertiary': return c.text.tertiary;
  }
};

/**
 * Text/icon colour that reads on top of a filled tone: `onAccent` for the coloured tones, the page colour for the
 * neutral ones.
 * @example color: onToneColor(theme, 'accent')
 */
export const onToneColor = (theme: Theme, tone: Tone): string =>
  tone === 'primary' || tone === 'secondary' || tone === 'tertiary' ? theme.colors.background.base : theme.colors.onAccent;

/**
 * Timing every primitive accepts: EITHER an explicit `progress` (0..1, you drive it) OR `frame` + `start` (seconds),
 * which animates on `iosSpring`. With neither, the primitive is drawn settled (progress 1).
 */
export interface Timing {
  /** Explicit progress 0..1. Wins over frame/start. */
  progress?: number;
  /** Current frame number, passed in (never read from a hook inside primitives). */
  frame?: number;
  /** Second the animation begins. Default 0. */
  start?: number;
  /** Spring response in seconds. Default depends on the primitive (usually SPRING.GENTLE). */
  response?: number;
  /** Frame rate override. Default `theme.canvas.fps`. */
  fps?: number;
}

/** Snaps the spring's last 0.01% to exactly 1 so settled frames are pixel-identical. */
export const settle = (p: number): number => (p >= 1 - 1e-4 ? 1 : p);

/**
 * iOS spring progress for `time` seconds since the start, snapped to 1 when settled.
 * @example springProgress(0.3, 0.7)
 */
export const springProgress = (time: number, response: number): number => settle(iosSpring(time, response));

/**
 * Resolves a {@link Timing} to a progress value 0..1.
 * @example const p = resolveProgress({frame, start: 1.2}, theme) // spring from 1.2 s
 */
export const resolveProgress = (t: Timing, theme: Theme, defaultResponse: number = SPRING.GENTLE): number => {
  if (t.progress !== undefined) return clamp01(t.progress);
  if (t.frame === undefined) return 1;
  const fps = t.fps ?? theme.canvas.fps;
  return springProgress(t.frame / fps - (t.start ?? 0), t.response ?? defaultResponse);
};

/** Number formatting options shared by every primitive that shows a number. Plain JSON-safe. */
export interface NumberFormat {
  /** Preset name or spec from kit/text/format. When set it replaces the legacy fields above; explicit prefix/suffix/decimals still override it. */
  format?: FormatPresetName | FormatSpec;
  prefix?: string;
  suffix?: string;
  /** Digits after the decimal point. Default 0. */
  decimals?: number;
  /** Thousands separator, '' for none. Default ','. */
  groupSep?: string;
  decimalSep?: string;
}

/**
 * Formats a number with a prefix/suffix, grouping and a true minus sign (U+2212). Never prints "-0".
 * @example formatValue(-1234.5, {prefix: '$', decimals: 1}) // '−$1,234.5'
 */
export const formatValue = (v: number, f: NumberFormat = {}): string => {
  if (f.format) return formatNumber(v, {...resolveSpec(f.format), ...(f.prefix !== undefined && {prefix: f.prefix}), ...(f.suffix !== undefined && {suffix: f.suffix}), ...(f.decimals !== undefined && {decimals: f.decimals})});
  const {prefix = '', suffix = '', decimals = 0, groupSep = ',', decimalSep = '.'} = f;
  const abs = Math.abs(v);
  const neg = v < 0 && Math.round(abs * 10 ** decimals) > 0;
  const [int, dec] = abs.toFixed(decimals).split('.');
  const grouped = groupSep ? int.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep) : int;
  return `${neg ? '−' : ''}${prefix}${grouped}${dec ? decimalSep + dec : ''}${suffix}`;
};

/** Picks the {@link NumberFormat} fields out of any object (so `data` can carry them inline). */
export const pickFormat = (o: NumberFormat): NumberFormat => ({prefix: o.prefix, suffix: o.suffix, decimals: o.decimals, groupSep: o.groupSep, decimalSep: o.decimalSep, ...(o.format !== undefined && {format: o.format})});

/** Font size in canvas px for a type role. */
export const roleFontPx = (theme: Theme, role: TypeRole, scale: number = 1): number => theme.type[role].size * scale * unit(theme);

/**
 * Width in px of a single line of text in a theme type role (table-based, no DOM). Digits are measured at the
 * tabular width, because every number in the kit renders with tabular figures; this is also the widest a digit gets.
 * Pass `weight` to override the role's weight.
 * @example textWidthPx(theme, 'body', '$12,400')
 */
export const textWidthPx = (theme: Theme, role: TypeRole, text: string, opts: {scale?: number; weight?: WeightRole; fontPx?: number} = {}): number => {
  const t = theme.type[role];
  const px = opts.fontPx ?? roleFontPx(theme, role, opts.scale ?? 1);
  const m = metricsForWeight(theme.weights[opts.weight ?? t.weight]);
  let em = 0;
  let n = 0;
  for (const ch of text) {
    em += ch >= '0' && ch <= '9' ? m.digit : advanceOf(ch, m);
    n++;
  }
  return (em + n * t.tracking) * px;
};

/**
 * Width of a label's box: the measured text plus a 10% + 2 px margin, so a font that is a little wider than the
 * width table never clips or wraps. Boxes are never `overflow: hidden`; the margin is also what collision uses.
 * @example fitWidth(theme, textWidthPx(theme, 'body', 'Earned'))
 */
export const fitWidth = (theme: Theme, measured: number): number => measured * 1.1 + 2 * unit(theme);
