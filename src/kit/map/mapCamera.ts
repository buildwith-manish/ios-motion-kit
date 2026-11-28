/**
 * Map camera: where the camera looks on the US map, flights between places, and the maths that keeps a metro layer
 * glued to the country layer. Pure functions, seconds in the public API, no d3 at call time beyond the projection you pass.
 *
 * Space. The "outline plane" is the 1600 x 1000 plane of the US map (see projection.ts). At zoom 0 that plane is fitted
 * inside the canvas (contain, centred); each +1 zoom doubles the size. The kit camera ({@link CameraKeyframe}) works in
 * canvas px of that zoom-0 layout: x, y = how far the picture centre is from the plane centre (800, 500), scale = 2^zoom.
 */
import type {GeoProjection} from 'd3-geo';
import {resolveEase, type CameraKeyframe, type CameraState, type SegmentEase} from '../camera';
import type {Canvas} from '../tokens/types';
import {OUTLINE_H, OUTLINE_W} from './projection';
import type {CityAlignment} from './CityLayer';
import type {PlaneBox} from './types';

const PLANE_CX = OUTLINE_W / 2;
const PLANE_CY = OUTLINE_H / 2;

/** A place and zoom on the map. zoom 0 = the whole contiguous US fits the canvas. */
export interface MapCamera {
  lat: number;
  lng: number;
  zoom: number;
}

/** Plane units to canvas px at zoom 0 (the plane is contained in the canvas). */
export const fitScale = (canvas: Pick<Canvas, 'width' | 'height'>): number => Math.min(canvas.width / OUTLINE_W, canvas.height / OUTLINE_H);

/** lat/lng to the outline plane through the kit projection (the one fitted to the baked US outline). */
export const planePoint = (projection: GeoProjection, lat: number, lng: number): [number, number] => {
  const p = projection([lng, lat]);
  if (!p) throw new Error(`planePoint: ${lat},${lng} did not project`);
  return [p[0], p[1]];
};

/** Camera pose in kit camera units (px of the zoom-0 layout; scale = 2^zoom) for a look-at point given in plane units. */
export const poseOfPlane = (canvas: Pick<Canvas, 'width' | 'height'>, px: number, py: number, zoom: number): CameraState => {
  const f = fitScale(canvas);
  return {x: (px - PLANE_CX) * f, y: (py - PLANE_CY) * f, scale: 2 ** zoom, rotate: 0};
};

/** {@link poseOfPlane} for a lat/lng. */
export const poseOf = (projection: GeoProjection, canvas: Pick<Canvas, 'width' | 'height'>, cam: MapCamera): CameraState =>
  poseOfPlane(canvas, ...planePoint(projection, cam.lat, cam.lng), cam.zoom);

/** Pixels per plane unit on screen for a pose. */
export const pixelsPerUnit = (canvas: Pick<Canvas, 'width' | 'height'>, pose: CameraState): number => fitScale(canvas) * pose.scale;

/** The plane box a pose shows (hand it to <MapCanvas view>). */
export const viewOfPose = (canvas: Pick<Canvas, 'width' | 'height'>, pose: CameraState): PlaneBox => {
  const f = fitScale(canvas);
  const cx = PLANE_CX + pose.x / f;
  const cy = PLANE_CY + pose.y / f;
  const hw = canvas.width / 2 / (f * pose.scale);
  const hh = canvas.height / 2 / (f * pose.scale);
  return {x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh};
};

/** Plane point to screen px (canvas coordinates, origin top-left) for a pose. */
export const planeToScreen = (canvas: Pick<Canvas, 'width' | 'height'>, pose: CameraState, x: number, y: number): [number, number] => {
  const f = fitScale(canvas);
  const k = f * pose.scale;
  return [canvas.width / 2 + (x - PLANE_CX) * k - pose.x * pose.scale, canvas.height / 2 + (y - PLANE_CY) * k - pose.y * pose.scale];
};

/** Screen px back to the plane (inverse of {@link planeToScreen}). */
export const screenToPlane = (canvas: Pick<Canvas, 'width' | 'height'>, pose: CameraState, sx: number, sy: number): [number, number] => {
  const f = fitScale(canvas);
  const k = f * pose.scale;
  return [PLANE_CX + (sx - canvas.width / 2 + pose.x * pose.scale) / k, PLANE_CY + (sy - canvas.height / 2 + pose.y * pose.scale) / k];
};

/* ------------------------------------------------------------------ flyTo */

const RHO = 1.42; // van Wijk & Nuij, "Smooth and efficient zooming and panning"; d3.interpolateZoom's default

