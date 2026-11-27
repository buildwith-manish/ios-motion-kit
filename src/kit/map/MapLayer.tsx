import React from 'react';
import {useMap} from './MapCanvas';

export interface MapLayerProps {
  /** SVG path strings (already projected). */
  paths: string[];
  fill?: 'land' | 'landAlt' | 'highlightFill' | 'none';
  stroke?: 'stroke' | 'strokeSoft' | 'highlight' | 'none';
  /** Stroke width multiplier of the style hairline (default 1). */
  weight?: number;
  opacity?: number;
}

/** Fills and strokes pre-projected paths from the map style tokens. Hairlines stay crisp at 4K (non-scaling stroke). */
export const MapLayer: React.FC<MapLayerProps> = ({paths, fill = 'land', stroke = 'stroke', weight = 1, opacity = 1}) => {
  const {style} = useMap();
  const f = fill === 'none' ? 'none' : style[fill];
  const s = stroke === 'none' ? 'none' : style[stroke];
  return (
    <g opacity={opacity} fill={f} stroke={s} strokeWidth={style.hairline * weight} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      {paths.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
    </g>
  );
};
