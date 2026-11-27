import React from 'react';
import {Composition, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  CANVAS,
  Glass,
  Text,
  ThemeProvider,
  createTheme,
  idleDrift,
  radius,
  rgba,
  space,
  textStyle,
  themes,
  unit,
  type Canvas,
  type Theme,
  type ThemeName,
} from '../index';

const NAMES: ThemeName[] = ['midnight', 'light', 'mono'];
/** Demo length in seconds. */
export const TOKENS_DEMO_SECONDS = 4;

/** Coloured backdrop (gradient + drifting radial orbs, no layer blur) so glass has something to blur. */
const Backdrop: React.FC<{theme: Theme; time: number}> = ({theme, time}) => {
  const {background: bg, tint} = theme.colors;
  const u = unit(theme);
  const orbs: Array<{x: number; y: number; r: number; c: string; a: number; ph: number}> = [
    {x: 22, y: 18, r: 46, c: tint.a, a: 0.85, ph: 0},
    {x: 80, y: 38, r: 42, c: tint.b, a: 0.8, ph: 1.7},
    {x: 30, y: 68, r: 44, c: tint.c, a: 0.75, ph: 3.1},
    {x: 78, y: 86, r: 40, c: tint.d, a: 0.9, ph: 4.4},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${bg.lift}, ${bg.base} 50%, ${bg.deep})`}}>
      {orbs.map((o, i) => {
        const dx = idleDrift(time + o.ph, 8) * 24 * u;
        const dy = idleDrift(time + o.ph + 2, 10) * 18 * u;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              // Oversized so the drift never exposes the panel edge.
              inset: -64 * u,
              transform: `translate(${dx}px, ${dy}px)`,
              background: `radial-gradient(circle at ${o.x}% ${o.y}%, ${rgba(o.c, o.a)} 0, ${rgba(o.c, 0)} ${o.r}%)`,
            }}
          />
        );
      })}
    </div>
  );
};

/** One themed panel showing every glass tier. Pure: `frame` is a prop. */
const Panel: React.FC<{name: ThemeName; canvas: Canvas; frame: number; width: number; height: number}> = ({name, canvas, frame, width, height}) => {
  const theme = createTheme({canvas}, name);
  const u = unit(theme);
  const time = frame / canvas.fps;
  const portrait = canvas.height > canvas.width;
  const gap = space(theme, 6);
  const pad = space(theme, portrait ? 8 : 10);
  const at = (i: number) => 0.6 + i * 0.45;

  const card = (
    <Glass tier="card" frame={frame} shimmerAt={at(0)} height={220 * u} style={{padding: space(theme, 6), display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: space(theme, 2)}}>
      <Text role="number" scale={0.8}>$12,400</Text>
      <Text role="caption" color="secondary">CARD</Text>
    </Glass>
  );
  const pill = (
    <Glass tier="pill" frame={frame} shimmerAt={at(1)} height={72 * u} style={{alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: space(theme, 3), padding: `0 ${space(theme, 8)}px`}}>
      <div style={{width: 16 * u, height: 16 * u, borderRadius: radius(theme, 'pill'), background: theme.colors.accent}} />
      <Text role="body" scale={0.85}>Pill</Text>
    </Glass>
  );
  const chips = (
    <div style={{display: 'flex', gap: space(theme, 3), flexWrap: 'wrap'}}>
      {[
        {t: 'Chip', c: theme.colors.text.primary},
        {t: '+2.4%', c: theme.colors.semantic.positive},
        {t: '−1.1%', c: theme.colors.semantic.negative},
      ].map((c, i) => (
        <Glass key={i} tier="chip" frame={frame} shimmerAt={at(2) + i * 0.1} height={48 * u} style={{display: 'flex', alignItems: 'center', padding: `0 ${space(theme, 4)}px`}}>
          <span style={textStyle(theme, 'caption', {color: c.c, weight: 'bold', scale: 0.9})}>{c.t}</span>
        </Glass>
      ))}
    </div>
  );
  const sheet = (
    <Glass tier="sheet" frame={frame} shimmerAt={at(3)} height={(portrait ? 210 : 260) * u} style={{padding: space(theme, 6)}}>
      <Text role="title" scale={0.7}>Sheet</Text>
      <Text role="caption" color="secondary" style={{marginTop: space(theme, 2)}}>SHEET · large radius, deepest shadow</Text>
    </Glass>
  );

  return (
    <div style={{position: 'relative', width, height, overflow: 'hidden'}}>
      <Backdrop theme={theme} time={time} />
      <ThemeProvider theme={theme}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: pad,
            display: 'flex',
            flexDirection: portrait ? 'row' : 'column',
            flexWrap: 'wrap',
            gap,
            alignContent: 'flex-start',
          }}
        >
          <div style={{...textStyle(theme, 'caption', {color: 'secondary', weight: 'bold'}), width: '100%'}}>{name.toUpperCase()}</div>
          {portrait ? (
            <>
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap}}>{card}{sheet}</div>
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap}}>{pill}{chips}</div>
            </>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap, width: '100%'}}>{card}{pill}{chips}{sheet}</div>
          )}
        </div>
      </ThemeProvider>
    </div>
  );
};

/** Props for the pure view. */
export interface TokensDemoViewProps {
  frame: number;
  canvas: Canvas;
}

/**
 * Pure demo view: all four glass tiers on a coloured background in all three themes (side by side in landscape,
 * stacked in portrait). Takes `frame` as a prop.
 * @example <TokensDemoView frame={90} canvas={CANVAS.landscape60} />
 */
export const TokensDemoView: React.FC<TokensDemoViewProps> = ({frame, canvas}) => {
  const portrait = canvas.height > canvas.width;
  const w = portrait ? canvas.width : canvas.width / NAMES.length;
  const h = portrait ? canvas.height / NAMES.length : canvas.height;
  return (
    <div style={{width: canvas.width, height: canvas.height, display: 'flex', flexDirection: portrait ? 'column' : 'row', background: themes.midnight.colors.background.deep}}>
      {NAMES.map((n) => (
        <Panel key={n} name={n} canvas={canvas} frame={frame} width={w} height={h} />
      ))}
    </div>
  );
};

/** Thin Remotion wrapper: reads the frame and composition size, then renders the pure view. */
export const TokensDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  return <TokensDemoView frame={frame} canvas={{fps, width, height}} />;
};

/**
 * Registers the kit demo compositions (16:9 @ 60, 9:16 @ 60, 16:9 @ 30). Render it inside <Root>.
 * @example <KitDemoCompositions />
 */
export const KitDemoCompositions: React.FC = () => (
  <>
    {(
      [
        ['Kit-Tokens-Demo', CANVAS.landscape60],
        ['Kit-Tokens-Demo-Vertical', CANVAS.vertical60],
        ['Kit-Tokens-Demo-30fps', CANVAS.landscape30],
      ] as const
    ).map(([id, c]) => (
      <Composition key={id} id={id} component={TokensDemo} durationInFrames={Math.round(TOKENS_DEMO_SECONDS * c.fps)} width={c.width} height={c.height} fps={c.fps} />
    ))}
  </>
);
