import React, {useMemo} from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, textStyle, ThemeProvider, useTheme, type Canvas, type ThemeName} from '../index';
import {sampleCamera} from '../camera';
import {
  Arc, flightPlan, FlyMap, MapCallouts, MapPin, MapSourceLine, RouteDraw, useCity, useCityAlignment, useUsProjection,
} from '../map';
import {CBSA_OF} from './MetroDemo';

/** Generic samples only: two coast cities for the arc, one metro for the landing. All numbers are made up. */
const WEST = {lat: 34.05, lng: -118.24};
const EAST = {lat: 40.71, lng: -74.0};
const METRO_ID = 'chicago';
const METRO = {lat: 41.8781, lng: -87.6298};
/** Inside the 14 km baked city box (the street layer only exists there), a few km from the centre. */
const SPOTS = {core: {lat: 41.8819, lng: -87.6278}, north: {lat: 41.9217, lng: -87.654}, south: {lat: 41.85, lng: -87.617}};

/** Seconds. Leg 1 crosses the country, leg 2 flies into the metro. */
export const FLY_PLAN = {
  start: {lat: 47.6, lng: -122.3, zoom: 3},
  legs: [
    {lat: 39.5, lng: -98, zoom: 0.45, duration: 2.6, hold: 3.4},
    {lat: METRO.lat, lng: METRO.lng, zoom: 8.3, duration: 3.6, hold: 3.2},
  ],
} as const;
export const FLY_SECONDS = 13.4;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const Scene: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const canvas = theme.canvas;
  const projection = useUsProjection();
  const city = useCity(METRO_ID, 'rich');
  const alignment = useCityAlignment(METRO_ID);
  const plan = useMemo(
    () => (projection ? flightPlan({projection, canvas, from: FLY_PLAN.start, start: 0, legs: [...FLY_PLAN.legs]}) : null),
    [projection, canvas],
  );
  if (!projection || !plan || !city || !alignment) return null;

  const t = frame / canvas.fps;
  const [leg1, leg2] = plan.legs;
  const countryPose = sampleCamera(plan.keyframes, leg1.lands);
  const metroPose = sampleCamera(plan.keyframes, leg2.lands);
  const countryOpacity = 1 - smooth(leg2.departs, leg2.departs + 1.2, t);
  const portrait = canvas.height > canvas.width;

  return (
    <AbsoluteFill>
      <FlyMap frame={frame} keyframes={plan.keyframes} projection={projection} metro={{city, alignment}} blend={[6.2, 7.6]} outlineId={CBSA_OF[METRO_ID]}>
        {/* country scale: two pins, an arc between them, numbers */}
        {countryOpacity > 0.002 ? (
          <div style={{position: 'absolute', inset: 0, opacity: countryOpacity}}>
            <MapPin {...WEST} at={leg1.lands - 0.2} />
            <MapPin {...EAST} at={leg1.lands + 0.2} />
            <Arc from={WEST} to={EAST} at={leg1.lands + 0.7} response={1.4} />
            <MapCallouts
              layoutPose={countryPose}
              items={[
                {id: 'west', ...WEST, at: leg1.lands + 1.2, title: 'Sample A, units', value: 1280, decimals: 0},
                {id: 'east', ...EAST, at: leg1.lands + 1.5, title: 'Sample B', value: 94.6, decimals: 1, suffix: '%'},
              ]}
            />
          </div>
        ) : null}
        {/* metro scale: pins, a route, numbers */}
        <MapPin {...SPOTS.core} at={leg2.lands - 0.1} scale={1.1} />
        <MapPin {...SPOTS.north} at={leg2.lands + 0.2} />
        <MapPin {...SPOTS.south} at={leg2.lands + 0.5} />
        <RouteDraw points={[SPOTS.north, SPOTS.core, SPOTS.south]} at={leg2.lands + 0.9} response={1.4} />
        <MapCallouts
          layoutPose={metroPose}
          pinScale={1}
          items={[
            {id: 'core', ...SPOTS.core, at: leg2.lands + 1.5, title: 'Core', value: 4210, decimals: 0, prefix: '$'},
            {id: 'north', ...SPOTS.north, at: leg2.lands + 1.8, title: 'North, minutes', value: 37.2, decimals: 1},
            {id: 'south', ...SPOTS.south, at: leg2.lands + 2.1, title: 'South, stops', value: 18, decimals: 0},
          ]}
        />
      </FlyMap>
      <div style={{position: 'absolute', left: portrait ? 64 : 96, top: portrait ? 160 : 72, ...textStyle(theme, 'title', {scale: 0.7}), color: theme.colors.text.primary}}>
        Fly-through
      </div>
      <MapSourceLine style={{position: 'absolute', left: portrait ? 64 : 96, bottom: 56}} />
    </AbsoluteFill>
  );
};

const SHAPES: {key: string; canvas: Canvas}[] = [{key: 'Landscape', canvas: CANVAS.landscape60}, {key: 'Portrait', canvas: CANVAS.vertical60}];

/** Kit-Fly-<Landscape|Portrait> (prop: theme): fly across the US to a metro, pins, arc, route, callouts with numbers. 13.4 s. */
export const KitFlyCompositions: React.FC = () => (
  <>
    {SHAPES.map(({key, canvas}) => (
      <Composition
        key={key}
        id={`Kit-Fly-${key}`}
        durationInFrames={FLY_SECONDS * canvas.fps}
        width={canvas.width}
        height={canvas.height}
        fps={canvas.fps}
        component={({theme}: {theme: ThemeName}) => (
          <ThemeProvider theme={createTheme({canvas}, theme)}>
            <Scene />
          </ThemeProvider>
        )}
        defaultProps={{theme: 'midnight' as ThemeName}}
      />
    ))}
  </>
);
