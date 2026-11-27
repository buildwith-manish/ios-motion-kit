import React, {useId} from 'react';
import {useMap} from './MapCanvas';
import {highlightProgress} from './highlight';
import {rgba} from '../tokens';
import type {MapShape} from './regions';

/** Blur radii in plane px (the SVG blur parameter is the standard deviation). All stay under the kit's 20px limit. */
export const HIGHLIGHT_BLUR_PX = {shadow: 7, glow: 8, inner: 9} as const;

export interface RegionHighlightProps {
  shape: Pick<MapShape, 'd' | 'bounds'>;
  /** Explicit 0..1. Wins over frame/at. */
  progress?: number;
  /** Or: spring fade-in from `at` seconds (and out from `until`). */
  frame?: number;
  at?: number;
  until?: number;
  fps?: number;
  /** How far the region rises at full progress, px. Default 0 (flat). */
  lift?: number;
  /** Soft contact shadow under the shape. Default true. */
  shadow?: boolean;
}

/**
 * One highlighted region: contact shadow, accent fill, soft inner light and a faint outer glow, all confined to this
 * shape (the glow is masked to the outside, the inner light is clipped to the inside). Optional 2.5D lift.
 */
export const RegionHighlight: React.FC<RegionHighlightProps> = ({shape, progress, frame, at = 0, until, fps = 60, lift = 0, shadow = true}) => {
  const {style} = useMap();
  const uid = `kithl${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const p = progress ?? (frame === undefined ? 1 : highlightProgress(frame / fps, at, until));
  if (p <= 0) return null;
  const {d, bounds: [[x0, y0], [x1, y1]]} = shape;
  const pad = 3 * Math.max(...Object.values(HIGHLIGHT_BLUR_PX)) + lift;
  // filter/mask regions are limited to the shape's own box, which also keeps software-GL blur cheap
  const box = {x: x0 - pad, y: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad};
  const rise = lift * p;
  const light = Math.max(x1 - x0, y1 - y0);
  const blur = (key: keyof typeof HIGHLIGHT_BLUR_PX) => (
    <filter id={`${uid}-${key}`} filterUnits="userSpaceOnUse" {...box}><feGaussianBlur stdDeviation={HIGHLIGHT_BLUR_PX[key]} /></filter>
  );
  return (
    <g>
      <defs>
        {blur('shadow')}{blur('glow')}{blur('inner')}
        <clipPath id={`${uid}-in`}><path d={d} /></clipPath>
        <mask id={`${uid}-out`} maskUnits="userSpaceOnUse" {...box}>
          <rect {...box} fill="white" />
          <path d={d} fill="black" />
        </mask>
        <radialGradient id={`${uid}-light`} gradientUnits="userSpaceOnUse" cx={x0 + (x1 - x0) * 0.4} cy={y0 + (y1 - y0) * 0.28} r={light * 0.75}>
          <stop offset="0" stopColor={rgba(style.innerLight, 0.5)} />
          <stop offset="1" stopColor={rgba(style.innerLight, 0)} />
        </radialGradient>
      </defs>
      {shadow ? (
        // stays on the "ground": it drops further from the shape as the shape rises
        <path d={d} fill={style.shadow} opacity={p} transform={`translate(0 ${2 + rise * 0.35})`} filter={`url(#${uid}-shadow)`} />
      ) : null}
      <g opacity={p} transform={`translate(0 ${-rise})`}>
        <g mask={`url(#${uid}-out)`}>
          <path d={d} fill="none" stroke={style.glow} strokeOpacity={0.4} strokeWidth={10} strokeLinejoin="round" filter={`url(#${uid}-glow)`} />
        </g>
        <path d={d} fill={style.land} />
        <path d={d} fill={style.highlightSolid} />
        <g clipPath={`url(#${uid}-in)`}>
          <path d={d} fill={`url(#${uid}-light)`} />
          <path d={d} fill="none" stroke={style.innerLight} strokeOpacity={0.4} strokeWidth={18} strokeLinejoin="round" filter={`url(#${uid}-inner)`} />
        </g>
        <path d={d} fill="none" stroke={style.highlight} strokeWidth={style.hairline * 2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </g>
    </g>
  );
};
