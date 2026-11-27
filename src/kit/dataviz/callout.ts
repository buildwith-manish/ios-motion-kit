/**
 * Pure geometry for <Callout>: a label box placed near its anchor point and, when several callouts share a scene,
 * nudged apart (and off each other's anchor dots) with `nudgeRects` so none overlap. No DOM, no hooks.
 *
 * Unlike the other dataviz primitives, `width`/`height` and every anchor's `at` are CANVAS px, not design px — a
 * Callout exists to annotate a point another primitive already placed (a `lineLayout` point, a `DvRect` panel, a
 * bar tip), and those are already in canvas px. Only the label's own sizing (`leaderLength`, `gap`, `dotRadius`)
 * is a design-px default, scaled here by the theme's `unit()` so it stays the same relative size at any resolution.
 */
import {space, unit} from '../tokens/helpers';
import type {Theme, TypeRole} from '../tokens/types';
import {fitWidth, roleFontPx, textWidthPx, type DvPoint, type DvRect, type Tone} from './common';
import {nudgeRects, type NudgeRect} from './layout';

/** Side of the anchor a label prefers. 'auto' (default) picks whichever side has the most room in `bounds`. */
export type CalloutSide = 'auto' | 'top' | 'bottom' | 'left' | 'right';

/**
 * Plain-JSON data for one annotation (safe to load from a CSV/JSON file).
 * @example {at: {x: 860, y: 310}, text: 'Peak week', tone: 'positive'}
 */
export interface CalloutData {
  /** Point this callout points at, in canvas px (see the module note above). */
  at: DvPoint;
  text: string;
  /** Leader line + label accent colour. Default 'accent'. */
  tone?: Tone;
  side?: CalloutSide;
  /** Seconds this one callout starts, relative to the group's `start`. Default 0 — use to stagger a group. */
  delay?: number;
}

/** Inputs of {@link layoutCallout}. */
export interface CalloutLayoutInput {
  theme: Theme;
  data: readonly CalloutData[];
  /** Bounds callouts must stay inside, canvas px. Also where 'auto' measures room on each side. */
  width: number;
  height: number;
  /** Distance from the anchor dot to the label, design px. Default 36. */
  leaderLength?: number;
  /** Minimum gap between labels (and between a label and any anchor dot), design px. Default 8. */
  gap?: number;
  /** Anchor dot radius, design px. Default 5. */
  dotRadius?: number;
  /** Type role for the label text. Default 'caption'. */
  role?: TypeRole;
}

/** One resolved callout: anchor, the (possibly nudged) label box, and the side its leader approaches from. */
export interface CalloutItemLayout {
  anchor: DvPoint;
  label: DvRect;
  side: 'top' | 'bottom' | 'left' | 'right';
  text: string;
  tone: Tone;
  dotR: number;
}

/** Full layout for a group of callouts that must avoid each other. */
export interface CalloutLayout {
  width: number;
  height: number;
  items: CalloutItemLayout[];
}

/**
 * Places every label near its anchor (on the side with the most room, unless `side` is pinned), then runs
 * `nudgeRects` over all labels AND all anchor dots (as fixed obstacles) so labels never cover a dot or each other.
 * @example layoutCallout({theme, width: 1200, height: 600, data: [{at: {x: 200, y: 140}, text: 'Launch'}]})
 */
export const layoutCallout = (i: CalloutLayoutInput): CalloutLayout => {
  const {theme, data, width, height} = i;
  const u = unit(theme);
  const leader = (i.leaderLength ?? 36) * u;
  const gap = (i.gap ?? 8) * u;
  const dotR = (i.dotRadius ?? 5) * u;
  const role = i.role ?? 'caption';
  const fontPx = roleFontPx(theme, role);
  const padX = space(theme, 2);
  const padY = space(theme, 1);
  const labelH = fontPx * 1.3 + 2 * padY;

  const prelim = data.map((d) => {
    const a = d.at;
    const w = fitWidth(theme, textWidthPx(theme, role, d.text, {fontPx})) + 2 * padX;
    const room = {top: a.y, bottom: height - a.y, left: a.x, right: width - a.x};
    const side: 'top' | 'bottom' | 'left' | 'right' =
      d.side && d.side !== 'auto' ? d.side : (Object.keys(room) as Array<keyof typeof room>).reduce((best, k) => (room[k] > room[best] ? k : best), 'top' as keyof typeof room);
    const label: DvRect =
      side === 'top' ? {x: a.x - w / 2, y: a.y - leader - labelH, w, h: labelH}
        : side === 'bottom' ? {x: a.x - w / 2, y: a.y + leader, w, h: labelH}
        : side === 'left' ? {x: a.x - leader - w, y: a.y - labelH / 2, w, h: labelH}
        : {x: a.x + leader, y: a.y - labelH / 2, w, h: labelH};
    return {anchor: a, label, side, text: d.text, tone: d.tone ?? ('accent' as Tone)};
  });

  const bounds: DvRect = {x: 0, y: 0, w: width, h: height};
  const rects: NudgeRect[] = [];
  prelim.forEach((p) => {
    rects.push({x: p.anchor.x - dotR, y: p.anchor.y - dotR, w: dotR * 2, h: dotR * 2, fixed: true});
    rects.push({...p.label});
  });
  const resolved = nudgeRects(rects, {gap, bounds, iterations: 48});
  const items: CalloutItemLayout[] = prelim.map((p, k) => ({anchor: p.anchor, label: resolved[k * 2 + 1], side: p.side, text: p.text, tone: p.tone, dotR}));
  return {width, height, items};
};
