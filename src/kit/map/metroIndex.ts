/**
 * Geometry helpers for <MetroMap>: a bounding-box index over a baked city (built once per city object), view culling,
 * merging of the visible paths into few big paths (at most CHUNK_POINTS points each, under the ~15k budget), and the
 * metro boundary projected into the city's metre plane. Pure functions.
 */
import type {CityData} from './CityLayer';
import type {PlaneBox} from './types';
import {METRO_CLASS_ORDER, type MetroClass} from './metroLod';

/** A merged path never holds more than this many points (budget: no path above ~15k). */
export const CHUNK_POINTS = 12000;

interface Item {d: string; x0: number; y0: number; x1: number; y1: number; pts: number}
export interface MetroIndex {
  classes: Record<string, Item[]>;
  parks: Item[];
  water: Item[];
}

const NUM = /-?\d+(?:\.\d+)?/g;
const toItem = (d: string): Item => {
  const m = d.match(NUM);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const n = m ? m.length - (m.length % 2) : 0;
  for (let i = 0; i < n; i += 2) {
    const x = +m![i], y = +m![i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return {d, x0, y0, x1, y1, pts: n / 2};
};

const cache = new WeakMap<CityData, MetroIndex>();
/** Index of a baked city (memoised per city object). */
export const metroIndex = (city: CityData): MetroIndex => {
  let idx = cache.get(city);
  if (!idx) {
    const classes: Record<string, Item[]> = {};
    for (const [k, v] of Object.entries(city.classes)) classes[k] = (v ?? []).map(toItem);
    idx = {classes, parks: (city.polygons.parks ?? []).map(toItem), water: (city.polygons.water ?? []).map(toItem)};
    cache.set(city, idx);
  }
  return idx;
};

const hits = (it: Item, v: PlaneBox, margin: number): boolean => it.x1 >= v.x0 - margin && it.x0 <= v.x1 + margin && it.y1 >= v.y0 - margin && it.y0 <= v.y1 + margin;

export interface Chunk {d: string; paths: number; points: number}

/** Visible items merged into chunks of at most `maxPoints` points (a single oversize item gets a chunk of its own). */
export const visibleChunks = (items: Item[], view: PlaneBox, margin = 40, maxPoints = CHUNK_POINTS): Chunk[] => {
  const out: Chunk[] = [];
  let cur: Chunk = {d: '', paths: 0, points: 0};
  for (const it of items) {
    if (!it.pts || !hits(it, view, margin)) continue;
    if (cur.points && cur.points + it.pts > maxPoints) { out.push(cur); cur = {d: '', paths: 0, points: 0}; }
    cur.d += it.d; cur.paths += 1; cur.points += it.pts;
  }
  if (cur.points) out.push(cur);
  return out;
};

export interface MetroBudget {
  /** Source paths inside the view, per layer. */
  visiblePaths: number;
  /** Merged <path> elements actually emitted. */
  elements: number;
  /** Total points emitted (a glow pass counts again). */
  points: number;
  /** Largest single element, in points. */
  maxElementPoints: number;
}

export const emptyBudget = (): MetroBudget => ({visiblePaths: 0, elements: 0, points: 0, maxElementPoints: 0});
export const addChunks = (b: MetroBudget, chunks: Chunk[], passes = 1): void => {
  for (const c of chunks) {
    b.visiblePaths += c.paths; b.elements += passes; b.points += c.points * passes;
    if (c.points > b.maxElementPoints) b.maxElementPoints = c.points;
  }
};

/* ---- metro boundary (CBSA outline) -> city metre plane ---- */

const M_LAT = 110574, M_LON_EQ = 111320; // the baker's and the alignment script's local formulas

/** lon/lat -> the city plane (x east, y SOUTH, metres, centre {0,0}); the exact inverse the baker used. */
export const lonLatToCity = (city: Pick<CityData, 'lat' | 'lng'>, lon: number, lat: number): [number, number] => {
  const k = Math.cos((city.lat * Math.PI) / 180) * M_LON_EQ;
  return [(lon - city.lng) * k, (city.lat - lat) * M_LAT];
};

type P = [number, number];
/** Douglas-Peucker in metres (iterative, so long rings are safe). */
export const simplifyMetres = (pts: P[], tol: number): P[] => {
  if (pts.length < 3 || tol <= 0) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[a][0], ay = pts[a][1], vx = pts[b][0] - ax, vy = pts[b][1] - ay, len2 = vx * vx + vy * vy;
    let best = -1, far = -1;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] - ax, py = pts[i][1] - ay;
      const u = len2 ? Math.min(1, Math.max(0, (px * vx + py * vy) / len2)) : 0;
      const d = (px - u * vx) ** 2 + (py - u * vy) ** 2;
      if (d > best) { best = d; far = i; }
    }
    if (far >= 0 && best > t2) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
};

