import React, {createContext, useContext} from 'react';
import type {GeoProjection} from 'd3-geo';
import {useTheme} from '../tokens';
import {mapStyle, mapStyleFromTheme} from './styles';
import type {MapContextValue, MapStyle, MapStyleName, PlaneBox} from './types';

const MapContext = createContext<MapContextValue | null>(null);

/** Access the nearest <MapCanvas>'s projection, style and view. */
export const useMap = (): MapContextValue => {
  const v = useContext(MapContext);
  if (!v) throw new Error('map components must be inside <MapCanvas>');
  return v;
};

export interface MapCanvasProps {
  projection: GeoProjection;
  /** 'night' | 'light' | 'mono' (kit styles) or a ready MapStyle. Omit to follow the current theme. */
  style?: MapStyleName | MapStyle;
  /** Plane units shown. Default: the theme canvas (0,0,width,height). */
  view?: PlaneBox;
  /** Paint the water/background rectangle (default true). */
  background?: boolean;
  children?: React.ReactNode;
}

/** SVG sized to the theme canvas; projection output is in `view` plane units. */
export const MapCanvas: React.FC<MapCanvasProps> = ({projection, style, view, background = true, children}) => {
  const theme = useTheme();
  const {width, height} = theme.canvas;
  const v: PlaneBox = view ?? {x0: 0, y0: 0, x1: width, y1: height};
  const s = typeof style === 'string' ? mapStyle(style) : style ?? mapStyleFromTheme(theme);
  return (
    <MapContext.Provider value={{projection, style: s, view: v}}>
      <svg width={width} height={height} viewBox={`${v.x0} ${v.y0} ${v.x1 - v.x0} ${v.y1 - v.y0}`} style={{display: 'block'}}>
        {background ? <rect x={v.x0} y={v.y0} width={v.x1 - v.x0} height={v.y1 - v.y0} fill={s.water} /> : null}
        {children}
      </svg>
    </MapContext.Provider>
  );
};
