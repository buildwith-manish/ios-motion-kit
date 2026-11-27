import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {rgba, useTheme} from '../tokens';
import {mixColor} from './colorScale';
import type {CityAlignment, CityData} from './CityLayer';
import {boundaryPath, metroGeometry, type Chunk, type MetroBudget} from './metroIndex';
import {
  METRO_CLASS_ORDER, METRO_DIM_OPACITY, METRO_TIER, metroLod, metroRevealProgress, metroStrokePx, metroTierAlpha, revealRadius, smoothstep, tierReveal,
  type MetroClass, type MetroLodTier, type MetroMode,
} from './metroLod';
import {mapStyleFromTheme} from './styles';
import type {MapStyle} from './types';

export interface MetroMapProps {
  /** Baked city (metres, x east, y south, centre {0,0}); load it with useCity or pass any object of that shape. */
  city: CityData;
  /** The city's entry of cities/alignment.json. Used for `orientation="map"` (rotate to match the US map). */
  alignment?: CityAlignment;
  /** Current frame of the composition (the map is a pure function of it). */
  frame: number;
  /** 1 = the 14 km city box fills the longer canvas side; 2 = half of that width, and so on. */
  zoom?: number;
  /** View centre in city metres (x east, y south). Default: the city centre. */
  center?: {x: number; y: number};
  /** "hero": full brightness with a glow on major roads only. "dim": low opacity, no glow, to sit behind content. */
  mode?: MetroMode;
  /** Opacity of the map content in dim mode (default 0.3). */
  dimOpacity?: number;
  /** "north" = north up (default). "map" = rotated by alignment.rotationDeg so it matches the kit US map. */
  orientation?: 'north' | 'map';
  /** Radial reveal from the centre, seconds. 0 = no reveal. Default 2.4. */
  revealSeconds?: number;
  revealDelaySeconds?: number;
  /** Override the reveal progress (0..1) instead of deriving it from the frame. */
  reveal?: number;
  /** Optional metro boundary: a GeoJSON Polygon/MultiPolygon (or Feature) in lon/lat, e.g. one feature of the kit CBSA layer. */
  boundary?: unknown;
  /** Vignette strength 0..1 (default 0.7; dim mode uses half). */
  vignette?: number;
  /** Grain strength 0..1 (default 0.06). 0 turns it off. */
  grain?: number;
  /** Paint the land/background under the map (default true). Turn off to composite over your own page. */
  background?: boolean;
  /** Overrides the theme-derived style. */
  style?: MapStyle;
  /** Multiplies every stroke width (default 1). */
  weight?: number;
}

const GRAIN_TILE = 256;
const grainUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${GRAIN_TILE}' height='${GRAIN_TILE}'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

const Paths: React.FC<{chunks: Chunk[] | undefined; stroke?: string; width?: number; fill?: string}> = ({chunks, stroke, width, fill}) => (
  <>
    {(chunks ?? []).map((c, i) => (
      <path key={i} d={c.d} fill={fill ?? 'none'} stroke={stroke ?? 'none'} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    ))}
  </>
);

/**
 * Night-style metro street map from baked Census data. Water and parks are filled, roads are drawn by class with tiered
 * brightness, widths and level of detail follow the zoom, edges feather out, and a soft radial reveal draws the roads
 * on from the centre. Props in, SVG out: no hooks reading time, no network.
 */