/** Position (plane units) and visible plane width at progress 0..1 along the smooth zoom-pan path. */
export const smoothZoomPath = (from: {x: number; y: number; w: number}, to: {x: number; y: number; w: number}, rho = RHO): ((p: number) => {x: number; y: number; w: number}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d2 = dx * dx + dy * dy;
  const d1 = Math.sqrt(d2);
  if (d1 < 1e-6) {
    const S = Math.log(to.w / from.w) / rho;
    return (p) => ({x: from.x, y: from.y, w: from.w * Math.exp(rho * S * p)});
  }
  const rho2 = rho * rho;
  const b0 = (to.w * to.w - from.w * from.w + rho2 * rho2 * d2) / (2 * from.w * rho2 * d1);
  const b1 = (to.w * to.w - from.w * from.w - rho2 * rho2 * d2) / (2 * to.w * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return (p) => {
    const s = p * S;
    const u = (from.w / (rho2 * d1)) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return {x: from.x + u * dx, y: from.y + u * dy, w: (from.w * Math.cosh(r0)) / Math.cosh(rho * s + r0)};
  };
};

export interface FlyOptions {
  projection: GeoProjection;
  canvas: Pick<Canvas, 'width' | 'height'>;
  /** Where the flight starts. */
  from: MapCamera;
  /** Seconds at which the flight starts (default 0). */
  start?: number;
  /** Easing of the whole flight (default `'spring'`, the iOS critically damped spring, landing exactly on the target). */
  ease?: SegmentEase;
  /** Spring response in seconds (default 0.95 x duration). */
  response?: number;
  /** Keyframes sampled along the path (default 40). The kit camera interpolates linearly between them, zoom in log space. */
  steps?: number;
  /** Zoom-out vs. direct: van Wijk's rho. 1.42 is the standard; 0.5 flies lower, 2.5 swoops higher. */
  rho?: number;
}

/**
 * Camera keyframes (seconds) for a flight from `opts.from` to a place: pan and zoom along the smooth zoom-pan path
 * (zooms out over long distances, then in), the whole move eased by the spring. Feed the result to <CameraRig keyframes>
 * or to {@link sampleCamera}. The first keyframe is the start pose at `start`, the last the target at `start + duration`.
 * Join flights with {@link flightPlan}.
 * @example flyTo(39.74, -104.99, 6, 3, {projection, canvas, from: {lat: 39, lng: -96, zoom: 0}})
 */
export const flyTo = (lat: number, lng: number, zoom: number, duration: number, opts: FlyOptions): CameraKeyframe[] => {
  if (!(duration > 0)) throw new RangeError('flyTo: duration must be > 0 seconds');
  const {projection, canvas, from, start = 0, steps = 40} = opts;
  const f = fitScale(canvas);
  const a = planePoint(projection, from.lat, from.lng);
  const b = planePoint(projection, lat, lng);
  const wOf = (z: number) => canvas.width / (f * 2 ** z); // visible plane width
  const path = smoothZoomPath({x: a[0], y: a[1], w: wOf(from.zoom)}, {x: b[0], y: b[1], w: wOf(zoom)}, opts.rho);
  const ease = resolveEase(opts.ease ?? 'spring', duration, opts.response);
  const out: CameraKeyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const tau = i / steps;
    const s = path(i === steps ? 1 : ease(tau));
    const z = Math.log2(canvas.width / (f * s.w));
    const pose = poseOfPlane(canvas, s.x, s.y, i === 0 ? from.zoom : i === steps ? zoom : z);
    out.push({t: start + duration * tau, x: pose.x, y: pose.y, scale: pose.scale, ease: 'linear'});
  }
  return out;
};

export interface FlightLeg {
  lat: number;
  lng: number;
  zoom: number;
  /** Flight seconds. */
  duration: number;
  /** Seconds to hold after landing before the next leg (default 0). */
  hold?: number;
}

/**
 * A chain of flights: each leg starts where the previous landed. Returns one keyframe list for a single camera rig,
 * plus the landing and departure times of every leg.
 * @example flightPlan({projection, canvas, from: us, start: 0.4, legs: [{lat: 47.6, lng: -122.3, zoom: 5, duration: 2.5, hold: 1}, ...]})
 */
