import React, {useEffect, useMemo, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {geoBounds, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import {useMap} from './MapCanvas';
import type {RegionKind} from './types';

const FILE: Record<Exclude<RegionKind, 'tract'>, string> = {
  state: 'states', county: 'counties', cbsa: 'cbsa', zcta: 'zcta',
};
const cache = new Map<string, Promise<any>>();
const loadTopo = (rel: string) => {
  let p = cache.get(rel);
  if (!p) {
    // staticFile() is the bundle's own public/ folder, never the network.
    p = fetch(staticFile(`kit/map/regions/${rel}`)).then((r) => {
      if (!r.ok) throw new Error(`RegionLayer: ${rel} missing (run the "Bake map regions" workflow)`);
      return r.json();
    });
    cache.set(rel, p);
  }
  return p;
};

/** Loads a baked region topology (delays the render until it is in). `rel` is relative to kit/map/regions/. */
export const useBakedTopo = (rel: string): any | null => {
  const [topo, setTopo] = useState<any>(null);
  useEffect(() => {
    const h = delayRender(`region ${rel}`);
    let live = true;
    loadTopo(rel).then((t) => { if (live) setTopo(t); continueRender(h); }, (e) => { console.error(e); continueRender(h); });
    return () => { live = false; };
  }, [rel]);
  return topo;
};

/** One feature (GeoJSON) of a baked topology by id, e.g. featureById(statesTopo, '08'). */
export const featureById = (topo: any, id: string): any => {
  const fc = feature(topo, topo.objects[Object.keys(topo.objects)[0]]) as any;
  return fc.features.find((f: any) => String(f.id) === id);
};
/** All features of a baked topology as a FeatureCollection (for fitExtent). */
export const allFeatures = (topo: any): any => feature(topo, topo.objects[Object.keys(topo.objects)[0]]);

export interface RegionLayerProps {
  kind: RegionKind;
  /** Tracts only: two-digit state FIPS of the baked tracts/<FIPS>.json. */
  state?: string;
  /** Render only ids with one of these prefixes (e.g. counties of state '06'). Omit for all in view. */
  idPrefix?: string | string[];
  /** Highlighted ids (accent fill). */
  highlight?: string[];
  /** Max points drawn (default 15000, the kit budget). Layers over budget keep the largest regions first. */
  maxPoints?: number;
  fill?: 'land' | 'landAlt' | 'none';
  weight?: number;
}

const countPoints = (d: string) => (d.match(/[ML]/g)?.length ?? 0);

/** Loads a baked layer and renders only the regions that intersect the view. Pure function of its props. */
export const RegionLayer: React.FC<RegionLayerProps> = ({kind, state, idPrefix, highlight, maxPoints = 15000, fill = 'land', weight = 1}) => {
  const {projection, style, view} = useMap();
  if (kind === 'tract' && !state) throw new Error('RegionLayer kind="tract" needs state (FIPS)');
  const rel = kind === 'tract' ? `tracts/${state}.json` : `${FILE[kind]}.json`;
  const topo = useBakedTopo(rel);

  const {normal, hi, points} = useMemo(() => {
    if (!topo) return {normal: [] as string[], hi: [] as string[], points: 0};
    const obj = topo.objects[Object.keys(topo.objects)[0]];
    const fc = feature(topo, obj) as any;
    const prefixes = idPrefix === undefined ? null : Array.isArray(idPrefix) ? idPrefix : [idPrefix];
    const hs = new Set(highlight ?? []);
    const gp = geoPath(projection).digits(1);
    const items: {d: string; area: number; hi: boolean; pts: number}[] = [];
    for (const f of fc.features) {
      const id = String(f.id ?? f.properties?.GEOID ?? '');
      if (prefixes && !prefixes.some((p) => id.startsWith(p))) continue;
      const [[bx0, by0], [bx1, by1]] = gp.bounds(f);
      if (!(bx1 >= view.x0 && bx0 <= view.x1 && by1 >= view.y0 && by0 <= view.y1)) continue; // out of view
      const d = gp(f);
      if (!d) continue;
      items.push({d, area: (bx1 - bx0) * (by1 - by0), hi: hs.has(id), pts: countPoints(d)});
    }
    items.sort((a, b) => b.area - a.area);
    let pts = 0;
    const kept = items.filter((i) => (pts + i.pts <= maxPoints ? ((pts += i.pts), true) : false));
    return {normal: kept.filter((i) => !i.hi).map((i) => i.d), hi: kept.filter((i) => i.hi).map((i) => i.d), points: pts};
  }, [topo, projection, view, idPrefix, highlight, maxPoints]);

  void geoBounds; void points;
  return (
    <g>
      <g fill={fill === 'none' ? 'none' : style[fill]} stroke={style.stroke} strokeWidth={style.hairline * weight} strokeLinejoin="round">
        {normal.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
      </g>
      {hi.length ? (
        <g fill={style.highlightFill} stroke={style.highlight} strokeWidth={style.hairline * weight * 1.6} strokeLinejoin="round">
          {hi.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
        </g>
      ) : null}
    </g>
  );
};
