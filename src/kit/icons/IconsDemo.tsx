import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, safeRect, type Canvas, type Theme} from '../tokens';
import {iosSpring, SPRING} from '../motion';
import {Icon} from './Icon';
import {ICON_NAMES} from './generated';

export const ICONS_DEMO_SECONDS = 6;

const DEMO_THEMES = [
  {name: 'midnight', themeName: 'midnight' as const},
  {name: 'light', themeName: 'light' as const},
  {name: 'mono', themeName: 'mono' as const},
];

const IconGrid: React.FC<{theme: Theme; frame: number; height: number}> = ({theme, frame, height}) => {
  const {fps} = theme.canvas;
  const cellH = height / 8;
  const iconSize = Math.min(32, cellH * 0.46);
  const labelSize = Math.min(13, cellH * 0.19);
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gridTemplateRows: 'repeat(8, minmax(0, 1fr))', height, gap: 2, minHeight: 0}}>
      {ICON_NAMES.map((name, index) => {
        const start = 0.3 + index * 0.032;
        const drawOn = Math.min(1, iosSpring(frame / fps - start, SPRING.SNAPPY));
        return (
          <div key={name} style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 0, overflow: 'hidden', borderRadius: theme.radius.sm, background: `color-mix(in srgb, ${theme.colors.accent} 12%, transparent)`}}>
            <Icon name={name} size={iconSize} tone="accent" drawOn={drawOn} theme={theme} label={name} />
            <span style={{display: 'block', width: '100%', color: theme.colors.text.primary, fontFamily: theme.fonts.body, fontSize: labelSize, lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{name}</span>
          </div>
        );
      })}
    </div>
  );
};

const ThemePanel: React.FC<{theme: Theme; name: string; frame: number; height: number}> = ({theme, name, frame, height}) => {
  const titleH = Math.min(32, height * 0.075);
  return (
    <section style={{display: 'flex', flexDirection: 'column', height, minWidth: 0, padding: 6, boxSizing: 'border-box', borderRadius: theme.radius.md, background: theme.colors.background.base, border: `1px solid ${theme.colors.accent}44`}}>
      <header style={{height: titleH, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4, color: theme.colors.text.primary, fontFamily: theme.fonts.body, fontSize: Math.min(19, titleH * 0.7), fontWeight: 700}}>
        <Icon name="circle-check" size={Math.min(18, titleH * 0.64)} theme={theme} />
        {name} · {ICON_NAMES.length} icons
      </header>
      <IconGrid theme={theme} frame={frame} height={height - titleH - 12} />
    </section>
  );
};

export const IconsDemoFrame: React.FC<{frame: number; theme: Theme}> = ({frame, theme}) => {
  const safe = safeRect(theme, 'title');
  const portrait = theme.canvas.height > theme.canvas.width;
  const unit = Math.min(theme.canvas.width, theme.canvas.height) / 1080;
  const titleH = 38 * unit;
  const gap = 8 * unit;
  const availableH = safe.height - titleH - gap;
  const themes = DEMO_THEMES.map(({name, themeName}) => ({name, theme: createTheme({canvas: theme.canvas}, themeName)}));
  const panelStyle: React.CSSProperties = portrait
    ? {display: 'flex', flexDirection: 'column', gap, height: availableH}
    : {display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap, height: availableH};
  const panelH = portrait ? (availableH - gap * 2) / 3 : availableH;
  return (
    <div style={{position: 'absolute', inset: 0, background: theme.colors.background.deep}}>
      <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, display: 'flex', flexDirection: 'column', gap}}>
        <div style={{height: titleH, flex: '0 0 auto', color: theme.colors.text.primary, fontFamily: theme.fonts.display, fontSize: 24 * unit, fontWeight: 700}}>LINE ICONS · TOKEN THEMES · DRAW-ON</div>
        <div style={panelStyle}>
          {themes.map(({name, theme: panelTheme}) => <ThemePanel key={name} theme={panelTheme} name={name} frame={frame} height={panelH} />)}
        </div>
      </div>
    </div>
  );
};

const IconsDemo: React.FC<{theme: Theme}> = ({theme}) => <IconsDemoFrame frame={useCurrentFrame()} theme={theme} />;

const VARIANTS: {id: string; canvas: Canvas}[] = [
  {id: 'Kit-Icons-Demo', canvas: CANVAS.landscape60},
  {id: 'Kit-Icons-Demo-Vertical', canvas: CANVAS.vertical60},
  {id: 'Kit-Icons-Demo-30fps', canvas: CANVAS.landscape30},
];

export const KitIconsCompositions: React.FC = () => (
  <>
    {VARIANTS.map(({id, canvas}) => (
      <Composition key={id} id={id} component={IconsDemo} durationInFrames={ICONS_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{theme: createTheme({canvas})}} />
    ))}
  </>
);
