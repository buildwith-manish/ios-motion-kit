import React from 'react';
import {AbsoluteFill, Composition, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, textStyle, ThemeProvider, useTheme, type Canvas, type ThemeName} from '../index';
import {
  allFeatures, CityLayer, cityAlignmentTransform, featureById, fitAlbers, fitAlbersUsa, mapStyle, MapCanvas, MapSourceLine,
  outlineLand, RegionLayer, useBakedTopo, useCity, type MapStyleName,
} from '../map';

/** Generic samples only: the US, Colorado, the Denver CBSA. Nothing PayRanked-specific. */
export const MAP_DEMO_SECONDS = 9;
const SCENE = 3; // seconds per scene
const STATE = '08';
const CBSA = '19740';

const Label: React.FC<{text: string}> = ({text}) => {
  const theme = useTheme();
  const portrait = theme.canvas.height > theme.canvas.width;
  return <div style={{position: 'absolute', left: portrait ? 64 : 96, top: portrait ? 160 : 72, ...textStyle(theme, 'title', {scale: 0.7}), color: theme.colors.text.primary}}>{text}</div>;
};

const Fade: React.FC<{children: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  const {fps} = useTheme().canvas;
  return <AbsoluteFill style={{opacity: interpolate(f, [0, 0.4 * fps], [0, 1], {extrapolateRight: 'clamp'})}}>{children}</AbsoluteFill>;
};

const useSize = () => { const {width, height} = useTheme().canvas; return {width, height, pad: Math.round(Math.min(width, height) * 0.07)}; };

const UsScene: React.FC<{style: MapStyleName}> = ({style}) => {
  const {width, height, pad} = useSize();
  const outline = useBakedTopo('outline.json');
  if (!outline) return null;
  const projection = fitAlbersUsa(outlineLand(outline), width, height, pad);
  return <Fade><MapCanvas projection={projection} style={style}><RegionLayer kind="state" /></MapCanvas><Label text="States" /></Fade>;
};

const StateScene: React.FC<{style: MapStyleName}> = ({style}) => {
  const {width, height, pad} = useSize();
  const states = useBakedTopo('states.json');
  if (!states) return null;
  const projection = fitAlbers(featureById(states, STATE), width, height, pad);
  return <Fade><MapCanvas projection={projection} style={style}><RegionLayer kind="county" idPrefix={STATE} /><RegionLayer kind="state" idPrefix={STATE} fill="none" weight={1.8} /></MapCanvas><Label text="Counties" /></Fade>;
};

const MetroScene: React.FC<{style: MapStyleName}> = ({style}) => {
  const {width, height, pad} = useSize();
  const cbsa = useBakedTopo('cbsa.json');
  if (!cbsa) return null;
  const projection = fitAlbers(featureById(cbsa, CBSA), width, height, pad);
  return (
    <Fade>
      <MapCanvas projection={projection} style={style}>
        <RegionLayer kind="zcta" />
        <RegionLayer kind="tract" state={STATE} fill="none" weight={0.6} />
        <RegionLayer kind="cbsa" idPrefix={CBSA} highlight={[CBSA]} fill="none" />
      </MapCanvas>
      <Label text="ZCTAs + tracts" />
    </Fade>
  );
};

/** US states -> a state's counties -> a metro's ZCTAs and tracts. One map style per instance. */
export const MapDemo: React.FC<{style: MapStyleName}> = ({style}) => {
  const theme = useTheme();
  const {fps} = theme.canvas;
  return (
    <AbsoluteFill style={{background: mapStyle(style).water}}>
      <Sequence from={0} durationInFrames={SCENE * fps}><UsScene style={style} /></Sequence>
      <Sequence from={SCENE * fps} durationInFrames={SCENE * fps}><StateScene style={style} /></Sequence>
      <Sequence from={2 * SCENE * fps} durationInFrames={SCENE * fps}><MetroScene style={style} /></Sequence>
      <MapSourceLine style={{position: 'absolute', left: 96, bottom: 56}} />
    </AbsoluteFill>
  );
};

/** One city's baked streets (rich or light) in the theme's style, centred, 14 km box fitted to the shorter canvas side. */
export const MapCityDemo: React.FC<{cityId: string; detail: 'light' | 'rich'; style: MapStyleName}> = ({cityId, detail, style}) => {
  const {width, height} = useTheme().canvas;
  const city = useCity(cityId, detail);
  if (!city) return null;
  const side = city.bbox.maxX - city.bbox.minX;
  const k = Math.min(width, height) / side;
  const view = {x0: -width / 2 / k, y0: -height / 2 / k, x1: width / 2 / k, y1: height / 2 / k};
  void cityAlignmentTransform;
  return (
    <AbsoluteFill>
      <MapCanvas style={style} view={view}>
        <rect x={view.x0} y={view.y0} width={view.x1 - view.x0} height={view.y1 - view.y0} fill={mapStyle(style).land} />
        <CityLayer city={city} />
      </MapCanvas>
      <Label text={city.name} />
    </AbsoluteFill>
  );
};

const THEMES: {name: ThemeName; style: MapStyleName}[] = [{name: 'midnight', style: 'night'}, {name: 'light', style: 'light'}, {name: 'mono', style: 'mono'}];
const SHAPES: {key: string; canvas: Canvas}[] = [{key: 'Landscape', canvas: CANVAS.landscape60}, {key: 'Portrait', canvas: CANVAS.vertical60}];

const wrap = (themeName: ThemeName, canvas: Canvas) => ({style}: {style: MapStyleName}) => (
  <ThemeProvider theme={createTheme({canvas}, themeName)}><MapDemo style={style} /></ThemeProvider>
);

/** Registers Kit-Map-<Night|Light|Mono>-<Landscape|Portrait> and Kit-Map-City (props: cityId, detail, theme). */
export const KitMapCompositions: React.FC = () => (
  <>
    {THEMES.flatMap(({name, style}) => SHAPES.map(({key, canvas}) => (
      <Composition key={`${name}${key}`} id={`Kit-Map-${style[0].toUpperCase()}${style.slice(1)}-${key}`} component={wrap(name, canvas)} durationInFrames={MAP_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{style}} />
    )))}
    <Composition
      id="Kit-Map-City" durationInFrames={60} width={1920} height={1080} fps={60}
      component={({cityId, detail, theme}: {cityId: string; detail: 'light' | 'rich'; theme: ThemeName}) => (
        <ThemeProvider theme={createTheme({canvas: CANVAS.landscape60}, theme)}><MapCityDemo cityId={cityId} detail={detail} style={theme === 'midnight' ? 'night' : theme} /></ThemeProvider>
      )}
      defaultProps={{cityId: 'chicago', detail: 'rich' as const, theme: 'midnight' as ThemeName}}
    />
  </>
);