export const MetroMap: React.FC<MetroMapProps> = ({
  city, alignment, frame, zoom = 1, center, mode = 'hero', dimOpacity = METRO_DIM_OPACITY, orientation = 'north',
  revealSeconds = 2.4, revealDelaySeconds = 0, reveal, boundary, vignette = 0.7, grain = 0.06, background = true, style: styleProp, weight = 1,
}) => {
  const theme = useTheme();
  const {width, height, fps} = theme.canvas;
  const style = styleProp ?? mapStyleFromTheme(theme);
  const light = theme.name === 'light';
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hero = mode === 'hero';

  const rot = orientation === 'map' && alignment ? alignment.rotationDeg : 0;
  const lod = metroLod(zoom);
  const geo = useMemo(
    () => metroGeometry(city, {width, height, zoom, center, rotationDeg: rot}, lod, hero),
    // lod is a pure function of zoom
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city, width, height, zoom, center?.x, center?.y, rot, hero],
  );
  const {view} = geo;
  const cx = center?.x ?? 0, cy = center?.y ?? 0;
  const b = view.box;
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;

  const progress = reveal ?? (revealSeconds > 0 ? metroRevealProgress(frame, fps, revealDelaySeconds, revealSeconds) : 1);
  const revealing = progress < 0.9995;
  const farthest = Math.hypot(Math.max(Math.abs(b.x0 - cx), Math.abs(b.x1 - cx)), Math.max(Math.abs(b.y0 - cy), Math.abs(b.y1 - cy)));

  // feathered edges: only needed when the view reaches past the baked box (zoom < 1, or panned off the data)
  const box = city.bbox, FEATHER = (box.maxX - box.minX) * 0.1;
  const c = view.cull;
  const needsFeather = c.x0 < box.minX - 1 || c.x1 > box.maxX + 1 || c.y0 < box.minY - 1 || c.y1 > box.maxY + 1;

  const bnd = useMemo(
    () => (boundary ? boundaryPath(city, boundary, view.cull, 0.4 / view.ppm) : null),
    [city, boundary, view.cull.x0, view.cull.y0, view.cull.x1, view.cull.y1, view.ppm], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // theme-derived paint
  const waterTop = style.waterFill;
  const waterBottom = mixColor(style.waterFill, style.landAlt, hero ? 0.5 : 0.3);
  const landGlow = mixColor(style.land, style.landAlt, 0.55);
  const roadInk = (cls: MetroClass) => rgba(theme.colors.text.primary, metroTierAlpha(cls, light));
  const glowInk = rgba(theme.colors.accent, light ? 0.3 : 0.24);
  const wScale = (cls: MetroClass) => metroStrokePx(cls, zoom, weight);

  const fadeFill = smoothstep(0, 0.5, progress);
  const tiers: MetroLodTier[] = ['major', 'secondary', 'local', 'minor'];
  const maskId = (t: string) => `mm-${uid}-${t}`;

  const content = (
    <g opacity={hero ? 1 : dimOpacity}>
      <g opacity={fadeFill}>
        <Paths chunks={geo.parks} fill={style.park} />
        <Paths chunks={geo.waterPolys} fill={`url(#mm-${uid}-water)`} />
        <Paths chunks={geo.waterPolys} stroke={style.strokeSoft} width={style.hairline * weight} />
        <Paths chunks={geo.waterLines} stroke={style.strokeSoft} width={style.hairline * weight} />
      </g>
      {bnd?.d ? (
        <g opacity={smoothstep(0.55, 1, progress)}>
          {hero ? <path d={bnd.d} fill="none" stroke={glowInk} strokeWidth={4.5 * weight} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : null}
          <path d={bnd.d} fill="none" stroke={rgba(theme.colors.accent, light ? 0.8 : 0.7)} strokeWidth={1.2 * weight} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </g>
      ) : null}
      {tiers.map((t) => {
        const classes = METRO_CLASS_ORDER.filter((cls) => METRO_TIER[cls] === t && geo.roads[cls]?.length);
        if (!classes.length) return null;
        return (
          <g key={t} mask={revealing ? `url(#${maskId(t)})` : undefined}>
            {t === 'major' && hero ? <Paths chunks={geo.roads.primary} stroke={glowInk} width={wScale('primary') * 3.4} /> : null}
            {classes.map((cls) => (
              <g key={cls} opacity={lod[cls]}><Paths chunks={geo.roads[cls]} stroke={roadInk(cls)} width={wScale(cls)} /></g>
            ))}
          </g>
        );
      })}
    </g>
  );

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`${b.x0} ${b.y0} ${bw} ${bh}`} style={{display: 'block'}}>
        <defs>
          <linearGradient id={`mm-${uid}-water`} gradientUnits="userSpaceOnUse" x1={b.x0} y1={b.y0} x2={b.x1} y2={b.y1}>
            <stop offset="0" stopColor={waterTop} />
            <stop offset="1" stopColor={waterBottom} />
          </linearGradient>
          <radialGradient id={`mm-${uid}-land`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={Math.max(bw, bh) * 0.7}>
            <stop offset="0" stopColor={landGlow} />
            <stop offset="1" stopColor={style.land} />
          </radialGradient>
          {needsFeather ? (
            <>
              <linearGradient id={`mm-${uid}-fx`} gradientUnits="userSpaceOnUse" x1={box.minX} y1="0" x2={box.maxX} y2="0">
                <stop offset="0" stopColor="#000" /><stop offset={FEATHER / (box.maxX - box.minX)} stopColor="#fff" />
                <stop offset={1 - FEATHER / (box.maxX - box.minX)} stopColor="#fff" /><stop offset="1" stopColor="#000" />
              </linearGradient>
              <linearGradient id={`mm-${uid}-fy`} gradientUnits="userSpaceOnUse" x1="0" y1={box.minY} x2="0" y2={box.maxY}>
                <stop offset="0" stopColor="#000" /><stop offset={FEATHER / (box.maxY - box.minY)} stopColor="#fff" />
                <stop offset={1 - FEATHER / (box.maxY - box.minY)} stopColor="#fff" /><stop offset="1" stopColor="#000" />
              </linearGradient>
              <mask id={`mm-${uid}-fy-m`} maskUnits="userSpaceOnUse" x={c.x0 - 10} y={c.y0 - 10} width={c.x1 - c.x0 + 20} height={c.y1 - c.y0 + 20}>
                <rect x={box.minX} y={box.minY} width={box.maxX - box.minX} height={box.maxY - box.minY} fill={`url(#mm-${uid}-fy)`} />
              </mask>
              <mask id={`mm-${uid}-feather`} maskUnits="userSpaceOnUse" x={c.x0 - 10} y={c.y0 - 10} width={c.x1 - c.x0 + 20} height={c.y1 - c.y0 + 20}>
                <g mask={`url(#mm-${uid}-fy-m)`}><rect x={box.minX} y={box.minY} width={box.maxX - box.minX} height={box.maxY - box.minY} fill={`url(#mm-${uid}-fx)`} /></g>
              </mask>
            </>
          ) : null}
          {revealing ? tiers.map((t) => {
            const r = revealRadius(tierReveal(progress, t), farthest);
            return (
              <React.Fragment key={t}>
                <radialGradient id={`mm-${uid}-rg-${t}`} gradientUnits="objectBoundingBox">
                  <stop offset="0" stopColor="#fff" /><stop offset={1 / 1.38} stopColor="#fff" /><stop offset="1" stopColor="#000" />
                </radialGradient>
                <mask id={maskId(t)} maskUnits="userSpaceOnUse" x={c.x0 - 10} y={c.y0 - 10} width={c.x1 - c.x0 + 20} height={c.y1 - c.y0 + 20}>
                  <circle cx={cx} cy={cy} r={Math.max(r, 0.001)} fill={`url(#mm-${uid}-rg-${t})`} />
                </mask>
              </React.Fragment>
            );
          }) : null}
        </defs>
        <g transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
          {background ? <rect x={c.x0 - 10} y={c.y0 - 10} width={c.x1 - c.x0 + 20} height={c.y1 - c.y0 + 20} fill={`url(#mm-${uid}-land)`} /> : null}
          <g mask={needsFeather ? `url(#mm-${uid}-feather)` : undefined}>{content}</g>
        </g>
      </svg>
      {vignette > 0 ? (
        <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 78% 74% at 50% 50%, ${rgba(theme.colors.background.deep, 0)} 52%, ${rgba(theme.colors.background.deep, Math.min(1, vignette) * (hero ? 0.85 : 0.45))} 100%)`}} />
      ) : null}
      {grain > 0 ? (
        <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: grainUrl, backgroundSize: `${GRAIN_TILE}px ${GRAIN_TILE}px`, mixBlendMode: 'overlay', opacity: Math.min(1, grain) * (light ? 1.2 : 1)}} />
      ) : null}
    </AbsoluteFill>
  );
};

/** The budget numbers (paths, elements, points) of a MetroMap frame, without rendering. Same inputs as the component. */
export type {MetroBudget};