/** GeoJSON Polygon/MultiPolygon (or Feature of one) -> rings of lon/lat. */
const ringsOf = (geo: any): P[][] => {
  const g = geo?.type === 'Feature' ? geo.geometry : geo;
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates as P[][];
  if (g.type === 'MultiPolygon') return (g.coordinates as P[][][]).flat();
  return [];
};

/**
 * Boundary outline as one SVG path in the city plane. Rings that miss the view are dropped; the rest are simplified to
 * `tolerance` metres (pass ~0.4 px worth, i.e. 0.4 / pixelsPerMetre) so the point count follows the zoom.
 */
export const boundaryPath = (city: Pick<CityData, 'lat' | 'lng'>, boundary: unknown, view: PlaneBox, tolerance: number): {d: string; points: number} => {
  let d = '', points = 0;
  for (const ring of ringsOf(boundary)) {
    const pts = ring.map(([lon, lat]) => lonLatToCity(city, lon, lat));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < view.x0 || x0 > view.x1 || y1 < view.y0 || y0 > view.y1) continue;
    const s = simplifyMetres(pts, tolerance);
    if (s.length < 2) continue;
    d += 'M' + s.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
    points += s.length;
  }
  return {d, points};
};

/* ---- view + geometry for one frame ---- */

export interface MetroViewInput {
  width: number; height: number;
  /** 1 = the city box fills the longer canvas side. */
  zoom: number;
  /** Centre of the view in city metres (x east, y south). */
  center?: {x: number; y: number};
  /** Rotation applied to the city plane (alignment.rotationDeg to match the US map; 0 = north up). */
  rotationDeg?: number;
  /** North-south scale relative to east-west (alignment.unitsPerMetreNorth / unitsPerMetre; default 1). Applied about the centre, before the rotation. */
  northScale?: number;
}
export interface MetroView {
  /** Pixels per metre. */
  ppm: number;
  /** Visible box in the (unrotated) city plane when rotation is 0; with rotation, the box in the rotated frame. */
  box: PlaneBox;
  /** Bounding box in city-plane metres that must be drawn (covers the view after un-rotating). */
  cull: PlaneBox;
}

export const metroView = (city: Pick<CityData, 'bbox'>, i: MetroViewInput): MetroView => {
  const side = city.bbox.maxX - city.bbox.minX;
  const ppm = (Math.max(i.width, i.height) / side) * i.zoom;
  const cx = i.center?.x ?? 0, cy = i.center?.y ?? 0;
  const hw = i.width / 2 / ppm, hh = i.height / 2 / ppm;
  const box: PlaneBox = {x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh};
  const a = ((i.rotationDeg ?? 0) * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const rw = c * hw + s * hh, rh = (s * hw + c * hh) / (i.northScale ?? 1); // metres: undo the north-south scale applied after the cull box
  return {ppm, box, cull: {x0: cx - rw, y0: cy - rh, x1: cx + rw, y1: cy + rh}};
};

export interface MetroGeometry {
  view: MetroView;
  roads: Partial<Record<MetroClass, Chunk[]>>;
  waterLines: Chunk[];
  waterPolys: Chunk[];
  parks: Chunk[];
  budget: MetroBudget;
}

/**
 * Everything a frame draws, as merged chunks. Classes whose `lod` opacity is ~0 are skipped entirely. `glow` counts the
 * extra pass of the major-road glow in the budget.
 */
export const metroGeometry = (city: CityData, input: MetroViewInput, lod: Record<MetroClass, number>, glow = false): MetroGeometry => {
  const idx = metroIndex(city);
  const view = metroView(city, input);
  const budget = emptyBudget();
  const roads: Partial<Record<MetroClass, Chunk[]>> = {};
  for (const cls of METRO_CLASS_ORDER) {
    if (lod[cls] < 0.002 || !idx.classes[cls]) continue;
    const ch = visibleChunks(idx.classes[cls], view.cull);
    roads[cls] = ch;
    addChunks(budget, ch, cls === 'primary' && glow ? 2 : 1);
  }
  const waterLines = idx.classes.water ? visibleChunks(idx.classes.water, view.cull) : [];
  const waterPolys = visibleChunks(idx.water, view.cull);
  const parks = visibleChunks(idx.parks, view.cull);
  addChunks(budget, waterLines); addChunks(budget, waterPolys); addChunks(budget, parks);
  return {view, roads, waterLines, waterPolys, parks, budget};
};
