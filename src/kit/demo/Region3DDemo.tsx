import React from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, rgba, textStyle, ThemeProvider, unit, useTheme, type Canvas, type ThemeName} from '../tokens';
import {Glass} from '../glass';
import {enter, SPRING} from '../motion';
import {NumberText} from '../text';
import {Region3D} from '../map/three';

const SECONDS = 3.5;

const Scene: React.FC<{id: string; name: string}> = ({id, name}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const {width, height, fps} = theme.canvas;
  const t = frame / fps;
  const u = unit(theme);
  const portrait = height > width;
  const title = enter(t, 0.5, SPRING.SMOOTH, fps);
  const card = enter(t, 1.55, SPRING.SNAPPY, fps); // after the rise has settled
  const cardW = 300 * u, cardH = 132 * u;
  const pad = 96 * u;
  return (
    <AbsoluteFill style={{background: theme.colors.background.base}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 38% 45%, ${rgba(theme.colors.background.lift, 0.55)} 0%, ${rgba(theme.colors.background.lift, 0)} 62%)`}} />
      <Region3D id={id} t={t} duration={SECONDS} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, ${rgba(theme.colors.background.deep, 0)} 55%, ${rgba(theme.colors.background.deep, 0.75)} 100%)`}} />
      <div style={{position: 'absolute', left: pad, right: portrait ? pad : undefined, top: pad * (portrait ? 1.5 : 0.8), textAlign: portrait ? 'center' : 'left', opacity: title.opacity, transform: `translateY(${title.y}px)`}}>
        <div style={{...textStyle(theme, 'caption', {color: 'accent'}), letterSpacing: '0.18em', textTransform: 'uppercase'}}>Region spotlight</div>
        <div style={{...textStyle(theme, 'title'), marginTop: 10 * u, fontSize: theme.type.title.size * u * 1.15}}>{name}</div>
      </div>
      <Glass tier="card" radius={22 * u} width={cardW} height={cardH} frame={frame} style={{position: 'absolute', left: portrait ? (width - cardW) / 2 : undefined, right: portrait ? undefined : pad * 1.2, top: portrait ? height * 0.74 : height * 0.5 - cardH / 2, boxSizing: 'border-box', padding: `${20 * u}px ${24 * u}px`, opacity: card.opacity, transform: `translateY(${card.y}px) scale(${card.scale})`}}>
        <div style={textStyle(theme, 'caption', {color: 'secondary'})}>Sample index</div>
        <div style={{marginTop: 6 * u}}>
          <NumberText to={42.5} frame={frame} start={1.75} duration={0.9} decimals={1} suffix="%" role="number" fontSize={46 * u} />
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
