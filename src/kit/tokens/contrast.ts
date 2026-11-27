import type {GlassTierName, Theme} from './types';

/** WCAG contrast maths for theme text colours. Pure (no React, no Remotion), so Node scripts can import it. */

export type RGB = [number, number, number];

const lin = (c: number) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
/** WCAG relative luminance, 0-1. */
export const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
/** WCAG contrast ratio, 1-21. @example ratio([255,255,255],[0,0,0]) // 21 */
export const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** `fg` at alpha `a` composited over opaque `bg`. */
export const over = (fg: RGB, a: number, bg: RGB): RGB => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a))) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((c, i) => Math.round(c + (b[i] - c) * t)) as RGB;

/**
 * Moves `fg` toward white (dark bg) or black (light bg) until it reaches `min` against `bg`. Hue is kept (mixes toward
 * white/black, never toward grey). Returns `fg` itself when it already passes. If the chosen end cannot reach `min`
 * (mid-tone backgrounds), the opposite end is used.
 */
export function ensureContrast(fg: RGB, bg: RGB, min: number): RGB {
  if (ratio(fg, bg) >= min) return fg;
  const white: RGB = [255, 255, 255];
  const black: RGB = [0, 0, 0];
  let target: RGB = lum(bg) > 0.5 ? black : white;
  if (ratio(target, bg) < min) target = target === white ? black : white;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    ratio(mix(fg, target, m), bg) >= min ? (hi = m) : (lo = m);
  }
  return mix(fg, target, hi);
}

/** Parsed colour: opaque rgb + alpha 0-1. */
export interface ParsedColor {
  rgb: RGB;
  a: number;
}

/** Parses '#rgb', '#rgba', '#rrggbb', '#rrggbbaa', 'rgb(...)' and 'rgba(...)' (comma or space separated). */
export const parseColor = (input: string): ParsedColor => {
  const s = input.trim().toLowerCase();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error(`contrast: bad hex colour "${input}"`);
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return {rgb: [n(0), n(2), n(4)], a: h.length === 8 ? n(6) / 255 : 1};
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (!m) throw new Error(`contrast: cannot parse colour "${input}"`);
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map((v, i) => (v.endsWith('%') ? (parseFloat(v) / 100) * (i < 3 ? 255 : 1) : parseFloat(v)));
  return {rgb: [p[0], p[1], p[2]].map((v) => Math.round(v)) as RGB, a: p.length > 3 ? p[3] : 1};
};

/** RGB -> '#rrggbb'. */
export const rgbToHex = (c: RGB): string => '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Theme colours that are used as text. */
export type ColorRole = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'accentText' | 'positive' | 'warning' | 'negative';
/** Roles the table checks (colour roles + karaoke states). */
export type TextRole = ColorRole | 'onAccent' | 'karaokeDim' | 'karaokeActive';
/** Where text sits: straight on the canvas gradient, or on a glass tier. */
export type Surface = 'canvas' | GlassTierName;

export const THRESHOLDS = {body: 4.5, caption: 4.5, large: 3, karaokeDim: 3, karaokeActive: 4.5} as const;

/** Required ratio for text of `sizePx` (1080 design size): >= 24 px, or >= 19 px bold, counts as large (3:1). */
export const requiredRatio = (sizePx: number, bold = false): number => (sizePx >= 24 || (bold && sizePx >= 19) ? THRESHOLDS.large : THRESHOLDS.body);

const REQUIRED: Record<TextRole, number> = {
  primary: THRESHOLDS.body, secondary: THRESHOLDS.body, tertiary: THRESHOLDS.caption, accent: THRESHOLDS.body, accentText: THRESHOLDS.body,
  positive: THRESHOLDS.body, warning: THRESHOLDS.body, negative: THRESHOLDS.body, onAccent: THRESHOLDS.body,
  karaokeDim: THRESHOLDS.karaokeDim, karaokeActive: THRESHOLDS.karaokeActive,
};

/** One worst-case backdrop colour behind text. */
export interface Backdrop {
  label: string;
  rgb: RGB;
}

const hexRgb = (hex: string): RGB => parseColor(hex).rgb;

