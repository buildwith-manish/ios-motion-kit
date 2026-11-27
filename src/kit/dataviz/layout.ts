/**
 * Label collision nudging. Pure and deterministic (same input, same output on every render worker).
 *  - `nudge1D`: labels that live on one line (bar footers, vertical-bar side labels).
 *  - `nudgeRects`: free 2D labels (callouts), with optional pinned obstacles and bounds.
 */
import type {DvRect} from './common';

/** One label on a line: where it would like to be centred and how long it is along the line. */
export interface Span1D {
  center: number;
  size: number;
}

/**
 * Pushes labels apart along one axis so none overlap (>= `gap` between neighbours) and all stay inside
 * [min, max]. Keeps order by desired centre; returns the resolved centres in the ORIGINAL order. If the labels
 * cannot all fit, they are packed from `min` (overlap is then unavoidable).
 * @example nudge1D([{center: 100, size: 80}, {center: 120, size: 80}], {gap: 8, min: 0, max: 400}) // [80, 168]
 */
export const nudge1D = (items: readonly Span1D[], o: {gap?: number; min: number; max: number}): number[] => {
  const gap = o.gap ?? 0;
  const order = items.map((_, i) => i).sort((a, b) => items[a].center - items[b].center || a - b);
  const start = order.map((i) => Math.min(o.max - items[i].size, Math.max(o.min, items[i].center - items[i].size / 2)));
  for (let k = 1; k < order.length; k++) {
    start[k] = Math.max(start[k], start[k - 1] + items[order[k - 1]].size + gap);
  }
  const last = order.length - 1;
  if (last >= 0 && start[last] + items[order[last]].size > o.max) start[last] = o.max - items[order[last]].size;
  for (let k = last - 1; k >= 0; k--) {
    start[k] = Math.min(start[k], start[k + 1] - gap - items[order[k]].size);
  }
  for (let k = 0; k <= last; k++) start[k] = Math.max(start[k], o.min);
  const out = new Array<number>(items.length);
  order.forEach((idx, k) => {
    out[idx] = start[k] + items[idx].size / 2;
  });
  return out;
};

/** A rectangle that may be pinned (an obstacle that never moves, e.g. a data point). */
export interface NudgeRect extends DvRect {
  fixed?: boolean;
}

/**
 * Separates overlapping rectangles by pushing each pair apart along the axis of least overlap, repeating until
 * clean or `iterations` runs out, then clamping movable ones into `bounds`. Fixed rects never move. Deterministic.
 * @example nudgeRects([{x: 0, y: 0, w: 100, h: 40}, {x: 10, y: 10, w: 100, h: 40}], {gap: 6})
 */
export const nudgeRects = (rects: readonly NudgeRect[], o: {gap?: number; bounds?: DvRect; iterations?: number} = {}): DvRect[] => {
  const gap = o.gap ?? 0;
  const out = rects.map((r) => ({x: r.x, y: r.y, w: r.w, h: r.h}));
  const clampIn = (r: DvRect): void => {
    if (!o.bounds) return;
    const b = o.bounds;
    r.x = Math.min(b.x + b.w - r.w, Math.max(b.x, r.x));
    r.y = Math.min(b.y + b.h - r.h, Math.max(b.y, r.y));
  };
  out.forEach((r, i) => {
    if (!rects[i].fixed) clampIn(r);
  });
  const iterations = o.iterations ?? 32;
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const fa = !!rects[i].fixed;
        const fb = !!rects[j].fixed;
        if (fa && fb) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
        if (ox <= 0 || oy <= 0) continue;
        const horizontal = ox < oy;
        const sign = horizontal ? Math.sign(b.x + b.w / 2 - (a.x + a.w / 2)) || 1 : Math.sign(b.y + b.h / 2 - (a.y + a.h / 2)) || 1;
        const amount = horizontal ? ox : oy;
        const share = fa || fb ? amount : amount / 2;
        if (!fa) (horizontal ? (a.x -= sign * share) : (a.y -= sign * share));
        if (!fb) (horizontal ? (b.x += sign * share) : (b.y += sign * share));
        moved = true;
      }
    }
    out.forEach((r, i) => {
      if (!rects[i].fixed) clampIn(r);
    });
    if (!moved) break;
  }
  return out;
};

/**
 * True when any two rectangles overlap by more than `tolerance` px in both axes.
 * @example anyOverlap(nudgeRects(labels, {gap: 6}))
 */
export const anyOverlap = (rects: readonly DvRect[], tolerance: number = 0.5): boolean => {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > tolerance && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > tolerance) return true;
    }
  }
  return false;
};
