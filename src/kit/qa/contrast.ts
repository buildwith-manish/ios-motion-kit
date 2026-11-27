/** Pure WCAG 2.x contrast maths and the per-text measurement. Colours are sRGB 0-255. No React, no Node APIs. */

/**
 * sRGB colour, channels 0-255.
 * @example const white: Rgb = [255, 255, 255];
 */
export type Rgb = readonly [number, number, number];
/**
 * sRGB colour 0-255 with alpha 0-1.
 * @example const half: Rgba = [0, 0, 0, 0.5];
 */
export type Rgba = readonly [number, number, number, number];

/**
 * WCAG relative luminance.
 * @example relativeLuminance([255, 255, 255]) // 1
 */
export const relativeLuminance = ([r, g, b]: Rgb): number => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/**
 * WCAG contrast ratio, 1 to 21.
 * @example contrastRatio([0, 0, 0], [255, 255, 255]) // 21
 */
export const contrastRatio = (a: Rgb, b: Rgb): number => {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/**
 * Parses the forms getComputedStyle returns: rgb(), rgba() and color(srgb ...). Returns null for anything else.
 * @example parseCssColor('rgba(10, 20, 30, 0.5)') // [10, 20, 30, 0.5]
 */
export const parseCssColor = (css: string): Rgba | null => {
  const legacy = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(css.trim());
  const srgb = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(css.trim());
  const m = legacy ?? srgb;
  if (!m) return null;
  const k = srgb ? 255 : 1;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
  return [Number(m[1]) * k, Number(m[2]) * k, Number(m[3]) * k, alpha];
};

/**
 * Result for one text run in one frame.
 * @example const weak = (m: ContrastMeasure) => m.ratio < 4.5;
 */
export interface ContrastMeasure {
  /** 10th percentile of the per-pixel ratios: the weakest tenth of the area behind the glyphs. This is what is judged. */
  ratio: number;
  median: number;
  /** Typical background and text colours, for the report. */
  background: Rgb;
  foreground: Rgb;
  /** 'declared' = CSS colour over the real background; 'rendered' = glyph pixels (gradient text, overlays, odd colour formats). */
  method: 'declared' | 'rendered';
  /** Glyph pixels measured. */
  pixels: number;
}

/**
 * One pixel under a glyph: as rendered, and the same pixel with the text hidden.
 * @example const p: GlyphPixel = {shown: [255, 255, 255], behind: [10, 29, 56]};
 */
export interface GlyphPixel {
  shown: Rgb;
  behind: Rgb;
}

const at = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const medianRgb = (list: readonly Rgb[]): Rgb => [0, 1, 2].map((c) => at(list.map((p) => p[c]).sort((a, b) => a - b), 0.5)) as unknown as Rgb;
const delta = (a: Rgb, b: Rgb) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

/**
 * Contrast of one text run against the background actually rendered behind it. `pixels` are the pixels that change
 * when the text is hidden. The declared colour (times `opacity`) is laid over every background pixel, so
 * anti-aliased edges do not dilute the result. If that prediction disagrees with the solid glyph pixels on screen
 * (gradient fill, a tint above the text, group opacity), the on-screen pixels are used instead.
 * @example measureTextContrast(pixels, 'rgb(232, 238, 247)', 1)?.ratio
 */
export const measureTextContrast = (pixels: readonly GlyphPixel[], cssColor: string | null, opacity = 1): ContrastMeasure | null => {
  if (!pixels.length) return null;
  // Solid glyph pixels: the quarter that changed most when hidden.
  const core = [...pixels].sort((a, b) => delta(b.shown, b.behind) - delta(a.shown, a.behind)).slice(0, Math.max(1, Math.ceil(pixels.length * 0.25)));
  const parsed = cssColor ? parseCssColor(cssColor) : null;
  const over = (bg: Rgb): Rgb => {
    const [r, g, b, a] = parsed as Rgba;
    const k = Math.min(1, Math.max(0, a * opacity));
    return [r * k + bg[0] * (1 - k), g * k + bg[1] * (1 - k), b * k + bg[2] * (1 - k)];
  };
  const errors = parsed ? core.map((p) => delta(over(p.behind), p.shown)).sort((a, b) => a - b) : [];
  const declared = !!parsed && at(errors, 0.5) <= 24;
  const flat = medianRgb(core.map((p) => p.shown));
  const ratios: number[] = [];
  const fg: Rgb[] = [];
  for (const p of declared ? pixels : core) {
    const f = declared ? over(p.behind) : flat;
    fg.push(f);
    ratios.push(contrastRatio(f, p.behind));
  }
  ratios.sort((a, b) => a - b);
  return {ratio: at(ratios, 0.1), median: at(ratios, 0.5), background: medianRgb(pixels.map((p) => p.behind)), foreground: medianRgb(fg).map(Math.round) as unknown as Rgb, method: declared ? 'declared' : 'rendered', pixels: pixels.length};
};

/**
 * "#rrggbb" for reports.
 * @example toHex([10, 29, 56]) // "#0a1d38"
 */
export const toHex = (c: Rgb): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * Where a low-contrast text was in one sample.
 * @example const s: Sighting = {index: 0, text: 'Title', x: 96, y: 54, fontSize: 64};
 */
export interface Sighting {
  /** Index of the sample (consecutive samples have consecutive indices). */
  index: number;
  text: string;
  x: number;
  y: number;
  /** On-screen font size in px: sets how much movement still counts as "holding still". */
  fontSize: number;
}

/**
 * Longest run of consecutive samples showing the same words in nearly the same place (moved less than a quarter of
 * the font size per sample). A rolling digit or a flying word never builds a run; a held or slowly drifting line does.
 * @example longestStableRun([{index: 0, text: 'a', x: 0, y: 0, fontSize: 40}, {index: 1, text: 'a', x: 3, y: 0, fontSize: 40}]) // 2
 */
export const longestStableRun = (sightings: readonly Sighting[]): number => {
  const list = [...sightings].sort((a, b) => a.index - b.index);
  let best = 0;
  let run = 0;
  list.forEach((s, i) => {
    const p = list[i - 1];
    const stable = !!p && s.index === p.index + 1 && s.text === p.text && Math.hypot(s.x - p.x, s.y - p.y) <= s.fontSize * 0.25;
    run = stable ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
};
