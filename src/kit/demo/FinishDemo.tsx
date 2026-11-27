import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {ChromaSplit, Finish, type FinishLevel} from '../finish';
import {CANVAS, createTheme, safeRect, space, textStyle, ThemeProvider, unit} from '../tokens';
import {rgba} from '../tokens/color';
import {safeText} from '../tokens/contrast';
import type {Canvas, Theme} from '../tokens/types';

interface FinishDemoProps extends Record<string, unknown> {
  canvas: Canvas;
  level?: FinishLevel;
  chromaSplit?: boolean;
  kitRender?: {profile?: string};
}

const ArtPanel: React.FC<{theme: Theme; label: string; frame: number}> = ({theme, label, frame}) => {
  const u = unit(theme);
  const glowX = 48 + Math.sin((frame / theme.canvas.fps) * 2.4) * 13;
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      borderRadius: theme.radius.xl * u,
      background: `radial-gradient(48% 65% at ${glowX}% 44%, ${theme.colors.tint.a} 0%, transparent 100%), linear-gradient(145deg, ${theme.colors.background.lift}, ${theme.colors.background.deep})`,
      border: `1px solid ${theme.colors.text.tertiary}55`,
    }}>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: space(theme, 8), boxSizing: 'border-box'}}>
        <div style={{...textStyle(theme, 'caption', {weight: 'bold'}), color: safeText(theme, 'primary', 'canvas'), letterSpacing: '0.12em'}}>{label}</div>
        <div style={{alignSelf: 'flex-start', padding: space(theme, 3), borderRadius: theme.radius.md * u, background: rgba(theme.colors.background.deep, 0.84)}}>
          <div style={{...textStyle(theme, 'title'), color: safeText(theme, 'primary', 'canvas'), marginBottom: space(theme, 2)}}>Light, held in frame</div>
          <div style={{...textStyle(theme, 'body'), color: safeText(theme, 'secondary', 'canvas')}}>A quiet finish for the important moment.</div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: space(theme, 2)}}>
          {[0.32, 0.54, 0.76, 0.44, 0.68, 0.92, 0.62].map((height, i) => (
            <div key={i} style={{width: 18 * u, height: 66 * height * u, borderRadius: theme.radius.xs * u, background: i === 5 ? theme.colors.accent : theme.colors.tint.b, opacity: 0.78}} />
          ))}
        </div>
      </div>
    </div>
  );
};

const FinishDemoFrame: React.FC<FinishDemoProps & {frame: number}> = ({frame, canvas, level = 'full', chromaSplit = true, kitRender}) => {
  const theme = createTheme({canvas});
  const safe = safeRect(theme, 'title');
  const u = unit(theme);
  const gap = space(theme, 6);
  const panelWidth = (safe.width - gap) / 2;
  const panelHeight = Math.min(safe.height * 0.64, 620 * u);
  const content = (label: string) => <ArtPanel theme={theme} label={label} frame={frame} />;
  const after = (
    <Finish level={level} finalOnly kitRender={kitRender}>
      {content('AFTER · FILM FINISH')}
    </Finish>
  );

  return (
    <ThemeProvider theme={theme}>
      <div style={{position: 'absolute', inset: 0, background: theme.colors.background.deep}}>
        <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: space(theme, 5)}}>
          <div style={{...textStyle(theme, 'caption', {weight: 'bold'}), color: safeText(theme, 'primary', 'canvas'), letterSpacing: '0.16em'}}>A FRAME, FINISHED</div>
          <div style={{display: 'flex', gap, width: '100%', height: panelHeight}}>
            <div style={{width: panelWidth, height: '100%'}}>
              <Finish level="off">{content('BEFORE')}</Finish>
            </div>
            <div style={{width: panelWidth, height: '100%'}}>
              {chromaSplit ? (
                <ChromaSplit frame={frame} fps={canvas.fps} eventTime={0.45} amount={3}>
                  {after}
                </ChromaSplit>
              ) : after}
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

const CompositionFrame: React.FC<FinishDemoProps> = (props) => <FinishDemoFrame frame={useCurrentFrame()} {...props} />;

export const KitFinishCompositions: React.FC = () => (
  <>
    <Composition id="Kit-Finish-Demo" component={CompositionFrame} durationInFrames={180} width={CANVAS.landscape60.width} height={CANVAS.landscape60.height} fps={60} defaultProps={{canvas: CANVAS.landscape60}} />
    <Composition id="Kit-Finish-Demo-Vertical" component={CompositionFrame} durationInFrames={90} width={CANVAS.vertical60.width} height={CANVAS.vertical60.height} fps={60} defaultProps={{canvas: CANVAS.vertical60}} />
    <Composition id="Kit-Finish-Demo-30fps" component={CompositionFrame} durationInFrames={90} width={CANVAS.landscape30.width} height={CANVAS.landscape30.height} fps={30} defaultProps={{canvas: CANVAS.landscape30}} />
  </>
);
