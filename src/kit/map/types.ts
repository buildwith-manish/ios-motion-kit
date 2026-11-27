/** Map kit types. Video-agnostic: cities and regions arrive as plain data or props. Seconds in public APIs. */
import type {GeoProjection} from 'd3-geo';

export type RegionKind = 'state' | 'county' | 'cbsa' | 'zcta' | 'tract';
export type MapStyleName = 'night' | 'light' | 'mono';

/** Resolved paint for the map layers; every colour is derived from a kit theme (see styles.ts). */
export interface MapStyle {
  name: MapStyleName;
  water: string;
  land: string;
  landAlt: string;
  stroke: string;
  strokeSoft: string;
  highlight: string;
  highlightFill: string;
  /** City detail: road tiers, water fill, park fill. */
  road: string;
  roadMajor: string;
  waterFill: string;
  park: string;
  /** Veil colour of <FocusDim> and its strength at full dim (0..1). */
  dim: string;
  dimOpacity: number;
  /** <RegionHighlight>: solid accent fill, soft inner light, faint outer glow, contact shadow (all theme-derived). */
  highlightSolid: string;
  innerLight: string;
  glow: string;
  shadow: string;
  /** <Choropleth> missing values: muted fill and hatch line colour. */
  missing: string;
  missingHatch: string;
  /** Hairline stroke width in CSS px (non-scaling, so 4K via --scale=2 keeps it crisp). */
  hairline: number;
}

/** Axis-aligned box in plane units. */
export interface PlaneBox {x0: number; y0: number; x1: number; y1: number}

export interface MapContextValue {
  projection: GeoProjection;
  style: MapStyle;
  /** viewBox of the SVG in plane units. */
  view: PlaneBox;
}

/** A place by latitude and longitude (degrees). */
export interface LatLng {lat: number; lng: number}
