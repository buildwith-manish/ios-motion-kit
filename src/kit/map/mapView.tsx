import React, {createContext, useContext, useMemo} from 'react';
import type {GeoProjection} from 'd3-geo';
import type {CameraState} from '../camera';
import type {Canvas} from '../tokens/types';
import {fitUsOutline} from './projection';
import {useBakedTopo} from './RegionLayer';
import {planePoint, planeToScreen, viewOfPose} from './mapCamera';
import type {PlaneBox} from './types';

/** What an overlay (pin, callout, arc, route) needs to know about the map camera on this frame. */
export interface MapViewValue {
  canvas: Canvas;
  /** Frame of the composition. */
  frame: number;
  /** Seconds. */
  time: number;
  pose: CameraState;
  /** Visible plane box. */
  view: PlaneBox;
  /** log2 of the pose scale (the camera zoom). */
  zoom: number;
  projection: GeoProjection;
  /** lat/lng to screen px (canvas coordinates, top-left origin) under this frame's camera. */
  toScreen: (lat: number, lng: number) => [number, number];
}

const Ctx = createContext<MapViewValue | null>(null);
export const MapViewProvider = Ctx.Provider;

/** The nearest <FlyMap>'s camera view (throws outside one). */
export const useMapView = (): MapViewValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('map overlays (MapPin, MapCallout, Arc, RouteDraw) must be inside <FlyMap> or a <MapViewProvider>');
  return v;
};

/** Build the value for a pose (used by <FlyMap>; also handy for stills and tests). */
export const mapViewValue = (canvas: Canvas, projection: GeoProjection, pose: CameraState, frame: number): MapViewValue => ({
  canvas, frame, time: frame / canvas.fps, pose, view: viewOfPose(canvas, pose), zoom: Math.log2(pose.scale), projection,
  toScreen: (lat, lng) => planeToScreen(canvas, pose, ...planePoint(projection, lat, lng)),
});

/** The kit US projection (the plane the baked city alignments live in), or null while outline.json loads. */
export const useUsProjection = (): GeoProjection | null => {
  const topo = useBakedTopo('outline.json');
  return useMemo(() => (topo ? fitUsOutline(topo) : null), [topo]);
};
