import React from 'react';
import {iosSpring} from '../motion';
import {rgba, unit, useTheme} from '../tokens';
import {chaikin, pathOf, polylineHead, type P2} from './overlayGeometry';
import {useMapView} from './mapView';
import {overlayInk, type OverlayColor} from './overlayInk';
import type {LatLng} from './types';

export interface RouteDrawProps {
  /** The route as lat/lng points in order (a few to a few hundred). */
  points: LatLng[];
  /** Second the route starts drawing (default 0). */
  at?: number;
  /** Spring response of the draw-on, seconds (default 1.6). */
  response?: number;
  /** Line width in design px (default 4). */
  width?: number;
  /** Round the corners (Chaikin passes, default 2; 0 keeps the points as given). */
  smooth?: number;
  /** Leading dot (default true). */
  dot?: boolean;
  /** Override the draw progress 0..1 (skips the spring). */
  progress?: number;
  color?: OverlayColor;
}

/**
 * A route that draws on along its points, with a dark casing for contrast, a soft glow (wide low-alpha stroke) and a
 * leading dot. Rebuilt in screen space every frame, so it stays on the map under any camera. Inside <FlyMap>.
 */
export const RouteDraw: React.FC<RouteDrawProps> = ({points, at = 0, response = 1.6, width = 4, smooth = 2, dot = true, progress, color = 'accent'}) => {
  const theme = useTheme();
  const {time, toScreen, canvas} = useMapView();
  const t = time - at;
  if (progress === undefined && t <= 0) return null;
  if (points.length < 2) return null;
  const u = unit(theme);
  const ink = overlayInk(theme, color);
  const screen = chaikin(points.map((q) => toScreen(q.lat, q.lng) as P2), smooth);
  const raw = progress ?? iosSpring(t, response);
  const p = raw > 0.9995 ? 1 : raw;
  const {pts, head} = polylineHead(screen, p);
  const d = pathOf(pts);
  return (
    <svg width={canvas.width} height={canvas.height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible'}}>
      <path d={pathOf(screen)} fill="none" stroke={rgba(theme.colors.text.primary, 0.1)} strokeWidth={1.5 * u} strokeLinejoin="round" strokeLinecap="round" />
      {p > 0 ? (
        <>
          <path d={d} fill="none" stroke={rgba(ink, 0.2)} strokeWidth={width * u * 3.2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={d} fill="none" stroke={rgba(theme.colors.background.deep, 0.85)} strokeWidth={width * u * 1.7} strokeLinejoin="round" strokeLinecap="round" />
          <path d={d} fill="none" stroke={ink} strokeWidth={width * u} strokeLinejoin="round" strokeLinecap="round" />
        </>
      ) : null}
      {dot && p > 0 ? (
        <>
          <circle cx={head[0]} cy={head[1]} r={11 * u} fill={rgba(ink, 0.28)} />
          <circle cx={head[0]} cy={head[1]} r={5 * u} fill={theme.colors.text.primary} />
        </>
      ) : null}
    </svg>
  );
};