/** The highest alpha an ambient orb reaches behind text, from the theme token. The Atmosphere background reads this instead of hard-coding an alpha. */
export const orbMaxAlpha = (theme: Theme): number => theme.colors.orbMaxAlpha;

/** Worst-case canvas backdrops: each base-gradient stop, plus each orb/accent colour at `theme.colors.orbMaxAlpha` over the base. */
export const backdropsOf = (theme: Theme): Backdrop[] => {
  const c = theme.colors;
  const base = hexRgb(c.background.base);
  const out: Backdrop[] = [
    {label: 'bg.deep', rgb: hexRgb(c.background.deep)},
    {label: 'bg.base', rgb: base},
    {label: 'bg.lift', rgb: hexRgb(c.background.lift)},
  ];
  const orbs: [string, string][] = [['tint.a', c.tint.a], ['tint.b', c.tint.b], ['tint.c', c.tint.c], ['tint.d', c.tint.d], ['accent', c.accent]];
  orbs.forEach(([label, col]) => out.push({label: `${label}@${String(orbMaxAlpha(theme)).replace(/^0/, '')}`, rgb: over(hexRgb(col), orbMaxAlpha(theme), base)}));
  return out;
};

/** A glass tier over one backdrop: dark underlay, then its strongest fill alpha. */
export const glassOver = (theme: Theme, tier: GlassTierName, bg: RGB): RGB => {
  const g = theme.glass[tier];
  const u = parseColor(g.underlay);
  const f = parseColor(g.fillFrom);
  const t = parseColor(g.fillTo);
  const withUnder = over(u.rgb, u.a, bg);
  return over(f.rgb, Math.max(f.a, t.a), withUnder);
};

const TIERS: GlassTierName[] = ['card', 'pill', 'chip', 'sheet'];

/** Backdrops text must pass against for a surface. */
export const surfaceBackdrops = (theme: Theme, surface: Surface): Backdrop[] =>
  surface === 'canvas' ? backdropsOf(theme) : backdropsOf(theme).map((b) => ({label: b.label, rgb: glassOver(theme, surface, b.rgb)}));

const allSurfaceBackdrops = (theme: Theme) => (['canvas', ...TIERS] as Surface[]).flatMap((s) => surfaceBackdrops(theme, s));

const colorOf = (theme: Theme, role: ColorRole | 'onAccent'): string => {
  const c = theme.colors;
  return role === 'primary' || role === 'secondary' || role === 'tertiary' ? c.text[role] : role === 'accent' ? c.accent : role === 'accentText' ? c.accentText : role === 'onAccent' ? c.onAccent : c.semantic[role];
};

/**
 * The theme's colour for `role`, adjusted (hue kept) so it passes its threshold on `surface` against every worst-case
 * backdrop. Without a surface, it must pass on the canvas and on every glass tier.
 * @example safeText(midnight, 'secondary', 'card') // '#A9BAD0'
 */
export function safeText(theme: Theme, role: ColorRole, surface?: Surface): string {
  const bgs = surface ? surfaceBackdrops(theme, surface) : allSurfaceBackdrops(theme);
  const min = REQUIRED[role];
  const white: RGB = [255, 255, 255];
  const black: RGB = [0, 0, 0];
  // One direction for every backdrop (never flip between white and black): whichever end satisfies more of them.
  const reach = (end: RGB) => bgs.filter((b) => ratio(end, b.rgb) >= min).length;
  const end = reach(white) >= reach(black) ? white : black;
  let fg = hexRgb(colorOf(theme, role));
  for (const b of bgs) {
    // A backdrop this end cannot reach is left alone (it stays a FAIL row in the table instead of oscillating).
    if (ratio(fg, b.rgb) >= min || ratio(end, b.rgb) < min) continue;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      ratio(mix(fg, end, m), b.rgb) >= min ? (hi = m) : (lo = m);
    }
    fg = mix(fg, end, hi);
  }
  return rgbToHex(fg);
}

/** Contrast-safe positive (green) text for dark surfaces and glass. */
export const textPositive = (theme: Theme, surface?: Surface): string => safeText(theme, 'positive', surface);
/** Contrast-safe warning (amber) text for dark surfaces and glass. */
export const textWarning = (theme: Theme, surface?: Surface): string => safeText(theme, 'warning', surface);
/** Contrast-safe negative (red) text for dark surfaces and glass. */
export const textNegative = (theme: Theme, surface?: Surface): string => safeText(theme, 'negative', surface);

