import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {geoAlbers, geoAlbersUsa} from 'd3-geo';
import {textStyle, unit, useTheme} from '../index';
import {
  allFeatures, Choropleth, featureById, fitExtent, HighlightStage, highlightProgress, makeColorScale, mapStyleFromTheme,
  MapCanvas, MapLegend, MapSourceLine, RegionLayer, topoFeatures, useBakedTopo, type ColorScaleSpec, type HighlightStep,
} from '../map';
import sample from './data/map-sample-zcta.json';

export const MAP_HIGHLIGHT_SECONDS = 10;
export const MAP_CHOROPLETH_SECONDS = 6;

/** Three generic sample states, lit one after another. */
const STEPS: HighlightStep[] = [
  {ids: ['08'], at: 0.6, until: 3.4},
  {ids: ['29'], at: 3.4, until: 6.2},
  {ids: ['13'], at: 6.2, until: 9.0},
];

const useLayout = () => {
  const theme = useTheme();
  const {width, height} = theme.canvas;
  const portrait = height > width;
  return {theme, width, height, portrait, u: unit(theme), left: portrait ? 64 : 96, top: portrait ? 200 : 72};
};

/** US states: highlight three in sequence with focus dimming, contact shadow, lift and tilt. */
export const MapHighlightDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {theme, width, height, portrait, left, top} = useLayout();
  const states = useBakedTopo('states.json');
  const pad = Math.round(Math.min(width, height) * (portrait ? 0.04 : 0.09));
  // fit all states (with the AK/HI insets) into the area under the title; territories fall outside geoAlbersUsa
  const projection = useMemo(
    () => (states ? fitExtent(geoAlbersUsa(), allFeatures(states), {x0: pad, y0: top + 140, x1: width - pad, y1: height - (portrait ? pad : 90)}) : null),
    [states, width, height, pad, top, portrait],
  );
  if (!projection || !states) return null;
  const time = frame / theme.canvas.fps;
  return (
    <AbsoluteFill>
      <HighlightStage projection={projection} frame={frame} steps={STEPS} kind="state">
        <RegionLayer kind="state" />
      </HighlightStage>
      {STEPS.map((s) => (
        <div key={s.ids[0]} style={{position: 'absolute', left, top, ...textStyle(theme, 'title'), opacity: Math.max(0, 2 * highlightProgress(time, s.at, s.until) - 1)}}>
          {topoFeatures(states).get(s.ids[0])?.properties?.NAME}
        </div>
      ))}
      <MapSourceLine style={{position: 'absolute', left, bottom: portrait ? height * 0.22 : 56}} />
    </AbsoluteFill>
  );
};

/** ZIP areas (ZCTAs) of one metro coloured from plain JSON, with a glass legend. */
export const MapChoroplethDemo: React.FC<{scale: ColorScaleSpec['type']}> = ({scale: type}) => {
  const frame = useCurrentFrame();
  const {theme, width, height, portrait, left, top, u} = useLayout();
  const cbsa = useBakedTopo('cbsa.json');
  const metro = cbsa ? featureById(cbsa, sample.cbsa) : null;
  // leave room for the title and the legend: right of the map in landscape, under it in portrait
  const box = portrait ? {x0: 40, y0: 330, x1: width - 40, y1: height * 0.68} : {x0: 120, y0: 150, x1: width - 700 * u, y1: height - 70};
  const projection = useMemo(
    () => (metro ? fitExtent(geoAlbers(), metro, box) : null),
    [cbsa, width, height],
  );
  if (!projection || !metro) return null;
  const data: Record<string, number | null> = type === 'sequential' ? sample.index : sample.change;
  const scale = makeColorScale(theme, type === 'sequential' ? {type, domain: [20, 90]} : {type, domain: [-12, 0, 20]});
  const style = mapStyleFromTheme(theme);
  return (
    <AbsoluteFill>
      <MapCanvas projection={projection} style={style}>
        <RegionLayer kind="cbsa" />
        <Choropleth kind="zcta" within={metro} data={data} scale={scale} frame={frame} start={0.4} spread={1.6} order={type === 'sequential' ? 'center-out' : 'value'} />
        <RegionLayer kind="cbsa" idPrefix={sample.cbsa} fill="none" weight={2.4} />
      </MapCanvas>
      <div style={{position: 'absolute', left, top, ...textStyle(theme, 'title', {scale: 0.8})}}>ZIP areas</div>
      <div style={{position: 'absolute', left, top: top + 70 * u, ...textStyle(theme, 'caption', {color: 'secondary'})}}>Synthetic sample data</div>
      <MapLegend
        scale={scale}
        title={type === 'sequential' ? 'Sample index' : 'Sample change'}
        format={(v) => (type === 'diverging' && v > 0 ? `+${Math.round(v)}` : String(Math.round(v)))}
        style={portrait ? {position: 'absolute', left, top: height * 0.7} : {position: 'absolute', right: 96, bottom: 96}}
      />
      <MapSourceLine style={{position: 'absolute', left, bottom: portrait ? height * 0.1 : 32}} />
    </AbsoluteFill>
  );
};
