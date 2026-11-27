import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {Atmosphere, type AtmospherePreset, focusPoints} from '../background';
import {Glass} from '../glass';
import {NumberText} from '../text';
import {CANVAS, createTheme, safeRect, space, textStyle, ThemeProvider, unit} from '../tokens';
import {safeText} from '../tokens/contrast';
import type {Theme, ThemeName} from '../tokens';
import type {Canvas} from '../tokens/types';

const PRESETS: AtmospherePreset[] = ['midnight-aurora', 'graphite', 'soft-light', 'deep-ocean'];
const THEMES: ThemeName[] = ['midnight', 'light', 'mono'];
const SLOT_SECONDS = 2;
const DEMO_SECONDS = PRESETS.length * THEMES.length * SLOT_SECONDS;

interface AtmosphereDemoProps {
  theme: Theme;
}

const AtmosphereDemoFrame: React.FC<AtmosphereDemoProps & {frame: number}> = ({frame, theme: baseTheme}) => {
  const {fps, width, height} = baseTheme.canvas;
  const slot = Math.min(PRESETS.length * THEMES.length - 1, Math.floor(frame / (SLOT_SECONDS * fps)));
  const themeName = THEMES[Math.floor(slot / PRESETS.length)];
  const preset = PRESETS[slot % PRESETS.length];
  const theme = createTheme({canvas: baseTheme.canvas}, themeName);
  const localFrame = frame - slot * SLOT_SECONDS * fps;
  const safe = safeRect(theme, 'title');
  const portrait = height > width;
  const u = unit(theme);
  const cardWidth = Math.min(safe.width * (portrait ? 0.96 : 0.68), 900 * u);
  const cardHeight = portrait ? 430 * u : 390 * u;
  const cardX = (width - cardWidth) / 2;
  const cardY = (height - cardHeight) / 2;
  // Key-light beats within THIS slot (absolute frame time), so the light springs to the number, then the pill,
  // then back — continuously, not once across the whole 24 s demo.
  const slotAt = slot * SLOT_SECONDS;
  const beats = focusPoints([
    {x: cardX, y: cardY, width: cardWidth, height: cardHeight * 0.6},
    {x: cardX + cardWidth * 0.5, y: cardY + cardHeight, width: cardWidth * 0.1, height: 1},
  ], theme.canvas, {start: slotAt, duration: SLOT_SECONDS * 0.9});
  // The number rolls once per slot (and the roll restarts per slot, so every preset shows a mid-roll moment).
  const rollFrom = [0, 2468, 135, 7][slot % 4];
  const rollTo = [3168, 4210, 246, 12][slot % 4];

  return (
    <ThemeProvider theme={theme}>
      <Atmosphere frame={frame} preset={preset} beats={beats} theme={theme} intensity={1}>
        <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: space(theme, 5)}}>
          <div style={{...textStyle(theme, 'caption', {weight: 'bold'}), color: safeText(theme, 'primary', 'canvas'), textTransform: 'uppercase'}}>
            {preset} · {themeName}
          </div>
          <Glass
            tier="card"
            width={cardWidth}
            height={cardHeight}
            style={{boxSizing: 'border-box', padding: space(theme, 8), display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: space(theme, 4)}}
          >
            <div style={{...textStyle(theme, 'title'), color: safeText(theme, 'primary', 'card')}}>A little more depth</div>
            <div style={{...textStyle(theme, 'body'), color: safeText(theme, 'secondary', 'card')}}>Atmosphere stays behind the story.</div>
            <NumberText
              frame={localFrame}
              from={rollFrom}
              to={rollTo}
              duration={1.1}
              layout="reserve"
              prefix="$"
              role="number"
              color={safeText(theme, 'primary', 'card')}
              fontSize={104 * u}
            />
          </Glass>
          <Glass tier="pill" style={{padding: `${space(theme, 3)}px ${space(theme, 6)}px`, borderRadius: theme.radius.pill}}>
            <span style={textStyle(theme, 'caption', {color: safeText(theme, 'primary', 'pill')})}>Quiet colour, clear type</span>
          </Glass>
        </div>
      </Atmosphere>
    </ThemeProvider>
  );
};

const landscapeTheme = createTheme({canvas: CANVAS.landscape60});
const verticalTheme = createTheme({canvas: CANVAS.vertical60});
const landscape30Theme = createTheme({canvas: CANVAS.landscape30});

const CompositionFrame: React.FC<{canvas: Canvas}> = ({canvas}) => {
  const frame = useCurrentFrame();
  return <AtmosphereDemoFrame frame={frame} theme={createTheme({canvas})} />;
};

export const KitAtmosphereCompositions: React.FC = () => (
  <>
    <Composition id="Kit-Atmosphere-Demo" component={CompositionFrame} durationInFrames={DEMO_SECONDS * 60} width={landscapeTheme.canvas.width} height={landscapeTheme.canvas.height} fps={60} defaultProps={{canvas: landscapeTheme.canvas}} />
    <Composition id="Kit-Atmosphere-Demo-Vertical" component={CompositionFrame} durationInFrames={DEMO_SECONDS * 60} width={verticalTheme.canvas.width} height={verticalTheme.canvas.height} fps={60} defaultProps={{canvas: verticalTheme.canvas}} />
    <Composition id="Kit-Atmosphere-Demo-30fps" component={CompositionFrame} durationInFrames={DEMO_SECONDS * 30} width={landscape30Theme.canvas.width} height={landscape30Theme.canvas.height} fps={30} defaultProps={{canvas: landscape30Theme.canvas}} />
  </>
);
