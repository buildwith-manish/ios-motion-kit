import React from 'react';
import {iosSpring} from '../motion';
import {rgba, unit, useTheme} from '../tokens';
import {arcControl, paramAtFraction, quadAt, quadHead, quadLengthTable, type P2} from './overlayGeometry';
import {useMapView} from './mapView';
import {overlayInk, type OverlayColor} from './overlayInk';
import type {LatLng} from './types';

export interface ArcProps {
  from: LatLng;
  to: LatLng;
  /** Second the arc starts drawing (default 0). */
  at?: number;
  /** Spring response of the draw-on, seconds (default 1.2). */
  response?: number;
  /** Bow of the arc as a fraction of its length; positive bows up for a left-to-right arc (default 0.28). */
  bend?: number;
  /** Line width in design px (default 3). */
  width?: number;
  /** Leading dot (default true). It rests at the end once drawn. */
  dot?: boolean;
  /** Faint track along the whole path from the start (default true). */
  track?: boolean;
  /** Override the draw progress 0..1 (skips the spring). */
  progress?: number;
  color?: OverlayColor;
  /** Sets which arc is which when several share a view (React key helper only). */
  id?: string;
}

/**
 * Curved arc between two places that draws on with a spring and a leading dot. The curve is rebuilt from the two
 * screen points on every frame, so both ends stay on their places while the camera moves. Must be inside <FlyMap>.
 * Glow is a wide low-alpha stroke (no blur filter).
 */
export const Arc: React.FC<ArcProps> = ({from, to, at = 0, response = 1.2, bend = 0.28, width = 3, dot = true, track = true, progress, color = 'accent', id}) => {
  const theme = useTheme();
  const {time, toScreen, canvas} = useMapView();
  const t = time - at;
  if (progress === undefined && t <= 0) return null;
  const u = unit(theme);
  const ink = overlayInk(theme, color);
  const a = toScreen(from.lat, from.lng) as P2;
  const b = toScreen(to.lat, to.lng) as P2;
  const c = arcControl(a, b, bend);
  const raw = progress ?? iosSpring(t, response);
  const p = raw > 0.9995 ? 1 : raw;
  const table = quadLengthTable(a, c, b);
  const tt = paramAtFraction(table, p);
  const head = quadHead(a, c, b, tt);
  const d = `M${a[0]} ${a[1]}Q${head.c[0]} ${head.c[1]} ${head.end[0]} ${head.end[1]}`;
  const full = `M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
  const gid = `arc-${id ?? `${from.lat}-${from.lng}-${to.lat}-${to.lng}`.replace(/[^0-9a-z-]/gi, '')}`;
  const pulse = 1 + 0.12 * Math.sin(Math.max(0, t) * 5.2);
  const tip = p >= 1 ? quadAt(a, c, b, 1) : head.end;
  return (
    <svg width={canvas.width} height={canvas.height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible'}}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}>
          <stop offset="0" stopColor={rgba(ink, 0.25)} />
          <stop offset="1" stopColor={rgba(ink, 1)} />
        </linearGradient>
      </defs>
      {track ? <path d={full} fill="none" stroke={rgba(theme.colors.text.primary, 0.14)} strokeWidth={1.5 * u} strokeDasharray={`${2 * u} ${7 * u}`} strokeLinecap="round" /> : null}
      {p > 0 ? (
        <>
          <path d={d} fill="none" stroke={rgba(ink, 0.2)} strokeWidth={width * u * 3.4} strokeLinecap="round" />
          <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth={width * u} strokeLinecap="round" />
        </>
      ) : null}
      {dot && p > 0 ? (
        <>
          <circle cx={tip[0]} cy={tip[1]} r={11 * u * pulse} fill={rgba(ink, 0.28)} />
          <circle cx={tip[0]} cy={tip[1]} r={5 * u} fill={theme.colors.text.primary} />
        </>
      ) : null}
    </svg>
  );
};
