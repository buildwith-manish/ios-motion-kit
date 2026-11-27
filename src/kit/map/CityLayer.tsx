import React, {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {useMap} from './MapCanvas';

/** Baked city file (see scripts/map_bake_city.mjs). Metres, x east, y south, centre {0,0}. */
export interface CityData {
  id: string; name: string; lat: number; lng: number; detail: 'light' | 'rich'; vintage: string | null;
  bbox: {minX: number; maxX: number; minY: number; maxY: number}; centre: {x: number; y: number};
  classes: Partial<Record<'primary' | 'secondary' | 'local' | 'ramp' | 'service' | 'other' | 'water', string[]>>;
  polygons: {water: string[]; parks: string[]};
}
/** One entry of cities/alignment.json: city plane -> 1600x1000 outline plane. */
export interface CityAlignment {x: number; y: number; unitsPerMetre: number; unitsPerMetreNorth: number; rotationDeg: number}

const cache = new Map<string, Promise<any>>();
const load = (rel: string) => {
  let p = cache.get(rel);
  if (!p) { p = fetch(staticFile(`kit/map/cities/${rel}`)).then((r) => { if (!r.ok) throw new Error(`${rel} missing (run the "Bake map cities" workflow)`); return r.json(); }); cache.set(rel, p); }
  return p;
};

/** Loads a baked city (rich = `<id>.json`, light = `<id>.light.json`). */
export const useCity = (id: string, detail: 'light' | 'rich' = 'rich'): CityData | null => {
  const [d, setD] = useState<CityData | null>(null);
  useEffect(() => {
    const h = delayRender(`city ${id}`); let live = true;
    load(detail === 'rich' ? `${id}.json` : `${id}.light.json`).then((x) => { if (live) setD(x); continueRender(h); }, (e) => { console.error(e); continueRender(h); });
    return () => { live = false; };
  }, [id, detail]);
  return d;
};

/** SVG transform that puts a city plane onto the outline plane (same method as PayRanked's alignment). */
export const cityAlignmentTransform = (a: CityAlignment): string =>
  `translate(${a.x} ${a.y}) rotate(${a.rotationDeg}) scale(${a.unitsPerMetre} ${a.unitsPerMetreNorth})`;

/** Stroke widths in CSS px per class (non-scaling), before `weight`. */
export const CITY_STROKE_PX = {primary: 2.2, secondary: 1.4, ramp: 0.9, local: 0.6, service: 0.5, other: 0.4, water: 1} as const;

export interface CityLayerProps {
  city: CityData;
  /** Optional transform (e.g. cityAlignmentTransform) to place the city plane inside another plane. */
  transform?: string;
  /** Multiplies every stroke width (e.g. 1.5 for 4K review crops). */
  weight?: number;
  /** 0..1: draws classes progressively (primary first) for a build-on reveal. */
  reveal?: number;
}

/** City streets, water and parks from the kit map style. Pure function of its props. */
export const CityLayer: React.FC<CityLayerProps> = ({city, transform, weight = 1, reveal = 1}) => {
  const {style} = useMap();
  const W = CITY_STROKE_PX;
  const stage = (i: number, n: number) => Math.min(1, Math.max(0, reveal * n - i));
  const order = ['water', 'ramp', 'service', 'other', 'local', 'secondary', 'primary'] as const;
  const group = (cls: (typeof order)[number], i: number) => {
    const d = city.classes[cls]; if (!d?.length) return null;
    const major = cls === 'primary' || cls === 'secondary';
    return (
      <g key={cls} opacity={stage(i, order.length + 1)} fill="none" stroke={cls === 'water' ? style.stroke : major ? style.roadMajor : style.road} strokeWidth={W[cls] * weight} strokeLinecap="round" strokeLinejoin="round">
        {d.map((p, j) => <path key={j} d={p} vectorEffect="non-scaling-stroke" />)}
      </g>
    );
  };
  return (
    <g transform={transform}>
      {city.polygons.parks.length ? <g fill={style.park} stroke="none" opacity={stage(0, order.length + 1)}>{city.polygons.parks.map((p, i) => <path key={i} d={p} />)}</g> : null}
      {city.polygons.water.length ? <g fill={style.waterFill} stroke="none">{city.polygons.water.map((p, i) => <path key={i} d={p} />)}</g> : null}
      {order.map(group)}
    </g>
  );
};