const dimCache = new WeakMap<Theme, number>();
/**
 * Lowest karaoke inactive-word opacity (>= 0.4) at which primary text, composited over every canvas and glass
 * backdrop, still reaches 3:1.
 */
export const karaokeInactiveOpacity = (theme: Theme): number => {
  const hit = dimCache.get(theme);
  if (hit !== undefined) return hit;
  const fg = hexRgb(theme.colors.text.primary);
  const bgs = allSurfaceBackdrops(theme);
  let a = 0.4;
  while (a < 1 && bgs.some((b) => ratio(over(fg, a, b.rgb), b.rgb) < THRESHOLDS.karaokeDim)) a = Math.round((a + 0.01) * 100) / 100;
  dimCache.set(theme, a);
  return a;
};

/** Adjacent-role steps of the text hierarchy, checked on the worst backdrop. */
export type HierarchyRole = 'hier:pri>sec' | 'hier:sec>ter';
/** Smallest ratio step between adjacent hierarchy roles (the higher role's contrast / the lower role's). */
export const HIERARCHY_STEP = 1.2;
/** Target contrast on the worst backdrop per hierarchy role; the highest achievable value is used when a target is impossible. */
export const HIERARCHY_TARGETS = {primary: 9, secondary: 6, tertiary: 4.5} as const;

/** One row of the contrast table. */
export interface ContrastRow {
  theme: string;
  role: TextRole | HierarchyRole;
  surface: Surface | 'accent' | 'all';
  backdrop: string;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  pass: boolean;
}

/**
 * Every (role, surface, backdrop) check for a theme. Karaoke rows use primary text at `karaokeInactiveOpacity(theme)`
 * (dimmed) and at full opacity (active). `onAccent` is checked on the accent fill.
 */
export function contrastTable(theme: Theme): ContrastRow[] {
  const rows: ContrastRow[] = [];
  const push = (role: TextRole, surface: ContrastRow['surface'], backdrop: string, fg: RGB, bg: RGB) => {
    const r = ratio(fg, bg);
    rows.push({theme: theme.name, role, surface, backdrop, fg: rgbToHex(fg), bg: rgbToHex(bg), ratio: Math.round(r * 100) / 100, required: REQUIRED[role], pass: r >= REQUIRED[role]});
  };
  const roles: ColorRole[] = ['primary', 'secondary', 'tertiary', 'accentText', 'positive', 'warning', 'negative'];
  const dim = karaokeInactiveOpacity(theme);
  const primary = hexRgb(theme.colors.text.primary);
  (['canvas', ...TIERS] as Surface[]).forEach((surface) => {
    surfaceBackdrops(theme, surface).forEach((b) => {
      roles.forEach((role) => push(role, surface, b.label, hexRgb(colorOf(theme, role)), b.rgb));
      push('karaokeDim', surface, b.label, over(primary, dim, b.rgb), b.rgb);
      push('karaokeActive', surface, b.label, primary, b.rgb);
    });
  });
  push('onAccent', 'accent', 'accent', hexRgb(theme.colors.onAccent), hexRgb(theme.colors.accent));
  // Hierarchy: each role's worst contrast over every surface/backdrop; adjacent roles must be a clear step apart.
  const worst = (role: ColorRole) => rows.filter((r) => r.role === role).reduce((m, r) => Math.min(m, r.ratio), Infinity);
  const step = (role: HierarchyRole, hi: ColorRole, lo: ColorRole) => {
    const v = worst(hi) / worst(lo);
    rows.push({theme: theme.name, role, surface: 'all', backdrop: 'worst', fg: colorOf(theme, hi), bg: colorOf(theme, lo), ratio: Math.round(v * 100) / 100, required: HIERARCHY_STEP, pass: v >= HIERARCHY_STEP});
  };
  step('hier:pri>sec', 'primary', 'secondary');
  step('hier:sec>ter', 'secondary', 'tertiary');
  return rows;
}
