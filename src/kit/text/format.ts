/**
 * formatNumber(value, spec): deterministic en-US number formatting. Pure, no Intl.
 * - True minus U+2212; optional accounting negatives "($1,234)"; optional explicit "+".
 * - Round half away from zero. A value that rounds to zero never shows a sign ("0", not "−0").
 * - Compact K/M/B/T: unit is chosen AFTER rounding, so 999,950 -> "$1.0M" (not "$1000K"). With the default decimals the K->M switch is at 999,500.
 *   Below 1,000 the value stays plain. Decimals: 1 when the scaled value < 100, else 0,
 *   unless `consistentDecimals` forces exactly `decimals` (default 1) everywhere.
 * - `pct` takes a FRACTION (0.123 -> "12.3%"); `pp` and `bps` take values already in points / bps.
 */
export type FormatPresetName = 'usd' | 'usdCompact' | 'pct' | 'pp' | 'delta' | 'int' | 'decimal1' | 'decimal2' | 'bps';
export type SignMode = 'auto' | 'always' | 'accounting';

export interface FormatSpec {
  /** Start from a preset; other fields override it. */
  preset?: FormatPresetName;
  /** Fraction digits (non-compact). Default 0. */
  decimals?: number;
  /** K/M/B/T abbreviation. */
  compact?: boolean;
  /** Multiplier applied first (pct uses 100). */
  scale?: number;
  prefix?: string;
  suffix?: string;
  /** 'always' adds "+" to positives; 'accounting' wraps negatives in parentheses. */
  sign?: SignMode;
  /** Always show exactly `decimals` digits (compact included). */
  consistentDecimals?: boolean;
  /** Thousands separators. Default true. */
  group?: boolean;
}

export const MINUS = '\u2212';

export const FORMAT_PRESETS: Record<FormatPresetName, FormatSpec> = {
  usd: {prefix: '$', decimals: 0},
  usdCompact: {prefix: '$', compact: true},
  pct: {suffix: '%', scale: 100, decimals: 1},
  pp: {suffix: ' pp', decimals: 1, sign: 'always'},
  delta: {decimals: 0, sign: 'always'},
  int: {decimals: 0},
  decimal1: {decimals: 1, consistentDecimals: true},
  decimal2: {decimals: 2, consistentDecimals: true},
  bps: {suffix: ' bps', decimals: 0},
};

export const resolveSpec = (spec: FormatPresetName | FormatSpec): FormatSpec => {
  const s = typeof spec === 'string' ? {preset: spec} : spec;
  return {...(s.preset ? FORMAT_PRESETS[s.preset] : {}), ...Object.fromEntries(Object.entries(s).filter(([k, v]) => k !== 'preset' && v !== undefined))};
};

/** Round half away from zero to `d` places (abs input, avoids 1.005 -> 1.00). */
const roundAbs = (abs: number, d: number): number => {
  const s = String(abs);
  if (s.includes('e')) return Number(abs.toFixed(Math.min(d, 100)));
  return Number(Math.round(Number(s + 'e' + d)) + 'e-' + d);
};

const group = (intPart: string): string => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const fixed = (abs: number, d: number, grp: boolean): string => {
  const [i, f] = roundAbs(abs, d).toFixed(d).split('.');
  return (grp ? group(i) : i) + (f ? '.' + f : '');
};

const UNITS: Array<[number, string]> = [[1e3, 'K'], [1e6, 'M'], [1e9, 'B'], [1e12, 'T']];

const compactBody = (abs: number, d: number, consistent: boolean, grp: boolean): string => {
  if (roundAbs(abs, 0) < 1000) return fixed(abs, consistent ? d : 0, grp);
  let u = 0;
  for (let i = 0; i < UNITS.length; i++) if (abs >= UNITS[i][0]) u = i;
  const dec = (v: number) => (consistent ? d : v < 100 ? 1 : 0);
  for (;;) {
    const v = abs / UNITS[u][0];
    const r = roundAbs(v, dec(v));
    if (r >= 1000 && u < UNITS.length - 1) {
      u++;
      continue;
    }
    return fixed(v, dec(v), grp) + UNITS[u][1];
  }
};

export const formatNumber = (value: number, spec: FormatPresetName | FormatSpec = 'int'): string => {
  const s = resolveSpec(spec);
  if (Number.isNaN(value)) return '\u2014';
  const prefix = s.prefix ?? '';
  const suffix = s.suffix ?? '';
  const sign = s.sign ?? 'auto';
  const grp = s.group !== false;
  const d = Math.max(0, s.decimals ?? 0);
  const v = value * (s.scale ?? 1);
  const neg = v < 0;
  if (!Number.isFinite(v)) return (neg ? MINUS : sign === 'always' ? '+' : '') + prefix + '\u221E' + suffix;
  const abs = Math.abs(v);
  const body = s.compact ? compactBody(abs, s.decimals ?? 1, !!s.consistentDecimals, grp) : fixed(abs, d, grp);
  const isZero = !/[1-9]/.test(body);
  const core = prefix + body + suffix;
  if (isZero) return core;
  if (neg) return sign === 'accounting' ? `(${core})` : MINUS + core;
  return sign === 'always' ? '+' + core : core;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toDate = (d: Date | string | number): Date => (d instanceof Date ? d : new Date(d));

/** "Q3 '26" (UTC). */
export const quarter = (d: Date | string | number): string => {
  const x = toDate(d);
  return `Q${Math.floor(x.getUTCMonth() / 3) + 1} '${String(x.getUTCFullYear() % 100).padStart(2, '0')}`;
};

/** "Sep 2026" (UTC). */
export const monthYear = (d: Date | string | number): string => {
  const x = toDate(d);
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
