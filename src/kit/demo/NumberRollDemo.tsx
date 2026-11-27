import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, safeRect, space, ThemeProvider, unit, type Theme} from '../index';
import {motionBlurSamples} from '../qa';
import {NumberText} from '../text';

/** Seconds each case is on screen; its roll runs from 0.3 s to 1.5 s inside that slot. */
export const NUMBER_ROLL_SLOT = 2;

/** One roll per slot, named after the value it lands on. `$0` and `0.0%` roll down to zero. */
export const NUMBER_ROLL_CASES = [
  {name: '0-usd', from: 1250, to: 0, prefix: '$', suffix: '', decimals: 0},
  {name: '316-usd', from: 0, to: 316, prefix: '$', suffix: '', decimals: 0},
  {name: '2168-usd', from: 0, to: 2168, prefix: '$', suffix: '', decimals: 0},
  {name: '93k-usd', from: 0, to: 93, prefix: '$', suffix: 'K', decimals: 0},
  {name: '0.0-pct', from: 41.5, to: 0, prefix: '', suffix: '%', decimals: 1},
];

export interface NumberRollDemoProps {
  theme?: Theme;
  /** Set by scripts/kit_render.mjs from the render profile. */
  kitRender?: {motionBlurSamples?: number};
}

export const NumberRollDemo: React.FC<NumberRollDemoProps> = (props) => {
  const frame = useCurrentFrame();
  const theme = props.theme ?? createTheme();
  const fps = theme.canvas.fps;
  // One sample (the draft profile) means no motion blur.
  const blur = motionBlurSamples(props, 8) > 1;
  const index = Math.min(NUMBER_ROLL_CASES.length - 1, Math.floor(frame / (NUMBER_ROLL_SLOT * fps)));
  const c = NUMBER_ROLL_CASES[index];
  const local = frame - index * NUMBER_ROLL_SLOT * fps;
  const safe = safeRect(theme, 'title');
  const bg = theme.colors.background;
  const label: React.CSSProperties = {fontFamily: theme.fonts.body, fontSize: 30 * unit(theme), fontWeight: theme.weights.bold, color: theme.colors.text.tertiary};

  return (
    <div style={{position: 'relative', width: theme.canvas.width, height: theme.canvas.height, overflow: 'hidden', background: `linear-gradient(160deg, ${bg.lift}, ${bg.base} 55%, ${bg.deep})`}}>
      <ThemeProvider theme={theme}>
        <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: space(theme, 10)}}>
          {(['collapse', 'reserve'] as const).map((layout) => (
            <div key={`${c.name}-${layout}`}>
              <div style={label}>{layout}</div>
              <NumberText from={c.from} to={c.to} prefix={c.prefix} suffix={c.suffix} decimals={c.decimals} layout={layout} motionBlur={blur} frame={local} start={0.3} duration={1.2} role="number" fontSize={200 * unit(theme)} />
            </div>
          ))}
        </div>
      </ThemeProvider>
    </div>
  );
};

export const KitNumberRollCompositions: React.FC = () => (
  <Composition id="Kit-NumberRoll-Demo" component={NumberRollDemo} durationInFrames={NUMBER_ROLL_CASES.length * NUMBER_ROLL_SLOT * 60} width={CANVAS.landscape60.width} height={CANVAS.landscape60.height} fps={60} defaultProps={{theme: createTheme({canvas: CANVAS.landscape60})}} />
);
