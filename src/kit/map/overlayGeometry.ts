/** Pure screen-space geometry for the map overlays (arcs, routes, callout layout). Units are canvas px. No React. */

export type P2 = [number, number];
export interface ScreenRect {x: number; y: number; w: number; h: number}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Point on the quadratic bezier p0, c, p1 at parameter t. */
export const quadAt = (p0: P2, c: P2, p1: P2, t: number): P2 => {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
};

/**
 * Control point that bows the segment a-b sideways by `bend` x its length. Positive bend bows to the left of the
 * direction of travel on screen (up when going left to right).
 */
export const arcControl = (a: P2, b: P2, bend: number): P2 => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return [(a[0] + b[0]) / 2 + dy * bend, (a[1] + b[1]) / 2 - dx * bend];
};

/** Cumulative arc length table of a quadratic bezier at `n` equal parameter steps (index 0 is 0). */
export const quadLengthTable = (p0: P2, c: P2, p1: P2, n = 64): number[] => {
  const t: number[] = [0];
  let prev = p0;
  for (let i = 1; i <= n; i++) {
    const q = quadAt(p0, c, p1, i / n);
    t.push(t[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1]));
    prev = q;
  }
  return t;
};

/** Bezier parameter at which the arc length is `frac` (0..1) of the total, from a {@link quadLengthTable}. */
export const paramAtFraction = (table: number[], frac: number): number => {
  const total = table[table.length - 1];
  if (total <= 0) return frac;
  const target = Math.min(1, Math.max(0, frac)) * total;
  let i = 1;
  while (i < table.length - 1 && table[i] < target) i++;
  const span = table[i] - table[i - 1] || 1;
  return (i - 1 + (target - table[i - 1]) / span) / (table.length - 1);
};

/** The part [0, t] of a quadratic bezier as a new bezier (de Casteljau): returns its control and end points. */
export const quadHead = (p0: P2, c: P2, p1: P2, t: number): {c: P2; end: P2} => ({
  c: [lerp(p0[0], c[0], t), lerp(p0[1], c[1], t)],
  end: quadAt(p0, c, p1, t),
});

/** Chaikin corner cutting (open polyline, ends kept): rounds a route without moving it far. */
export const chaikin = (pts: P2[], iterations = 2): P2[] => {
  let cur = pts;
  for (let it = 0; it < iterations && cur.length > 2; it++) {
    const next: P2[] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i], b = cur[i + 1];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
};

/** The first `frac` (0..1, by length) of a polyline, and its total length. */
export const polylineHead = (pts: P2[], frac: number): {pts: P2[]; total: number; head: P2} => {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  const target = Math.min(1, Math.max(0, frac)) * total;
  const out: P2[] = [pts[0]];
  let run = 0;
  for (let i = 0; i < seg.length; i++) {
    if (run + seg[i] >= target) {
      const t = seg[i] ? (target - run) / seg[i] : 0;
      out.push([lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]);
      return {pts: out, total, head: out[out.length - 1]};
    }
    run += seg[i];
    out.push(pts[i + 1]);
  }
  return {pts: out, total, head: out[out.length - 1]};
};