export const flightPlan = (o: {projection: GeoProjection; canvas: Pick<Canvas, 'width' | 'height'>; from: MapCamera; start?: number; legs: FlightLeg[]; ease?: SegmentEase; steps?: number; rho?: number}): {keyframes: CameraKeyframe[]; legs: {departs: number; lands: number}[]} => {
  let t = o.start ?? 0;
  let cur = o.from;
  const keyframes: CameraKeyframe[] = [];
  const times: {departs: number; lands: number}[] = [];
  for (const leg of o.legs) {
    const kf = flyTo(leg.lat, leg.lng, leg.zoom, leg.duration, {projection: o.projection, canvas: o.canvas, from: cur, start: t, ease: o.ease, steps: o.steps, rho: o.rho});
    // drop the duplicate join keyframe (same time as the previous leg's last or hold keyframe)
    keyframes.push(...(keyframes.length ? kf.slice(1) : kf));
    times.push({departs: t, lands: t + leg.duration});
    t += leg.duration;
    if (leg.hold) {
      const last = kf[kf.length - 1];
      t += leg.hold;
      keyframes.push({...last, t, ease: 'linear'});
    }
    cur = {lat: leg.lat, lng: leg.lng, zoom: leg.zoom};
  }
  return {keyframes, legs: times};
};

/* -------------------------------------------------- metro layer anchoring */

/** Edge of the baked metro box in metres, from its bbox. */
export const metroSide = (bbox: {minX: number; maxX: number}): number => bbox.maxX - bbox.minX;

/**
 * City metres (x east, y south) to the outline plane through the baked alignment: translate(x y) rotate(deg) scale(ux, un).
 * @example metresToPlane(alignment, {x: 1000, y: -500})
 */
export const metresToPlane = (a: CityAlignment, m: {x: number; y: number}): [number, number] => {
  const r = (a.rotationDeg * Math.PI) / 180;
  const sx = m.x * a.unitsPerMetre;
  const sy = m.y * a.unitsPerMetreNorth;
  return [a.x + sx * Math.cos(r) - sy * Math.sin(r), a.y + sx * Math.sin(r) + sy * Math.cos(r)];
};

/** Inverse of {@link metresToPlane}. */
export const planeToMetres = (a: CityAlignment, x: number, y: number): {x: number; y: number} => {
  const r = (a.rotationDeg * Math.PI) / 180;
  const dx = x - a.x;
  const dy = y - a.y;
  const rx = dx * Math.cos(r) + dy * Math.sin(r);
  const ry = -dx * Math.sin(r) + dy * Math.cos(r);
  return {x: rx / a.unitsPerMetre, y: ry / a.unitsPerMetreNorth};
};

export interface MetroOverlay {
  /** <MetroMap zoom>. */
  zoom: number;
  /** <MetroMap center> in city metres. */
  center: {x: number; y: number};
  /** <MetroMap northScale>: the north-south scale relative to east-west (alignment.unitsPerMetreNorth / unitsPerMetre). */
  northScale: number;
}

/**
 * MetroMap props that make it show exactly what the country layer shows under `pose`: same centre, same scale, same
 * rotation (use `orientation="map"`) and the Albers east/north scale difference (`northScale`), so a point on the metro
 * layer and the same point on the country layer land on the same screen pixel at every zoom.
 */
export const metroOverlay = (canvas: Pick<Canvas, 'width' | 'height'>, pose: CameraState, alignment: CityAlignment, bbox: {minX: number; maxX: number}): MetroOverlay => {
  const f = fitScale(canvas);
  const view = viewOfPose(canvas, pose);
  const center = planeToMetres(alignment, (view.x0 + view.x1) / 2, (view.y0 + view.y1) / 2);
  const ppmEast = f * pose.scale * alignment.unitsPerMetre;
  return {zoom: (ppmEast * metroSide(bbox)) / Math.max(canvas.width, canvas.height), center, northScale: alignment.unitsPerMetreNorth / alignment.unitsPerMetre};
};

/**
 * Where a city-metre point lands on screen when drawn by <MetroMap> with the props of {@link metroOverlay}. Mirrors
 * MetroMap's own transform chain (view box, then rotate about the centre, then north scale); used by the anchor check.
 */
export const metroScreenPoint = (canvas: Pick<Canvas, 'width' | 'height'>, o: MetroOverlay, alignment: CityAlignment, bbox: {minX: number; maxX: number}, m: {x: number; y: number}): [number, number] => {
  const ppm = (Math.max(canvas.width, canvas.height) / metroSide(bbox)) * o.zoom;
  const dx = m.x - o.center.x;
  const dy = (m.y - o.center.y) * o.northScale;
  const r = (alignment.rotationDeg * Math.PI) / 180;
  return [canvas.width / 2 + ppm * (dx * Math.cos(r) - dy * Math.sin(r)), canvas.height / 2 + ppm * (dx * Math.sin(r) + dy * Math.cos(r))];
};
