import React, {useCallback, useEffect, useState} from 'react';
import {AbsoluteFill, Composition, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, rgba, textStyle, ThemeProvider, unit, useTheme, type Canvas, type ThemeName} from '../tokens';
import {Glass} from '../glass';
import {enter, SPRING} from '../motion';
import {NumberText} from '../text';
import {Region3D} from '../map/three';

const SECONDS = 3.5;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** Bundled Inter (woff2 in public/kit/fonts, from @fontsource/inter): the theme font stacks already list "Inter", so CI renders it instead of a system fallback. */
let interLoad: Promise<unknown> | null = null;
const loadInter = () => (interLoad ??= Promise.all([600, 700].map((w) => new FontFace('Inter', `url(${staticFile(`kit/fonts/inter-latin-${w}-normal.woff2`)}) format('woff2')`, {weight: String(w), style: 'normal'}).load().then((f) => document.fonts.add(f)))).catch((e) => console.warn('Inter failed to load', e)));
const useInter = () => {
  const [handle] = useState(() => delayRender('Inter font'));
  useEffect(() => { loadInter().finally(() => continueRender(handle)); }, [handle]);
};

const Scene: React.FC<{id: string; name: string}> = ({id, name}) => {
  useInter();
  const theme = useTheme();
  const frame = useCurrentFrame();
  const {width, height, fps} = theme.canvas;
  const t = frame / fps;
  const u = unit(theme);
  const portrait = height > width;
  const title = enter(t, 0.5, SPRING.SMOOTH, fps);
  const card = enter(t, 1.55, SPRING.SNAPPY, fps); // after the rise has settled
  const [anchor, setAnchor] = useState<{x: number; y: number} | null>(null);
  const onAnchor = useCallback((x: number, y: number) => setAnchor({x, y}), []);

  // card geometry from the reference: landscape ~17% of the width at ~31% of the height, right margin ~7.5%;
  // portrait ~35% of the width, centred, top at ~62% of the height
  const cardW = width * (portrait ? 0.35 : 0.17), cardH = cardW * 0.46;
  const s = cardW / 300; // inner content scale
  const cardLeft = portrait ? (width - cardW) / 2 : width - width * 0.075 - cardW;
  const cardTop = portrait ? height * 0.62 : height * 0.27;
  // leader target: landscape = left edge, mid-height; portrait = top edge, centre
  const tx = portrait ? cardLeft + cardW / 2 : cardLeft;
  const ty = portrait ? cardTop : cardTop + cardH / 2;

  // pin after the rise settles (~1.2 s), line draws just before the card and the count-up
  const pinIn = easeOut((t - 1.15) / 0.35);
  const lineIn = easeOut((t - 1.3) / 0.5);
  const pinR = 5 * u, ringR = 17 * u;
  let line: {x1: number; y1: number; x2: number; y2: number} | null = null;
  if (anchor) {
    const dx = tx - anchor.x, dy = ty - anchor.y, len = Math.hypot(dx, dy) || 1;
    const x1 = anchor.x + (dx / len) * ringR, y1 = anchor.y + (dy / len) * ringR;
    line = {x1, y1, x2: x1 + (tx - x1) * lineIn, y2: y1 + (ty - y1) * lineIn};
  }
  const lineColor = rgba(theme.colors.text.primary, 0.55);
  const pad = width * 0.05;
  return (
    <AbsoluteFill style={{background: theme.colors.background.base}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 38% 45%, ${rgba(theme.colors.background.lift, 0.55)} 0%, ${rgba(theme.colors.background.lift, 0)} 62%)`}} />
      <Region3D id={id} t={t} duration={SECONDS} onAnchor={onAnchor} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, ${rgba(theme.colors.background.deep, 0)} 55%, ${rgba(theme.colors.background.deep, 0.75)} 100%)`}} />
      {anchor && (
        <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          {line && lineIn > 0.001 && <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={lineColor} strokeWidth={Math.max(1.5, 2 * u)} strokeLinecap="round" />}
          <circle cx={anchor.x} cy={anchor.y} r={ringR * pinIn} fill={rgba(theme.colors.text.primary, 0.12)} stroke={rgba(theme.colors.text.primary, 0.3)} strokeWidth={Math.max(1, 1.5 * u)} opacity={pinIn} />
          <circle cx={anchor.x} cy={anchor.y} r={pinR * pinIn} fill={theme.colors.text.primary} opacity={pinIn} />
        </svg>
      )}
      <div style={{position: 'absolute', left: pad, right: portrait ? pad : undefined, top: portrait ? height * 0.17 : height * 0.12, textAlign: portrait ? 'center' : 'left', opacity: title.opacity, transform: `translateY(${title.y}px)`}}>
        <div style={{...textStyle(theme, 'caption', {color: 'accent'}), letterSpacing: '0.18em', textTransform: 'uppercase'}}>Region spotlight</div>
        <div style={{...textStyle(theme, 'title'), marginTop: 10 * u, fontSize: theme.type.title.size * u * 1.0}}>{name}</div>
      </div>
      <Glass tier="card" radius={22 * s} width={cardW} height={cardH} frame={frame} style={{position: 'absolute', left: cardLeft, top: cardTop, boxSizing: 'border-box', padding: `${20 * s}px ${24 * s}px`, opacity: card.opacity, transform: `translateY(${card.y}px) scale(${card.scale})`}}>
        <div style={textStyle(theme, 'caption', {color: 'secondary'})}>Sample index</div>
        <div style={{marginTop: 6 * s, display: 'flex', alignItems: 'baseline', gap: 4 * s}}>
          <NumberText to={42.5} frame={frame} start={1.75} duration={0.9} decimals={1} role="number" fontSize={46 * s} />
          <span style={{...textStyle(theme, 'caption', {color: 'accent'}), fontSize: 26 * s, fontWeight: 600}}>%</span>
        </div>
      </Glass>
    </AbsoluteFill>
  );
};

const SHAPES: {key: string; canvas: Canvas}[] = [{key: 'Landscape', canvas: CANVAS.landscape60}, {key: 'Portrait', canvas: CANVAS.vertical60}];

/** Kit-Region3D-<Landscape|Portrait> (props: theme, id, name): one extruded state rising out of faint neighbours, 3.5 s. three is only imported here. */
export const KitRegion3DCompositions: React.FC = () => (
  <>
    {SHAPES.map(({key, canvas}) => (
      <Composition
        key={key}
        id={`Kit-Region3D-${key}`}
        durationInFrames={Math.round(SECONDS * canvas.fps)}
        width={canvas.width}
        height={canvas.height}
        fps={canvas.fps}
        component={({theme, id, name}: {theme: ThemeName; id: string; name: string}) => (
          <ThemeProvider theme={createTheme({canvas}, theme)}>
            <Scene id={id} name={name} />
          </ThemeProvider>
        )}
        defaultProps={{theme: 'midnight' as ThemeName, id: '08', name: 'Colorado'}}
      />
    ))}
  </>
);
