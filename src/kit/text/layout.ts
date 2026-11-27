import {measureText, type FontMetrics} from './metrics';

/** A word placed on a line. */
export interface LayoutWord {
  text: string;
  /** Index among all words of the layout, in logical order. */
  index: number;
  /** Width in px at the laid-out font size. */
  width: number;
}

export interface LayoutLine {
  words: LayoutWord[];
  /** Width in px including the spaces between words. */
  width: number;
}

export interface TextLayout {
  lines: LayoutLine[];
  /** Widest line, px. */
  width: number;
  /** Total height in px for the given line height. */
  height: number;
  /** True when more lines were needed than `maxLines`, or one word is wider than `maxWidth`. */
  overflow: boolean;
}

export interface LayoutOptions {
  fontSize: number;
  metrics: FontMetrics;
  /** Letter spacing in em (as in theme.type[role].tracking). Default 0. */
  letterSpacingEm?: number;
  /** Box width in px. */
  maxWidth: number;
  /** Line limit; extra lines are still returned but flag `overflow`. Default unlimited. */
  maxLines?: number;
  /** Unitless line-height multiplier, used for `height`. Default 1.15. */
  lineHeight?: number;
  /**
   * Safety multiplier on measured widths (default 1.03). The width table has no kerning, so real text can differ by
   * a percent or two; the slack keeps a line from being predicted to fit and then wrapping in the browser.
   */
  slack?: number;
}

const DEFAULT_SLACK = 1.03;

/**
 * Greedy line breaking of already-split words. Pure: widths come from the font's width table, never the DOM.
 * Direction does not change breaking (lines break in logical order); it only changes how lines are displayed.
 * @example layoutWords(['Rent', 'is', 'up'], {fontSize: 96, metrics: INTER_700, maxWidth: 900})
 */
export const layoutWords = (words: readonly string[], o: LayoutOptions): TextLayout => {
  const {fontSize, metrics, letterSpacingEm = 0, maxWidth, maxLines = Infinity, lineHeight = 1.15, slack = DEFAULT_SLACK} = o;
  const spaceW = (metrics.space + letterSpacingEm) * fontSize;
  const lines: LayoutLine[] = [];
  let cur: LayoutWord[] = [];
  let curW = 0;
  let overflow = false;
  words.forEach((text, index) => {
    const width = measureText(text, fontSize, metrics, letterSpacingEm);
    if (width * slack > maxWidth) overflow = true;
    const next = cur.length === 0 ? width : curW + spaceW + width;
    if (cur.length > 0 && next * slack > maxWidth) {
      lines.push({words: cur, width: curW});
      cur = [{text, index, width}];
      curW = width;
    } else {
      cur.push({text, index, width});
      curW = next;
    }
  });
  if (cur.length > 0) lines.push({words: cur, width: curW});
  if (lines.length > maxLines) overflow = true;
  return {lines, width: lines.reduce((m, l) => Math.max(m, l.width), 0), height: lines.length * fontSize * lineHeight, overflow};
};

/** Splits on whitespace. */
export const splitWords = (text: string): string[] => text.split(/\s+/).filter((w) => w.length > 0);

/**
 * Line-breaks a string. Explicit "\n" forces a break; otherwise as layoutWords().
 * @example layoutText('Your rent,\nexplained', {fontSize: 96, metrics: INTER_700, maxWidth: 1200}).lines.length // 2
 */
export const layoutText = (text: string, o: LayoutOptions): TextLayout => {
  const paragraphs = text.split('\n');
  const lines: LayoutLine[] = [];
  let overflow = false;
  let offset = 0;
  for (const p of paragraphs) {
    const l = layoutWords(splitWords(p), {...o, maxLines: Infinity});
    l.lines.forEach((line) => lines.push({...line, words: line.words.map((w) => ({...w, index: w.index + offset}))}));
    offset += splitWords(p).length;
    if (l.overflow) overflow = true;
  }
  const maxLines = o.maxLines ?? Infinity;
  if (lines.length > maxLines) overflow = true;
  return {lines, width: lines.reduce((m, l) => Math.max(m, l.width), 0), height: lines.length * o.fontSize * (o.lineHeight ?? 1.15), overflow};
};

export interface FitOptions extends Omit<LayoutOptions, 'fontSize'> {
  /** Largest font size to try, px. */
  maxFontSize: number;
  /** Smallest allowed, px. Default maxFontSize / 3. */
  minFontSize?: number;
  /** Box height in px; omit to fit on width and line count only. */
  maxHeight?: number;
}

export interface FitResult {
  fontSize: number;
  layout: TextLayout;
  /** False when even `minFontSize` overflowed (the result is then at the minimum). */
  fits: boolean;
}

/**
 * Largest font size (0.5 px steps, binary search) at which the text fits `maxWidth` x `maxHeight` within `maxLines`.
 * Pure calculation on the width table: no DOM measurement at render time.
 * @example const {fontSize} = fitText('Cheapest city to rent in', {maxWidth: 900, maxHeight: 300, maxFontSize: 140, metrics: INTER_700, lineHeight: 1.1, maxLines: 2});
 */
export const fitText = (text: string, o: FitOptions): FitResult => {
  const min = Math.max(1, o.minFontSize ?? o.maxFontSize / 3);
  const attempt = (fontSize: number): {layout: TextLayout; ok: boolean} => {
    const layout = layoutText(text, {...o, fontSize});
    const ok = !layout.overflow && (o.maxHeight === undefined || layout.height <= o.maxHeight + 1e-6);
    return {layout, ok};
  };
  const top = attempt(o.maxFontSize);
  if (top.ok) return {fontSize: o.maxFontSize, layout: top.layout, fits: true};
  let lo = min;
  let hi = o.maxFontSize;
  const bottom = attempt(lo);
  if (!bottom.ok) return {fontSize: lo, layout: bottom.layout, fits: false};
  let best = bottom;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    const a = attempt(mid);
    if (a.ok) {
      lo = mid;
      best = a;
    } else hi = mid;
  }
  const fontSize = Math.floor(lo * 2) / 2;
  const final = attempt(fontSize);
  return {fontSize, layout: final.ok ? final.layout : best.layout, fits: true};
};
