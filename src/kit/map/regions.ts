/**
 * Region selection and projection, cached so a video does not re-decode a topology or re-project it every frame.
 * Everything here is a pure function of its arguments (the caches only memoise).
 */
import {geoBounds, geoCentroid, geoContains, geoPath, type GeoProjection} from 'd3-geo';
import {feature} from 'topojson-client';
import {simplifyTopo} from './simplify';
import type {PlaneBox} from './types';

/** The kit's budget of path points on screen per layer. */
export const MAX_POINTS = 15000;
/** Screen-space simplification tolerances in plane px, tried in order until a layer fits the budget. */
const TOLERANCES_PX = [0.4, 0.6, 0.9, 1.3, 2, 3, 4.5];

/** One projected region in plane units. */
export interface MapShape {
  id: string;
  /** NAME property when the baked layer carries one (states, counties, CBSAs). */
  name?: string;
  d: string;
  /** [[x0,y0],[x1,y1]] in plane units. */
  bounds: [[number, number], [number, number]];
  centroid: [number, number];
  /** Number of path vertices (for the kit's 15k-point budget). */
  points: number;
}

/** Which regions to take from a layer. All given filters apply together; omit all for "everything in view". */
export interface RegionSelection {
  ids?: readonly string[];
  idPrefix?: string | readonly string[];
  /** Keep regions whose centroid lies inside this GeoJSON feature (e.g. the ZCTAs of a CBSA). */
  within?: any;
}

const featureCache = new WeakMap<object, Map<string, any>>();
/** Decoded features of a baked topology, by id. Features without geometry are dropped. */
export const topoFeatures = (topo: any): Map<string, any> => {
  let m = featureCache.get(topo);
  if (!m) {
    const fc = feature(topo, topo.objects[Object.keys(topo.objects)[0]]) as any;
    m = new Map();
    for (const f of fc.features) if (f.geometry) m.set(String(f.id ?? f.properties?.GEOID ?? ''), f);
    featureCache.set(topo, m);
  }
  return m;
};

const centroidCache = new WeakMap<object, [number, number]>();
const lonLatCentroid = (f: any): [number, number] => {
  let c = centroidCache.get(f);
  if (!c) { c = geoCentroid(f) as [number, number]; centroidCache.set(f, c); }
  return c;
};

const withinCache = new WeakMap<object, WeakMap<object, string[]>>();
/** Ids (sorted) of the layer's regions whose centroid is inside `container`. Not for containers crossing 180 degrees. */
export const idsWithin = (topo: any, container: any): string[] => {
  let byC = withinCache.get(topo);
  if (!byC) { byC = new WeakMap(); withinCache.set(topo, byC); }
  let ids = byC.get(container);
  if (!ids) {
    const [[w, s], [e, n]] = geoBounds(container);
    ids = [];
    for (const [id, f] of topoFeatures(topo)) {
      const [x, y] = lonLatCentroid(f);
      if (x >= w && x <= e && y >= s && y <= n && geoContains(container, [x, y])) ids.push(id);
    }
    ids.sort();
    byC.set(container, ids);
  }
  return ids;
};

/** A cheap signature of a projection: where three reference points land. Equal signatures draw equal paths. */
export const projectionKey = (p: GeoProjection): string =>
  ([[-100, 40], [-90, 33], [-112, 46]] as [number, number][]).map((q) => p(q)?.map((v) => v.toFixed(3)).join(',') ?? '-').join(';');

const shapeCache = new WeakMap<object, Map<string, MapShape[]>>();

/** Plane px per degree of latitude around the first selected region (used to turn a px tolerance into degrees). */
const pxPerDegree = (projection: GeoProjection, f: any): number => {
  const [x, y] = lonLatCentroid(f);
  const a = projection([x, y]), b = projection([x, y + 0.1]);
  return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) * 10 : 0;
};

/**
 * Projected regions of a layer, culled to `view`, in the order of `ids` when given (unknown ids are skipped).
 * Geometry is simplified to the zoom: sub-pixel detail is removed, and more if needed to stay under `maxPoints`.
 * Regions are never dropped; at the coarsest tolerance a layer may still exceed the budget (see MapShape.points).
 */
export const selectShapes = (topo: any, projection: GeoProjection, view: PlaneBox, sel: RegionSelection = {}, maxPoints: number = MAX_POINTS): MapShape[] => {
  const within = sel.within ? idsWithin(topo, sel.within) : null;
  const prefixes = sel.idPrefix === undefined ? null : typeof sel.idPrefix === 'string' ? [sel.idPrefix] : sel.idPrefix;
  const key = [projectionKey(projection), view.x0, view.y0, view.x1, view.y1, maxPoints, sel.ids?.join(',') ?? '*', prefixes?.join(',') ?? '*', within?.join(',') ?? '*'].join('|');
  let m = shapeCache.get(topo);
  if (!m) { m = new Map(); shapeCache.set(topo, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const all = topoFeatures(topo);
  const withinSet = within ? new Set(within) : null;
  const wanted = sel.ids ?? within ?? Array.from(all.keys());
  const gp = geoPath(projection).digits(1);
  // first the cheap part: which regions are in view
  const visible: string[] = [];
  for (const id of wanted) {
    const f = all.get(id);
    if (!f || (withinSet && !withinSet.has(id)) || (prefixes && !prefixes.some((p) => id.startsWith(p)))) continue;
    const [[x0, y0], [x1, y1]] = gp.bounds(f);
    if (x1 >= view.x0 && x0 <= view.x1 && y1 >= view.y0 && y0 <= view.y1) visible.push(id);
  }
  // the px scale comes from the layer's first region, so one tolerance serves every selection of one layer and view
  const scale = visible.length ? pxPerDegree(projection, all.get(all.keys().next().value as string)) || pxPerDegree(projection, all.get(visible[0])) : 0;
  let out: MapShape[] = [];
  for (const px of TOLERANCES_PX) {
    // round the level so a slow zoom reuses simplified topologies
    const tol = scale ? 2 ** (Math.round(Math.log2(px / scale) * 4) / 4) : 0;
    const features = topoFeatures(simplifyTopo(topo, tol));
    out = [];
    let total = 0;
    for (const id of visible) {
      const f = features.get(id);
      const d = f && gp(f);
      if (!d) continue;
      const points = d.match(/[ML]/g)?.length ?? 0;
      total += points;
      out.push({id, name: f.properties?.NAME, d, bounds: gp.bounds(f) as MapShape['bounds'], centroid: gp.centroid(f) as [number, number], points});
    }
    if (total <= maxPoints) break;
  }
  if (m.size > 32) m.clear(); // a moving camera should move the SVG, not re-project; keep memory bounded if it does
  m.set(key, out);
  return out;
};
