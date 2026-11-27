/**
 * Zoom-aware simplification of a baked topology (pure). Arcs are simplified, not polygons, so neighbours keep sharing
 * exactly the same border (no gaps or slivers); arc end points never move and no ring is allowed to collapse.
 */
type Pt = [number, number];

/** Quantised, delta-encoded TopoJSON arcs -> lon/lat. */
const decodeArcs = (topo: any): Pt[][] => {
  const t = topo.transform;
  return (topo.arcs as Pt[][]).map((arc) => {
    if (!t) return arc;
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]] as Pt; });
  });
};

/** Douglas-Peucker with a distance in degrees (longitude scaled by cos latitude), keeping at least `min` points. */
const dp = (pts: Pt[], tol: number, min: number): Pt[] => {
  if (pts.length <= min) return pts;
  const k = Math.cos((pts[0][1] * Math.PI) / 180);
  // weight[i] = the tolerance below which point i survives (ends: always)
  const weight = new Float64Array(pts.length);
  weight[0] = weight[pts.length - 1] = Infinity;
  const stack: [number, number, number][] = [[0, pts.length - 1, Infinity]];
  while (stack.length) {
    const [a, b, cap] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = pts[a][0] * k, ay = pts[a][1], vx = pts[b][0] * k - ax, vy = pts[b][1] - ay;
    const len2 = vx * vx + vy * vy;
    let best = -1, far = a + 1;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] * k - ax, py = pts[i][1] - ay;
      const u = len2 ? Math.min(1, Math.max(0, (px * vx + py * vy) / len2)) : 0;
      const d = (px - u * vx) ** 2 + (py - u * vy) ** 2;
      if (d > best) { best = d; far = i; }
    }
    const w = Math.min(cap, Math.sqrt(best));
    weight[far] = w;
    stack.push([a, far, w], [far, b, w]);
  }
  // keep every point above the tolerance, and always the `min` most significant ones
  const floor = Array.from(weight).sort((x, y) => y - x)[min - 1];
  const limit = Math.min(tol, floor);
  return pts.filter((_, i) => weight[i] >= limit);
};

const cache = new WeakMap<object, {arcs: Pt[][]; levels: Map<number, any>}>();

/**
 * The topology with arcs simplified to `toleranceDeg` degrees (memoised per level). Closed arcs (a whole ring in one
 * arc) keep at least 4 points, open arcs at least 3 when they have them, so small shapes stay visible.
 */
export const simplifyTopo = (topo: any, toleranceDeg: number): any => {
  if (!(toleranceDeg > 0)) return topo;
  let c = cache.get(topo);
  if (!c) { c = {arcs: decodeArcs(topo), levels: new Map()}; cache.set(topo, c); }
  let out = c.levels.get(toleranceDeg);
  if (!out) {
    const arcs = c.arcs.map((a) => {
      const closed = a.length > 1 && a[0][0] === a[a.length - 1][0] && a[0][1] === a[a.length - 1][1];
      return dp(a, toleranceDeg, Math.min(a.length, closed ? 5 : 3));
    });
    out = {type: 'Topology', objects: topo.objects, arcs};
    c.levels.set(toleranceDeg, out);
  }
  return out;
};