export const pathOf = (pts: P2[]): string => (pts.length ? `M${pts.map((p) => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`).join('L')}` : '');

/* ------------------------------------------------------------------ callout layout */

export const rectOverlap = (a: ScreenRect, b: ScreenRect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const ccw = (a: P2, b: P2, c: P2) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
/** True if segments a-b and c-d cross. */
export const segmentsCross = (a: P2, b: P2, c: P2, d: P2): boolean => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
/** True if segment a-b passes through the rectangle. */
export const segmentHitsRect = (a: P2, b: P2, r: ScreenRect): boolean => {
  const inside = (p: P2) => p[0] > r.x && p[0] < r.x + r.w && p[1] > r.y && p[1] < r.y + r.h;
  if (inside(a) || inside(b)) return true;
  const tl: P2 = [r.x, r.y], tr: P2 = [r.x + r.w, r.y], bl: P2 = [r.x, r.y + r.h], br: P2 = [r.x + r.w, r.y + r.h];
  return segmentsCross(a, b, tl, tr) || segmentsCross(a, b, tr, br) || segmentsCross(a, b, br, bl) || segmentsCross(a, b, bl, tl);
};

/** Where the leader from `anchor` meets the box: the point of the box edge nearest the anchor. */
export const leaderEnd = (anchor: P2, r: ScreenRect): P2 => [Math.min(r.x + r.w, Math.max(r.x, anchor[0])), Math.min(r.y + r.h, Math.max(r.y, anchor[1]))];

export interface CalloutBox {
  id: string;
  /** Anchor in screen px (where the leader line ends). */
  ax: number;
  ay: number;
  w: number;
  h: number;
}
export interface CalloutLayoutOptions {
  /** Boxes must stay inside (px). */
  bounds: ScreenRect;
  /** Rectangles to keep clear (pins, other UI). */
  obstacles?: ScreenRect[];
  /** Gap between anchor and box, px. */
  gap?: number;
  /** Minimum clear space between boxes, px. */
  margin?: number;
}
export interface PlacedCallout {
  /** Top-left of the box, px. */
  x: number;
  y: number;
  /** Offset of the top-left from the anchor. */
  dx: number;
  dy: number;
  /** Total penalty of the chosen spot (0 = no overlap, in bounds, shortest leader). */
  score: number;
}

const DIRS: [number, number][] = [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [1, 0], [-1, 0]];

const candidates = (b: CalloutBox, gap: number): {x: number; y: number}[] => {
  const out: {x: number; y: number}[] = [];
  for (const k of [1, 1.9, 3, 4.6]) {
    const g = gap * k;
    for (const [sx, sy] of DIRS) {
      const x = sx > 0 ? b.ax + g : sx < 0 ? b.ax - g - b.w : b.ax - b.w / 2;
      const y = sy > 0 ? b.ay + g : sy < 0 ? b.ay - g - b.h : b.ay - b.h / 2;
      out.push({x, y});
    }
  }
  return out;
};

/**
 * Greedy placement of callout boxes around their anchors with a few refinement passes: no box over another box, no
 * box over a pin (obstacle), no leader line through another box, no two leaders crossing, boxes inside the bounds,
 * and short leaders. Deterministic and pure: same input, same output. Order matters only for ties.
 * @example layoutCallouts([{id: 'a', ax: 400, ay: 300, w: 220, h: 96}], {bounds: {x: 80, y: 80, w: 1760, h: 920}})
 */
export const layoutCallouts = (boxes: CalloutBox[], opts: CalloutLayoutOptions): Record<string, PlacedCallout> => {
  const gap = opts.gap ?? 28;
  const margin = opts.margin ?? 12;
  const obstacles = opts.obstacles ?? [];
  const placed: Record<string, PlacedCallout> = {};
  const rectOf = (b: CalloutBox, p: {x: number; y: number}): ScreenRect => ({x: p.x, y: p.y, w: b.w, h: b.h});
  const grow = (r: ScreenRect, m: number): ScreenRect => ({x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m});

  const cost = (b: CalloutBox, p: {x: number; y: number}, idx: number): number => {
    const r = rectOf(b, p);
    let c = idx * 0.6;
    const anchor: P2 = [b.ax, b.ay];
    const end = leaderEnd(anchor, r);
    c += Math.hypot(end[0] - anchor[0], end[1] - anchor[1]) * 0.15;
    const bd = opts.bounds;
    c += (r.w * r.h - rectOverlap(r, bd)) * 40; // area outside the bounds (as costly as covering a pin)
    for (const o of obstacles) c += rectOverlap(r, o) * 40;
    for (const other of boxes) {
      if (other.id === b.id) continue;
      const q = placed[other.id];
      if (!q) continue;
      const qr = rectOf(other, q);
      c += rectOverlap(grow(r, margin / 2), grow(qr, margin / 2)) * 60;
      const qa: P2 = [other.ax, other.ay];
      const qe = leaderEnd(qa, qr);
      if (segmentsCross(anchor, end, qa, qe)) c += 5000;
      if (segmentHitsRect(anchor, end, qr)) c += 4000;
      if (segmentHitsRect(qa, qe, r)) c += 4000;
    }
    return c;
  };

  const place = (b: CalloutBox) => {
    let best: PlacedCallout | null = null;
    candidates(b, gap).forEach((p, idx) => {
      const s = cost(b, p, idx);
      if (!best || s < best.score - 1e-9) best = {x: p.x, y: p.y, dx: p.x - b.ax, dy: p.y - b.ay, score: s};
    });
    placed[b.id] = best!;
  };
  boxes.forEach(place);
  for (let pass = 0; pass < 3; pass++) {
    for (const b of boxes) {
      const prev = placed[b.id];
      delete placed[b.id];
      place(b);
      if (placed[b.id].score > prev.score + 1e-9) placed[b.id] = prev;
    }
  }
  return placed;
};
