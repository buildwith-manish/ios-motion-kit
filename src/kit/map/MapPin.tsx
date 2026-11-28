import React from 'react';
import {Glass} from '../glass';
import {iosSpring, idleDrift} from '../motion';
import {rgba, unit, useTheme, textStyle} from '../tokens';
import {useMapView} from './mapView';
import {overlayInk, type OverlayColor} from './overlayInk';

/** Pin geometry in design px (1080 short side), before the `scale` prop. */
export const PIN = {head: 34, stem: 30, dot: 12, drop: 150} as const;

/** Screen-px height from the ground point to the centre of the pin head, for a `scale` and canvas. Use it to anchor callouts. */
export const pinHeadLift = (u: number, scale = 1): number => (PIN.stem + PIN.head / 2) * u * scale;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface MapPinProps {
  lat: number;
  lng: number;
  /** Second the pin drops (default 0). */
  at?: number;
  /** Size multiplier (default 1). */
  scale?: number;
  /** Optional short label in a glass pill beside the head. */
  label?: string;
  /** Camera zoom range in which the pin is visible: fades in over the first pair, out over the second. Default always. */
  zoomRange?: {in: [number, number]; out?: [number, number]};
  /** Pin colour: a theme colour name or a CSS colour. Default the theme accent. */
  color?: OverlayColor;
}

/**
 * Glass map pin: drops from above on an iOS spring, lands with a soft ripple, then idles with a gentle bob and a slow
 * ripple. The tip stays on the place at every camera pose. Must be inside <FlyMap>. Pure function of the frame.
 */
export const MapPin: React.FC<MapPinProps> = ({lat, lng, at = 0, scale = 1, label, zoomRange, color = 'accent'}) => {
  const theme = useTheme();
  const {time, zoom, toScreen, canvas} = useMapView();
  const t = time - at;
  if (t <= 0) return null;
  const u = unit(theme) * scale;
  const [x, y] = toScreen(lat, lng);
  const m = 120 * u;
  if (x < -m || x > canvas.width + m || y < -m || y > canvas.height + m) return null;

  const ink = overlayInk(theme, color);
  const vis = zoomRange ? smooth(zoomRange.in[0], zoomRange.in[1], zoom) * (zoomRange.out ? 1 - smooth(zoomRange.out[0], zoomRange.out[1], zoom) : 1) : 1;
  if (vis < 0.005) return null;

  const fall = 1 - iosSpring(t, 0.55);
  const appear = Math.min(1, t / 0.12);
  const bob = t > 0.9 ? idleDrift(t, 3.2) * 1.6 * u * Math.min(1, (t - 0.9) / 0.6) : 0;
  const head = PIN.head * u, stem = PIN.stem * u, dot = PIN.dot * u;
  const lift = -PIN.drop * u * fall + bob;
  const landed = t - 0.3;
  const ripple = (phase: number) => (phase >= 0 && phase <= 1 ? {r: (14 + 34 * phase) * u, a: 0.42 * (1 - phase) * (1 - phase)} : null);
  const r1 = ripple(landed / 0.9);
  const idleP = landed > 1.2 ? ((landed - 1.2) % 3.2) / 3.2 : -1;
  const r2 = ripple(idleP);

  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, opacity: vis, pointerEvents: 'none'}}>
      <svg width={160 * u} height={80 * u} viewBox="-80 -40 160 80" style={{position: 'absolute', left: -80 * u, top: -40 * u, overflow: 'visible'}}>
        {[r1, r2].map((r, i) => (r ? <ellipse key={i} cx={0} cy={0} rx={r.r / u} ry={r.r / u * 0.5} fill="none" stroke={rgba(ink, r.a)} strokeWidth={1.6} /> : null))}
        <ellipse cx={0} cy={0} rx={5.5} ry={2.8} fill={rgba(theme.colors.background.deep, 0.55 * appear)} />
        <ellipse cx={0} cy={0} rx={3} ry={1.6} fill={rgba(ink, appear)} />
      </svg>
      <div style={{position: 'absolute', left: -u, top: -stem + lift + head / 2, width: 2 * u, height: stem - head / 2, background: `linear-gradient(${rgba(ink, 0.9 * appear)}, ${rgba(ink, 0.35 * appear)})`}} />
      <Glass tier="chip" radius={head / 2} width={head} height={head} style={{position: 'absolute', left: -head / 2, top: -stem - head / 2 + lift, opacity: appear}}>
        <div style={{position: 'absolute', left: (head - dot) / 2, top: (head - dot) / 2, width: dot, height: dot, borderRadius: dot / 2, background: ink, boxShadow: `0 0 ${8 * u}px ${rgba(ink, 0.7)}`}} />
      </Glass>
      {label ? (
        <Glass tier="pill" radius={999} style={{position: 'absolute', left: head / 2 + 10 * u, top: -stem - head / 2 + lift - 4 * u, padding: `${6 * u}px ${14 * u}px`, opacity: appear * smooth(0.15, 0.45, t), whiteSpace: 'nowrap'}}>
          <div style={textStyle(theme, 'caption', {scale: 0.95})}>{label}</div>
        </Glass>
      ) : null}
    </div>
  );
};
