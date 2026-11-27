import React from 'react';
import {Glass} from '../glass';
import {enter, iosSpring, SPRING} from '../motion';
import {NumberText} from '../text';
import {rgba, safeRect, textStyle, unit, useTheme} from '../tokens';
import type {Theme} from '../tokens/types';
import type {CameraState} from '../camera';
import {layoutCallouts, leaderEnd, type CalloutBox, type PlacedCallout, type ScreenRect} from './overlayGeometry';
import {mapViewValue, useMapView} from './mapView';
import {pinHeadLift, PIN} from './MapPin';

export interface MapCalloutProps {
  lat: number;
  lng: number;
  /** Second the callout appears (default 0). The leader line draws on first, then the label. */
  at?: number;
  title: string;
  /** Optional number, rolled up from 0 (or `from`). */
  value?: number;
  from?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Top-left of the label relative to the anchor, px. Default: up and right. <MapCallouts> computes this for you. */
  offset?: {dx: number; dy: number};
  /** Height above the ground point where the leader ends (default: the centre of a MapPin head). Pass 0 for a bare point. */
  lift?: number;
  /** Label width override, px (default: estimated from the text). */
  width?: number;
  /** Size multiplier (default 1). */
  scale?: number;
}

const NUMBER_FS = 40;
const PAD = 18;

/** Estimated label size in px (text width from average glyph widths; the label is laid out at exactly this width). */
export const calloutSize = (theme: Theme, p: Pick<MapCalloutProps, 'title' | 'value' | 'decimals' | 'prefix' | 'suffix' | 'width' | 'scale'>): {w: number; h: number} => {
  const u = unit(theme) * (p.scale ?? 1);
  const titleFs = theme.type.caption.size * u;
  const numFs = NUMBER_FS * u;
  const titleW = p.title.length * titleFs * 0.56;
  let w = titleW;
  let h = titleFs * theme.type.caption.lineHeight;
  if (p.value !== undefined) {
    const digits = Math.abs(p.value).toFixed(p.decimals ?? 0).length;
    const commas = Math.floor((Math.abs(p.value).toFixed(0).length - 1) / 3);
    const numW = (digits + commas * 0.5 + (p.prefix?.length ?? 0) + (p.suffix?.length ?? 0) + (p.value < 0 ? 1 : 0)) * numFs * 0.6;
    w = Math.max(w, numW);
    h += numFs * 1.12 + 4 * u;
  }
  return {w: p.width ?? Math.ceil(w + 2 * PAD * u), h: Math.ceil(h + 2 * PAD * u * 0.8)};
};

/**
 * Glass label with a leader line to a place. The leader draws on with a spring, then the label enters (and the number
 * rolls). Anchored to the place at every camera pose. Inside <FlyMap>. Use <MapCallouts> to lay several out so they
 * never overlap each other or the pins.
 */
