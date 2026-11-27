import React, {useEffect, useMemo, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {feature} from 'topojson-client';
import {useMap} from './MapCanvas';
import {selectShapes, MAX_POINTS} from './regions';
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
  /** Point budget (default 15000). Geometry is simplified to the zoom to fit it; regions are never dropped. */
  maxPoints?: number;
  fill?: 'land' | 'landAlt' | 'none';
  weight?: number;
}

/** Loads a baked layer and renders only the regions that intersect the view. Pure function of its props. */
export const RegionLayer: React.FC<RegionLayerProps> = ({kind, state, idPrefix, highlight, maxPoints = MAX_POINTS, fill = 'land', weight = 1}) => {
  const {projection, style, view} = useMap();
  if (kind === 'tract' && !state) throw new Error('RegionLayer kind="tract" needs state (FIPS)');
  const rel = kind === 'tract' ? `tracts/${state}.json` : `${FILE[kind]}.json`;
  const topo = useBakedTopo(rel);
  const shapes = topo ? selectShapes(topo, projection, view, {idPrefix}, maxPoints) : [];
  const hs = new Set(highlight ?? []);
  const normal = shapes.filter((s) => !hs.has(s.id));
  const hi = shapes.filter((s) => hs.has(s.id));

  return (
    <g>
      <g fill={fill === 'none' ? 'none' : style[fill]} stroke={style.stroke} strokeWidth={style.hairline * weight} strokeLinejoin="round">
        {normal.map((s) => <path key={s.id} d={s.d} vectorEffect="non-scaling-stroke" />)}
      </g>
      {hi.length ? (
        <g fill={style.highlightFill} stroke={style.highlight} strokeWidth={style.hairline * weight * 1.6} strokeLinejoin="round">
          {hi.map((s) => <path key={s.id} d={s.d} vectorEffect="non-scaling-stroke" />)}
        </g>
      ) : null}
    </g>
  );
};
