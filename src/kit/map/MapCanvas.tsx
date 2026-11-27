import React, {createContext, useContext} from 'react';
import {geoIdentity, type GeoProjection} from 'd3-geo';
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
  /** Default: identity (plane units are used as is, e.g. a city's metre plane). */
  projection?: GeoProjection;
  /** 'night' | 'light' | 'mono' (kit styles) or a ready MapStyle. Omit to follow the current theme. */
  style?: MapStyleName | MapStyle;
  /** Plane units shown. Default: the theme canvas (0,0,width,height). */
  view?: PlaneBox;
  /** Paint the water/background rectangle (default true). */
  background?: boolean;
  /**
   * Extra drawing area on every side as a fraction of the canvas (default 0). The default view grows with it, so
   * canvas px stay plane px; used under a 3D tilt so land never ends at the frame edge.
   */
  overscan?: number;
  children?: React.ReactNode;
}

/** SVG sized to the theme canvas; projection output is in `view` plane units. */
export const MapCanvas: React.FC<MapCanvasProps> = ({projection, style, view, background = true, overscan = 0, children}) => {
  const theme = useTheme();
  const {width, height} = theme.canvas;
  const ox = Math.round(width * overscan);
  const oy = Math.round(height * overscan);
  const v: PlaneBox = view ?? {x0: -ox, y0: -oy, x1: width + ox, y1: height + oy};
  const s = typeof style === 'string' ? mapStyle(style) : style ?? mapStyleFromTheme(theme);
  return (
    <MapContext.Provider value={{projection: projection ?? (geoIdentity() as unknown as GeoProjection), style: s, view: v}}>
      <svg width={width + 2 * ox} height={height + 2 * oy} viewBox={`${v.x0} ${v.y0} ${v.x1 - v.x0} ${v.y1 - v.y0}`} style={{display: 'block', marginLeft: -ox, marginTop: -oy}}>
        {background ? <rect x={v.x0} y={v.y0} width={v.x1 - v.x0} height={v.y1 - v.y0} fill={s.water} /> : null}
        {children}
      </svg>
    </MapContext.Provider>
  );
};
