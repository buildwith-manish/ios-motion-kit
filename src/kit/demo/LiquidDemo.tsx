import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {Atmosphere, type AtmospherePreset} from '../background';
import {Glass, tintFor} from '../glass';
import {NumberText} from '../text';
import {CANVAS, createTheme, safeRect, space, textStyle, ThemeProvider, unit} from '../tokens';
import {safeText} from '../tokens/contrast';
import type {ThemeName} from '../tokens';
import type {Canvas, GlassTierProp, Theme} from '../tokens/types';

const THEMES: ThemeName[] = ['midnight', 'light', 'mono'];
const PRESETS: Record<ThemeName, AtmospherePreset> = {midnight: 'midnight-aurora', light: 'soft-light', mono: 'graphite'};
const SLOT_SECONDS = 2.5;
const DEMO_SECONDS = THEMES.length * SLOT_SECONDS;

/** One hero card: same content for every tier, so card vs liquid differ only in the glass. */
const HeroCard: React.FC<{theme: Theme; tier: GlassTierProp; label: string; frame: number; light: number; x: number; y: number; w: number; h: number; canvas: Canvas}> = ({theme, tier, label, frame, light, x, y, w, h, canvas}) => {
  const u = unit(theme);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w}}>
      <div style={{...textStyle(theme, 'caption', {weight: 'bold'}), color: safeText(theme, 'primary', 'canvas'), textTransform: 'uppercase', marginBottom: space(theme, 3)}}>{label}</div>
      <Glass
        tier={tier}
        width={w}
        height={h}
        lightAngle={light}
        position={{x: (x + w / 2) / canvas.width, y: (y + h / 2) / canvas.height}}
        kitRole="hero"
        style={{boxSizing: 'border-box', padding: space(theme, 8), display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: space(theme, 3)}}
      >
        <div style={{...textStyle(theme, 'title'), color: safeText(theme, 'primary', 'card')}}>Glass with depth</div>
        <div style={{...textStyle(theme, 'body'), color: safeText(theme, 'secondary', 'card')}}>Same scene, same text.</div>
        <NumberText frame={frame} from={0} to={4210} duration={1.1} layout="reserve" prefix="$" role="number" color={safeText(theme, 'primary', 'card')} fontSize={88 * u} />
      </Glass>
    </div>
  );
};

/** Pure demo view: card vs liquid on the same Atmosphere scene, once per theme. `frame` is a prop. */
export const LiquidDemoView: React.FC<{frame: number; canvas: Canvas}> = ({frame, canvas}) => {
  const {fps, width, height} = canvas;
  const slot = Math.min(THEMES.length - 1, Math.floor(frame / (SLOT_SECONDS * fps)));
  const name = THEMES[slot];
  const theme = createTheme({canvas}, name);
  const local = frame - slot * SLOT_SECONDS * fps;
  const safe = safeRect(theme, 'title');
  const portrait = height > width;
  const u = unit(theme);
  const gap = 48 * u;
  const label = 40 * u;
  const cw = portrait ? safe.width : (safe.width - gap) / 2;
  const ch = Math.min(portrait ? (safe.height - gap) / 2 - label * 2 : safe.height * 0.62, portrait ? 520 * u : 420 * u);
  const top = portrait ? safe.top + (safe.height - (ch * 2 + gap + label * 2)) / 2 : safe.top + (safe.height - ch - label) / 2;
  // Light angle sweeps +-24deg around top-left over 5 s (pure function of frame).
  const light = 315 + 24 * Math.sin((2 * Math.PI * frame) / (5 * fps));
  const cards: Array<[GlassTierProp, string]> = [['card', 'card'], ['liquid', 'liquid']];
  return (
    <ThemeProvider theme={theme}>
      <Atmosphere frame={frame} preset={PRESETS[name]} theme={theme} intensity={1}>
        {cards.map(([tier, text], i) => (
          <HeroCard
            key={tier}
            theme={theme}
            tier={tier}
            label={`${text} · ${name}`}
            frame={local}
            light={light}
            x={portrait ? safe.left : safe.left + i * (cw + gap)}
            y={portrait ? top + i * (ch + gap + label * 2) : top}
            w={cw}
            h={ch}
            canvas={canvas}
          />
        ))}
      </Atmosphere>
    </ThemeProvider>
  );
};

/** Perf scene: three hero cards of one tier on an Atmosphere. Rendered for 'card' and 'liquid' by scripts/kit_glass_perf.mjs. */
export const LiquidPerfView: React.FC<{frame: number; canvas: Canvas; tier: GlassTierProp | 'none'}> = ({frame, canvas, tier}) => {
  const theme = createTheme({canvas});
  const u = unit(theme);
  const w = 520 * u;
  const h = 360 * u;
  const y = (canvas.height - h) / 2;
  const xs = [0.08, 0.37, 0.66].map((f) => canvas.width * f);
  return (
    <ThemeProvider theme={theme}>
      <Atmosphere frame={frame} preset="midnight-aurora" theme={theme}>
        {xs.map((x, i) => tier === 'none' ? (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: w, height: h}} />
        ) : (
          <Glass key={i} tier={tier} width={w} height={h} lightAngle={315 + 10 * i} position={{x: (x + w / 2) / canvas.width, y: 0.5}} style={{position: 'absolute', left: x, top: y, boxSizing: 'border-box', padding: space(theme, 8)}}>
            <div style={{...textStyle(theme, 'title'), color: safeText(theme, 'primary', 'card')}}>Hero {i + 1}</div>
          </Glass>
        ))}
      </Atmosphere>
    </ThemeProvider>
  );
};

const Demo: React.FC<{canvas: Canvas}> = ({canvas}) => <LiquidDemoView frame={useCurrentFrame()} canvas={canvas} />;
const Perf: React.FC<{canvas: Canvas; tier: GlassTierProp | 'none'}> = ({canvas, tier}) => <LiquidPerfView frame={useCurrentFrame()} canvas={canvas} tier={tier} />;

/** Registers Kit-Liquid-Demo (+ Vertical, 30fps) and the perf compositions (card, liquid, none = scene without glass). */
export const KitLiquidCompositions: React.FC = () => (
  <>
    {(
      [
        ['Kit-Liquid-Demo', CANVAS.landscape60],
        ['Kit-Liquid-Demo-Vertical', CANVAS.vertical60],
        ['Kit-Liquid-Demo-30fps', CANVAS.landscape30],
      ] as const
    ).map(([id, c]) => (
      <Composition key={id} id={id} component={Demo} durationInFrames={Math.round(DEMO_SECONDS * c.fps)} width={c.width} height={c.height} fps={c.fps} defaultProps={{canvas: c}} />
    ))}
    <Composition id="Kit-Liquid-Perf-Card" component={Perf} durationInFrames={120} width={CANVAS.landscape60.width} height={CANVAS.landscape60.height} fps={60} defaultProps={{canvas: CANVAS.landscape60, tier: 'card' as GlassTierProp}} />
    <Composition id="Kit-Liquid-Perf-None" component={Perf} durationInFrames={120} width={CANVAS.landscape60.width} height={CANVAS.landscape60.height} fps={60} defaultProps={{canvas: CANVAS.landscape60, tier: 'none' as const}} />
    <Composition id="Kit-Liquid-Perf-Liquid" component={Perf} durationInFrames={120} width={CANVAS.landscape60.width} height={CANVAS.landscape60.height} fps={60} defaultProps={{canvas: CANVAS.landscape60, tier: 'liquid' as GlassTierProp}} />
  </>
);
