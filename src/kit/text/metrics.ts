import inter600 from './fonts/inter-600.json';
import inter700 from './fonts/inter-700.json';

/**
 * Precomputed width table for one font + weight. Advances are in em (so they scale with any font size) and are
 * produced at build time by scripts/kit-font-metrics.py (from a font file) or by a canvas measureText script.
 * Nothing here measures the DOM, so layout is a pure function and identical in every parallel render worker.
 */
export interface FontMetrics {
  name: string;
  weight: number;
  /** Advance of ' ' in em. */
  space: number;
  /** Advance of the digits in em (tabular figures share one width). */
  digit: number;
  /** Advance used for characters missing from `advances` in scripts we have no table for, em. */
  fallback: number;
  /** char -> advance in em. */
  advances: Record<string, number>;
}

/** Inter SemiBold (600), the kit's default regular weight. Latin, Latin-1, typographic punctuation, currency. */
export const INTER_600: FontMetrics = inter600 as FontMetrics;
/** Inter Bold (700), the kit's default bold weight. */
export const INTER_700: FontMetrics = inter700 as FontMetrics;

/**
 * Picks the shipped table nearest to a numeric weight. Pass your own `FontMetrics` to components when the video
 * uses a different font (generate it with scripts/kit-font-metrics.py).
 * @example const m = metricsForWeight(theme.weights.bold); // INTER_700
 */
export const metricsForWeight = (weight: number): FontMetrics => (weight >= 700 ? INTER_700 : INTER_600);

const isCombining = (cp: number): boolean =>
  (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x591 && cp <= 0x5c7) || (cp >= 0x64b && cp <= 0x65f) || cp === 0x200d || cp === 0x200c || (cp >= 0xfe00 && cp <= 0xfe0f);

/**
 * Advance of one character in em. Table first; otherwise a per-script estimate (Hebrew, Arabic, CJK, emoji) and
 * zero for combining marks. Estimates are rough: supply a real table for non-Latin captions.
 * @example advanceOf('W', INTER_700) // ~0.99
 */
export const advanceOf = (ch: string, m: FontMetrics): number => {
  const known = m.advances[ch];
  if (known !== undefined) return known;
  const cp = ch.codePointAt(0) ?? 0;
  if (isCombining(cp)) return 0;
  if ((cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xff00 && cp <= 0xffef)) return 1;
  if (cp >= 0x1f000) return 1.15;
  if (cp >= 0x590 && cp <= 0x5ff) return 0.56;
  if ((cp >= 0x600 && cp <= 0x6ff) || (cp >= 0x750 && cp <= 0x77f)) return 0.58;
  return m.fallback;
};

/**
 * Width in px of a single-line string at `fontSize`, plus `letterSpacingEm` per character. No kerning/shaping.
 * @example measureText('$12,400', 96, INTER_700, -0.02)
 */
export const measureText = (text: string, fontSize: number, m: FontMetrics, letterSpacingEm: number = 0): number => {
  let em = 0;
  let n = 0;
  for (const ch of text) {
    em += advanceOf(ch, m);
    n++;
  }
  return (em + n * letterSpacingEm) * fontSize;
};

/** First strongly-directional character decides: Hebrew/Arabic -> 'rtl', anything with Latin letters -> 'ltr'. */
export const detectDirection = (text: string): 'ltr' | 'rtl' => {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if ((cp >= 0x590 && cp <= 0x8ff) || (cp >= 0xfb1d && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)) return 'rtl';
    if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x24f) || (cp >= 0x370 && cp <= 0x58f)) return 'ltr';
  }
  return 'ltr';
};

/**
 * True when characters join or reorder (Arabic, Indic, Thai...), so splitting into per-character elements would
 * break shaping. <RevealText mode="chars"> falls back to words for such text.
 */
export const hasConnectedScript = (text: string): boolean => {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if ((cp >= 0x600 && cp <= 0x77f) || (cp >= 0x900 && cp <= 0xdff) || (cp >= 0xe00 && cp <= 0xeff) || (cp >= 0xfb50 && cp <= 0xfeff)) return true;
  }
  return false;
};