export const MapCallout: React.FC<MapCalloutProps> = (p) => {
  const {lat, lng, at = 0, title, value, from = 0, decimals, prefix, suffix, scale = 1} = p;
  const theme = useTheme();
  const {time, frame, toScreen, canvas} = useMapView();
  const u = unit(theme) * scale;
  const t = time - at;
  if (t <= 0) return null;
  const [gx, gy] = toScreen(lat, lng);
  const lift = p.lift ?? pinHeadLift(unit(theme), scale);
  const ax = gx, ay = gy - lift;
  const {w, h} = calloutSize(theme, p);
  const gap = 28 * u;
  const off = p.offset ?? {dx: gap, dy: -gap - h};
  const box: ScreenRect = {x: ax + off.dx, y: ay + off.dy, w, h};
  if (box.x > canvas.width + 80 || box.x + w < -80 || box.y > canvas.height + 80 || box.y + h < -80) return null;

  const line = iosSpring(t, 0.5);
  const body = enter(time, at + 0.12, SPRING.SNAPPY, canvas.fps);
  const end = leaderEnd([ax, ay], box);
  const len = Math.hypot(end[0] - ax, end[1] - ay);
  const hx = ax + (end[0] - ax) * line, hy = ay + (end[1] - ay) * line;

  return (
    <>
      <svg width={canvas.width} height={canvas.height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible'}}>
        {len > 1 ? <line x1={ax} y1={ay} x2={hx} y2={hy} stroke={rgba(theme.colors.text.primary, 0.75)} strokeWidth={1.5 * u} strokeLinecap="round" /> : null}
        <circle cx={ax} cy={ay} r={3.2 * u} fill={theme.colors.text.primary} opacity={Math.min(1, t / 0.12)} />
      </svg>
      <Glass tier="card" radius={Math.min(20 * u, h / 2)} width={w} height={h} style={{position: 'absolute', left: box.x, top: box.y, opacity: body.opacity, transform: `translateY(${body.y}px) scale(${body.scale})`, boxSizing: 'border-box', padding: `${PAD * 0.8 * u}px ${PAD * u}px`, whiteSpace: 'nowrap'}}>
        <div style={{...textStyle(theme, 'caption', {color: 'secondary', scale: u / unit(theme)})}}>{title}</div>
        {value !== undefined ? (
          <div style={{marginTop: 4 * u}}>
            <NumberText to={value} from={from} frame={frame} start={at + 0.2} duration={0.9} decimals={decimals} prefix={prefix} suffix={suffix} role="number" fontSize={NUMBER_FS * u} />
          </div>
        ) : null}
      </Glass>
    </>
  );
};

export interface CalloutSpec extends Omit<MapCalloutProps, 'offset'> {
  /** Unique within the group. */
  id: string;
}

export interface MapCalloutsProps {
  items: CalloutSpec[];
  /** Pin size multiplier the callouts anchor to (default 1). */
  pinScale?: number;
  /**
   * Camera pose the layout is computed for. Default: the pose of the current frame. Pass the settled pose of the
   * shot (e.g. `sampleCamera(keyframes, landedAt)`) so the labels keep one place while the camera moves.
   */
  layoutPose?: CameraState;
  /** Extra rectangles to keep clear, px. */
  avoid?: ScreenRect[];
}

/** Several callouts laid out so labels never overlap each other, the pins or crossing leader lines. */
export const MapCallouts: React.FC<MapCalloutsProps> = ({items, pinScale = 1, layoutPose, avoid}) => {
  const theme = useTheme();
  const mv = useMapView();
  const u = unit(theme);
  const lv = layoutPose ? mapViewValue(mv.canvas, mv.projection, layoutPose, mv.frame) : mv;
  const sr = safeRect(theme, 'title');
  const lift = pinHeadLift(u, pinScale);
  const boxes: CalloutBox[] = items.map((it) => {
    const [gx, gy] = lv.toScreen(it.lat, it.lng);
    const {w, h} = calloutSize(theme, it);
    return {id: it.id, ax: gx, ay: gy - (it.lift ?? lift), w, h};
  });
  const pinObstacles: ScreenRect[] = items.map((it) => {
    const [gx, gy] = lv.toScreen(it.lat, it.lng);
    const head = PIN.head * u * pinScale;
    return {x: gx - head * 0.8, y: gy - lift - head * 0.8, w: head * 1.6, h: lift + head * 0.8};
  });
  const placed: Record<string, PlacedCallout> = layoutCallouts(boxes, {
    bounds: {x: sr.left, y: sr.top, w: sr.width, h: sr.height},
    obstacles: [...pinObstacles, ...(avoid ?? [])],
    gap: 28 * u,
    margin: 14 * u,
  });
  return (
    <>
      {items.map((it) => (
        <MapCallout key={it.id} {...it} scale={it.scale ?? 1} offset={{dx: placed[it.id].dx, dy: placed[it.id].dy}} />
      ))}
    </>
  );
};
