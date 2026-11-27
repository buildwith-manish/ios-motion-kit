import React from 'react';
import {AbsoluteFill, Composition, Sequence, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, textStyle, ThemeProvider, unit, useTheme, type Canvas, type ThemeName} from '../index';
import {featureById, MapSourceLine, MetroMap, useBakedTopo, useCity, useCityAlignment, type MetroMode} from '../map';

/** Generic samples only: any baked city id from cities.json and its Census CBSA code. */
export const CBSA_OF: Record<string, string> = {
  chicago: '16980', 'new-york': '35620', miami: '33100', atlanta: '12060', washington: '47900', philadelphia: '37980',
  houston: '26420', 'los-angeles': '31080', phoenix: '38060', dallas: '19100',
};
export const METRO_ZOOMS = [1, 2.2, 4.5] as const;
export const METRO_SCENE_SECONDS = 3;
export const METRO_DEMO_SECONDS = METRO_ZOOMS.length * METRO_SCENE_SECONDS;

interface MetroSceneProps {
  cityId: string; detail: 'light' | 'rich'; zoom: number; mode: MetroMode;
  /** Draw the metro boundary from the baked CBSA layer. */
  boundary?: boolean;
  /** Fully revealed (stills) instead of the radial reveal from the frame. */
  settled?: boolean;
  label?: string;
}

const Inner: React.FC<MetroSceneProps & {boundaryFeature?: unknown}> = ({cityId, detail, zoom, mode, settled, boundaryFeature}) => {
  const frame = useCurrentFrame();
  const city = useCity(cityId, detail);
  const alignment = useCityAlignment(cityId);
  if (!city) return null;
  return <MetroMap city={city} alignment={alignment ?? undefined} frame={frame} zoom={zoom} mode={mode} boundary={boundaryFeature} reveal={settled ? 1 : undefined} revealSeconds={1.9} revealDelaySeconds={0.15} />;
};

const WithBoundary: React.FC<MetroSceneProps> = (p) => {
  const cbsa = useBakedTopo('cbsa.json');
  if (!cbsa) return null;
  return <Inner {...p} boundaryFeature={featureById(cbsa, CBSA_OF[p.cityId])} />;
};

/** Sample content that the dim map sits behind (generic text only). */
const SampleContent: React.FC = () => {
  const theme = useTheme();
  const u = unit(theme);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: u * 2}}>
      <div style={{...textStyle(theme, 'caption'), color: theme.colors.text.secondary, letterSpacing: 2, textTransform: 'uppercase'}}>Sample figure</div>
      <div style={{...textStyle(theme, 'display'), color: theme.colors.accent}}>12,345</div>
    </AbsoluteFill>
  );
};

export const MetroScene: React.FC<MetroSceneProps> = (p) => {
  const theme = useTheme();
  const portrait = theme.canvas.height > theme.canvas.width;
  return (
    <AbsoluteFill>
      {p.boundary && CBSA_OF[p.cityId] ? <WithBoundary {...p} /> : <Inner {...p} />}
      {p.mode === 'dim' ? <SampleContent /> : null}
      <div style={{position: 'absolute', left: portrait ? 64 : 96, top: portrait ? 160 : 72, ...textStyle(theme, 'title', {scale: 0.7}), color: theme.colors.text.primary}}>{p.label ?? `${p.cityId} · ${p.zoom}×`}</div>
      <MapSourceLine style={{position: 'absolute', left: portrait ? 64 : 96, bottom: 56}} />
    </AbsoluteFill>
  );
};

/** One sample metro at three zoom levels in a row, hero or dim. */
export const MetroZoomsDemo: React.FC<{cityId: string; mode: MetroMode; detail: 'light' | 'rich'}> = ({cityId, mode, detail}) => {
  const {fps} = useTheme().canvas;
  return (
    <AbsoluteFill>
      {METRO_ZOOMS.map((z, i) => (
        <Sequence key={z} from={i * METRO_SCENE_SECONDS * fps} durationInFrames={METRO_SCENE_SECONDS * fps}>
          <MetroScene cityId={cityId} detail={detail} zoom={z} mode={mode} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SHAPES: {key: string; canvas: Canvas}[] = [{key: 'Landscape', canvas: CANVAS.landscape60}, {key: 'Portrait', canvas: CANVAS.vertical60}];
const themed = (canvas: Canvas, theme: ThemeName, node: React.ReactNode) => <ThemeProvider theme={createTheme({canvas}, theme)}>{node}</ThemeProvider>;

/**
 * Kit-Metro-<Landscape|Portrait> (props: theme, cityId, mode, detail): three zoom levels, 3 s each.
 * Kit-Metro-Still-<Landscape|Portrait> (props: theme, cityId, detail, zoom, mode, boundary): one settled frame for stills and timing.
 */
export const KitMetroCompositions: React.FC = () => (
  <>
    {SHAPES.map(({key, canvas}) => (
      <React.Fragment key={key}>
        <Composition
          id={`Kit-Metro-${key}`} durationInFrames={METRO_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps}
          component={({theme, cityId, mode, detail}: {theme: ThemeName; cityId: string; mode: MetroMode; detail: 'light' | 'rich'}) => themed(canvas, theme, <MetroZoomsDemo cityId={cityId} mode={mode} detail={detail} />)}
          defaultProps={{theme: 'midnight' as ThemeName, cityId: 'chicago', mode: 'hero' as MetroMode, detail: 'rich' as const}}
        />
        <Composition
          id={`Kit-Metro-Still-${key}`} durationInFrames={canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps}
          component={({theme, cityId, detail, zoom, mode, boundary}: {theme: ThemeName; cityId: string; detail: 'light' | 'rich'; zoom: number; mode: MetroMode; boundary: boolean}) => themed(canvas, theme, <MetroScene cityId={cityId} detail={detail} zoom={zoom} mode={mode} boundary={boundary} settled />)}
          defaultProps={{theme: 'midnight' as ThemeName, cityId: 'chicago', detail: 'rich' as const, zoom: 1, mode: 'hero' as MetroMode, boundary: false}}
        />
      </React.Fragment>
    ))}
  </>
);
