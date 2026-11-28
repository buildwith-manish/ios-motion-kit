/** Pure, title-safe layout of a chartHeadline scene for any canvas (landscape or portrait). All numbers are canvas px. */
import {safeRect, unit} from '../tokens';
import type {Theme} from '../tokens';

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartHeadlineLayout {
  portrait: boolean;
  safe: LayoutRect;
  title: LayoutRect & {fontPx: number; lines: number};
  subtitle: (LayoutRect & {fontPx: number}) | null;
  chart: LayoutRect;
  caption: LayoutRect;
  source: LayoutRect;
}

const TITLE_CHAR_W = 0.56;
const LINE = 1.15;

/** Title font that fits `maxLines` lines in `width`, shrinking from `maxPx` to `minPx`. Returns the size and the line count at that size. */
export const fitClaim = (text: string, width: number, maxPx: number, minPx: number, maxLines: number): {fontPx: number; lines: number} => {
  const chars = Math.max(1, [...text].length);
  const linesAt = (px: number): number => Math.max(1, Math.ceil((chars * px * TITLE_CHAR_W) / width));
  let px = maxPx;
  while (px > minPx && linesAt(px) > maxLines) px -= 1;
  return {fontPx: px, lines: Math.min(linesAt(px), maxLines)};
};

export const chartHeadlineLayout = (theme: Theme, scene: {title: string; subtitle?: string}): ChartHeadlineLayout => {
  const u = unit(theme);
  const {width, height} = theme.canvas;
  const portrait = height > width;
  const s = safeRect(theme, 'title');
  const safe = {x: s.left, y: s.top, w: s.width, h: s.height};
  const maxPx = theme.type.title.size * u * (portrait ? 1 : 1.1);
  const fit = fitClaim(scene.title, safe.w, maxPx, maxPx * 0.55, portrait ? 4 : 2);
  const titleH = fit.lines * fit.fontPx * LINE;
  const title = {x: safe.x, y: safe.y, w: safe.w, h: titleH, fontPx: fit.fontPx, lines: fit.lines};
  const subPx = theme.type.body.size * u;
  const subtitle = scene.subtitle ? {x: safe.x, y: title.y + titleH + 8 * u, w: safe.w, h: subPx * 1.4, fontPx: subPx} : null;
  const headBottom = (subtitle ? subtitle.y + subtitle.h : title.y + titleH) + 24 * u;
  const capPx = theme.type.caption.size * u;
  const footerH = capPx * 1.5;
  const source = {x: safe.x, y: safe.y + safe.h - footerH, w: safe.w, h: footerH};
  const caption = {x: safe.x, y: source.y - capPx * 2.4, w: safe.w, h: capPx * 2.0};
  const chart = {x: safe.x, y: headBottom, w: safe.w, h: Math.max(1, caption.y - 12 * u - headBottom)};
  return {portrait, safe, title, subtitle, chart, caption, source};
};
