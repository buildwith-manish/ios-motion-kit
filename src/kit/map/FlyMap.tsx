import React from 'react';
import type {CSSProperties} from 'react';
import {geoAlbers, type GeoConicProjection, type GeoProjection} from 'd3-geo';
import {sampleCamera, type CameraKeyframe} from '../camera';
import {useTheme} from '../tokens';
import {blurDissolve} from '../transitions';
import type {LayerState} from '../transitions';
import {mapViewValue, MapViewProvider} from './mapView';
import {metroOverlay} from './mapCamera';
import type {CityAlignment, CityData} from './CityLayer';
import {MetroMap, type MetroMapProps} from './MetroMap';
import {useBakedTopo} from './RegionLayer';
import {selectShapes} from './regions';
import {mapStyleFromTheme} from './styles';
import type {MapStyle, PlaneBox} from './types';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** CSS for a transition layer (blur, opacity; scale and offset only when non-trivial). */
const layerCss = (l: LayerState): CSSProperties => ({
  position: 'absolute', inset: 0, opacity: l.opacity,
  filter: l.blur > 0.05 ? `blur(${l.blur}px)` : undefined,
  transform: l.scale !== 1 || l.tx || l.ty ? `translate(${l.tx}px, ${l.ty}px) scale(${l.scale})` : undefined,
});

/**
 * The kit projection scaled by K (plane x K), so path digits stay below a quarter pixel at the current zoom.
 * d3-geo 3.1 projections have no copy(): the kit projection is a plain geoAlbers (see fitUsOutline), so rebuild it from
 * its own parameters.
 */
const scaledProjection = (p: GeoProjection, k: number): GeoProjection => {
  const c = p as GeoConicProjection;
  const [tx, ty] = p.translate();
  return geoAlbers().parallels(c.parallels()).rotate(c.rotate()).center(c.center()).precision(p.precision())
    .scale(p.scale() * k).translate([tx * k, ty * k]);
};

/**
 * Snapped, expanded selection window: the shapes picked for it stay valid for several frames of pan, so the
 * (cached) selection is not redone every frame. Pure.
 */
const snapView = (v: PlaneBox, k: number): PlaneBox => {
  const w = (v.x1 - v.x0) * 0.5, h = (v.y1 - v.y0) * 0.5; // grid = half a view
  const gx = Math.max(w, 1e-6), gy = Math.max(h, 1e-6);
  return {x0: Math.floor((v.x0 - w * 0.5) / gx) * gx * k, y0: Math.floor((v.y0 - h * 0.5) / gy) * gy * k, x1: (Math.floor((v.x1 + w * 0.5) / gx) + 1) * gx * k, y1: (Math.floor((v.y1 + h * 0.5) / gy) + 1) * gy * k};
};

/** One baked layer drawn into the camera's view (own SVG, exact view box, snapped cached selection). */
const ShapeLayer: React.FC<{file: string; projection: GeoProjection; view: PlaneBox; style: MapStyle; width: number; height: number; zoom: number; fill?: 'land' | 'none'; stroke?: 'stroke' | 'strokeSoft' | 'highlight'; weight?: number; idPrefix?: string | string[]; opacity?: number; maxPoints?: number}> = ({
  file, projection, view, style, width, height, zoom, fill = 'land', stroke = 'stroke', weight = 1, idPrefix, opacity = 1, maxPoints = 9000,
}) => {
  const topo = useBakedTopo(file);
  if (!topo || opacity < 0.002) return null;
  // K: a power of two so that 0.05 plane-px quantisation (path digits 1) is below 0.05 screen px
  const k = 2 ** Math.max(0, Math.ceil(zoom));
  const sp = scaledProjection(projection, k);
  const sel = snapView(view, k);
  const shapes = selectShapes(topo, sp, sel, {idPrefix}, maxPoints);
  const vb = `${view.x0 * k} ${view.y0 * k} ${(view.x1 - view.x0) * k} ${(view.y1 - view.y0) * k}`;
  return (
    <svg width={width} height={height} viewBox={vb} style={{position: 'absolute', inset: 0, display: 'block', opacity}}>
      <g fill={fill === 'none' ? 'none' : style.land} stroke={style[stroke]} strokeWidth={style.hairline * weight} strokeLinejoin="round">
        {shapes.map((s) => <path key={s.id} d={s.d} vectorEffect="non-scaling-stroke" />)}
      </g>
    </svg>
  );
};

