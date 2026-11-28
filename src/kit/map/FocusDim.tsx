import React, {useId} from 'react';
import {useMap} from './MapCanvas';
import {highlightProgress} from './highlight';

export interface FocusDimProps {
  /** Regions left undimmed, as projected paths with their own 0..1 focus (see useRegionShapes). */
  focus?: {d: string; progress: number}[];
  /** Explicit dim amount 0..1. Wins over frame/at. */
  amount?: number;
  /** Or: spring the dim in from `at` seconds (and out from `until`). */
  frame?: number;
  at?: number;
  until?: number;
  fps?: number;
}

/**
 * Dims everything drawn before it, except the focused regions, which are cut out of the veil in proportion to their
 * progress (so focus hands over smoothly from one region to the next). Put it inside <MapCanvas>, after the base layers.
 */
export const FocusDim: React.FC<FocusDimProps> = ({focus = [], amount, frame, at = 0, until, fps = 60}) => {
  const {style, view} = useMap();
  const id = `kitdim${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const p = amount ?? (frame === undefined ? 1 : highlightProgress(frame / fps, at, until));
  if (p <= 0) return null;
  const box = {x: view.x0, y: view.y0, width: view.x1 - view.x0, height: view.y1 - view.y0};
  return (
    <g>
      <mask id={id} maskUnits="userSpaceOnUse" {...box}>
        <rect {...box} fill="white" />
        {focus.map((f, i) => <path key={i} d={f.d} fill="black" fillOpacity={f.progress} />)}
      </mask>
      <rect {...box} fill={style.dim} opacity={style.dimOpacity * p} mask={`url(#${id})`} />
    </g>
  );
};
