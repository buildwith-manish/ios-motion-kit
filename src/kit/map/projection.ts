/**
 * Projection helpers. `fitUsOutline` reproduces PayRanked's us_outline plane: plain d3 geoAlbers fitted to the 48 states
 * + DC landmass inside a 1600 x 1000 plane with PAD 30 (so an alignment baked against that plane transfers).
 */
import {geoAlbers, geoAlbersUsa, geoPath, type GeoProjection} from 'd3-geo';
import {feature} from 'topojson-client';
import type {GeoPermissibleObjects} from 'd3-geo';
import type {PlaneBox} from './types';

export const OUTLINE_W = 1600;
export const OUTLINE_H = 1000;
export const OUTLINE_PAD = 30;

/** Generic: fit a d3 projection so `obj` fills the extent [[x0,y0],[x1,y1]]. */
export const fitExtent = (projection: GeoProjection, obj: GeoPermissibleObjects, box: PlaneBox): GeoProjection =>
  projection.fitExtent([[box.x0, box.y0], [box.x1, box.y1]], obj);

/** geoAlbers fitted to `obj` in a w x h plane with `pad` on every side. */
export const fitAlbers = (obj: GeoPermissibleObjects, w: number, h: number, pad = 0): GeoProjection =>
  fitExtent(geoAlbers(), obj, {x0: pad, y0: pad, x1: w - pad, y1: h - pad});

/** geoAlbersUsa (AK/HI composite) fitted the same way. */
export const fitAlbersUsa = (obj: GeoPermissibleObjects, w: number, h: number, pad = 0): GeoProjection =>
  fitExtent(geoAlbersUsa(), obj, {x0: pad, y0: pad, x1: w - pad, y1: h - pad});

/** Extracts the contiguous-US land feature from baked outline.json (objects.combined, id 'outline'). */
export const outlineLand = (topo: any): GeoPermissibleObjects => {
  const obj = topo.objects.combined ?? topo.objects[Object.keys(topo.objects)[0]];
  const fc = feature(topo, obj) as any;
  const f = fc.features.find((x: any) => String(x.id) === 'outline');
  if (!f) throw new Error('outline.json has no "outline" piece');
  return f;
};

/** PayRanked-equivalent outline-plane projection (1600x1000, PAD 30). Needs the baked outline topology. */
export const fitUsOutline = (outlineTopo: any): GeoProjection =>
  fitAlbers(outlineLand(outlineTopo), OUTLINE_W, OUTLINE_H, OUTLINE_PAD);

/** SVG path string generator for a projection (1 decimal, like the reference). */
export const pathFor = (projection: GeoProjection, digits = 1) => geoPath(projection).digits(digits);