export interface FlyMapProps {
  /** Frame of the composition. */
  frame: number;
  /** Camera keyframes in seconds: use flyTo() / flightPlan(). */
  keyframes: readonly CameraKeyframe[];
  /** The kit US projection (useUsProjection()). */
  projection: GeoProjection;
  /** The metro to dissolve into: a baked city and its alignment entry. Omit for a country-only map. */
  metro?: {city: CityData; alignment: CityAlignment};
  /** Census CBSA id of that metro (e.g. '16980'). Its outline is drawn above both layers and stays anchored. */
  outlineId?: string;
  /** Camera zoom range of the country-to-metro dissolve: starts at the first, finished at the second. Default [4.2, 5.6]. */
  blend?: [number, number];
  /** Draw county borders under the country layer once zoomed in (default true). */
  counties?: boolean;
  /** MetroMap look while it is on screen. Default 'hero'. */
  metroMode?: MetroMapProps['mode'];
  /** Overrides the theme-derived style. */
  style?: MapStyle;
  /** Overlays: <MapPin>, <MapCallout>, <Arc>, <RouteDraw>. Drawn above the map in screen space. */
  children?: React.ReactNode;
}

/**
 * The US map under a kit camera. Country layer (states, counties) at every zoom; when the camera zooms into a metro,
 * the country layer and the street-level <MetroMap> cross-dissolve (the kit's blurDissolve with the scale difference
 * set to 0, so nothing moves) while the metro's CBSA outline stays drawn above both. MetroMap is positioned from the
 * baked alignment (centre, scale, rotation, Albers north-south scale), so both layers show the same place at the same
 * pixels at every zoom (scripts/map_camera_check.ts measures the difference). Pure function of `frame`.
 */
export const FlyMap: React.FC<FlyMapProps> = ({frame, keyframes, projection, metro, outlineId, blend = [4.2, 5.6], counties = true, metroMode = 'hero', style: styleProp, children}) => {
  const theme = useTheme();
  const canvas = theme.canvas;
  const {width, height} = canvas;
  const style = styleProp ?? mapStyleFromTheme(theme);
  const pose = sampleCamera(keyframes, frame / canvas.fps);
  const mv = mapViewValue(canvas, projection, pose, frame);
  const p = metro ? smooth(blend[0], blend[1], mv.zoom) : 0;
  const layers = blurDissolve({maxBlur: 16, scaleDelta: 0})(p, {width, height, direction: 'left'});
  const showCountry = layers.outgoing.opacity > 0.002;
  const overlay = metro && p > 0 ? metroOverlay(canvas, pose, metro.alignment, metro.city.bbox) : null;
  const countyOpacity = counties ? smooth(2.4, 3.6, mv.zoom) : 0;

  return (
    <MapViewProvider value={mv}>
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: style.water}}>
        {showCountry ? (
          <div style={layerCss(layers.outgoing)}>
            <ShapeLayer file="states.json" projection={projection} view={mv.view} style={style} width={width} height={height} zoom={mv.zoom} />
            <ShapeLayer file="counties.json" projection={projection} view={mv.view} style={style} width={width} height={height} zoom={mv.zoom} fill="none" stroke="strokeSoft" weight={0.7} opacity={countyOpacity} maxPoints={7000} />
            <ShapeLayer file="states.json" projection={projection} view={mv.view} style={style} width={width} height={height} zoom={mv.zoom} fill="none" weight={1.3} />
          </div>
        ) : null}
        {metro && overlay && p > 0 ? (
          <div style={layerCss(layers.incoming)}>
            <MetroMap
              city={metro.city} alignment={metro.alignment} frame={frame} orientation="map" mode={metroMode}
              zoom={overlay.zoom} center={overlay.center} northScale={overlay.northScale}
              reveal={smooth(0.05, 1, p)} vignette={0.35} grain={0.04}
            />
          </div>
        ) : null}
        {outlineId && p > 0 ? (
          <ShapeLayer file="cbsa.json" projection={projection} view={mv.view} style={style} width={width} height={height} zoom={mv.zoom} fill="none" stroke="highlight" weight={2} idPrefix={outlineId} opacity={smooth(0, 0.6, p)} maxPoints={4000} />
        ) : null}
        <div style={{position: 'absolute', inset: 0}}>{children}</div>
      </div>
    </MapViewProvider>
  );
};
