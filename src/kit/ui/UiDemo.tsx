import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {Atmosphere} from '../background';
import {NumberText} from '../text';
import {CANVAS, createTheme, safeRect, space, textStyle, ThemeProvider, unit} from '../tokens';
import type {Canvas, Theme} from '../tokens/types';
import {AlertCard, Badge, Button, Chip, ListGroup, Pill, Segmented, Sheet, Toggle, Tooltip, Widget} from './components';

export const UI_DEMO_SECONDS = 10;

const Sparkline: React.FC<{theme: Theme}> = ({theme}) => {
  const u = unit(theme);
  return (
    <svg width={92 * u} height={38 * u} viewBox="0 0 92 38" aria-hidden>
      <path d="M2 30 C14 28 16 15 28 19 S43 31 54 16 S72 20 90 4" fill="none" stroke={theme.colors.accent} strokeWidth={2.5 * u} strokeLinecap="round" />
      <circle cx="90" cy="4" r={3 * u} fill={theme.colors.accent} />
    </svg>
  );
};

const UiDashboard: React.FC<{frame: number; theme: Theme}> = ({frame, theme}) => {
  const safe = safeRect(theme, 'title');
  const u = unit(theme);
  const landscape = theme.canvas.width > theme.canvas.height;
  const response = theme.motion.spring.SMOOTH;
  const start = 0.3;

  return (
    <ThemeProvider theme={theme}>
      <Atmosphere frame={frame} preset="midnight-aurora" quiet theme={theme}>
        <div style={{position: 'absolute', inset: 0}}>
          <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, display: 'flex', flexDirection: 'column', gap: space(theme, 4), boxSizing: 'border-box'}}>
            <div
              data-qa-ignore={frame / theme.canvas.fps >= 7 && frame / theme.canvas.fps < 9.1 ? 'dimmed-background' : undefined}
              style={{display: 'flex', flexDirection: 'column', gap: space(theme, 4)}}
            >
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space(theme, 4), flexWrap: 'wrap'}}>
                <div>
                  <div style={{...textStyle(theme, 'title', {weight: 'bold'}), fontSize: 34 * u}}>Monthly overview</div>
                  <div style={textStyle(theme, 'caption', {color: 'secondary'})}>A clear view of the household budget</div>
                </div>
                <Pill frame={frame} start={start} expandAt={2.2} response={response} label="Budget" expandedContent="Household plan" compactWidth={148} expandedWidth={320} />
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: space(theme, 3), flexWrap: 'wrap'}}>
                <Chip frame={frame} start={start + 0.15} icon="wallet" label="Monthly" />
                <Badge frame={frame} start={start + 0.25} tone="positive" label="On track" />
                <Segmented
                  frame={frame}
                  start={start + 0.35}
                  response={response}
                  segments={[{id: 'week', label: 'Week'}, {id: 'month', label: 'Month'}, {id: 'year', label: 'Year'}]}
                  fromSelected="week"
                  selected="month"
                  selectionAt={3.1}
                  style={{minWidth: 250 * u}}
                />
                <Button frame={frame} start={start + 0.45} pressAt={4.25} label="Review" icon="arrow-right" />
                <Tooltip frame={frame} start={3.5} end={5.4} label="Press to explore" placement="top" />
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: space(theme, 4)}}>
                <Widget frame={frame} start={start + 0.55} label="Monthly rent" value={<NumberText frame={frame} theme={theme} prefix="$" from={0} to={2000} start={1.2} duration={0.75} fontSize={48 * u} />} delta={<span>+2.4% this month</span>} sparkline={<Sparkline theme={theme} />} />
                <Widget frame={frame} start={start + 0.7} label="Available after bills" value={<NumberText frame={frame} theme={theme} prefix="$" from={0} to={840} start={1.8} duration={0.75} fontSize={48 * u} />} delta={<span>steady vs. last month</span>} />
              </div>
              <div style={{display: 'grid', gridTemplateColumns: landscape ? '1.2fr 0.8fr' : '1fr', gap: space(theme, 4), alignItems: 'start'}}>
                <ListGroup
                  frame={frame}
                  start={start + 0.85}
                  rows={[
                    {id: 'housing', icon: 'wallet', label: 'Housing', value: '$2,000'},
                    {id: 'transport', icon: 'arrow-right', label: 'Transport', value: '$430'},
                    {id: 'family', icon: 'users', label: 'Family care', value: '$620'},
                  ]}
                />
                <div style={{display: 'flex', flexDirection: 'column', gap: space(theme, 3)}}>
                  <AlertCard frame={frame} start={start + 1} icon="shield" tone="positive" title="Plan looks balanced" body="Your monthly essentials stay within the target range." />
                  <Toggle frame={frame} start={start + 1.1} changedAt={5.2} checked label="Auto-save" />
                </div>
              </div>
            </div>
          </div>
          <Sheet frame={frame} start={7} end={9.1} title="Quick summary" height={360}>
            <div style={{...textStyle(theme, 'body', {color: 'secondary'}), lineHeight: 1.45}}>Three planned expenses are on track. The next update is ready when you are.</div>
          </Sheet>
        </div>
      </Atmosphere>
    </ThemeProvider>
  );
};

const UiDemoComposition: React.FC<{canvas: Canvas}> = ({canvas}) => {
  const frame = useCurrentFrame();
  return <UiDashboard frame={frame} theme={createTheme({canvas})} />;
};

export const KitUiCompositions: React.FC = () => (
  <>
    {(
      [
        ['Kit-Ui-Demo', CANVAS.landscape60],
        ['Kit-Ui-Demo-Vertical', CANVAS.vertical60],
        ['Kit-Ui-Demo-30fps', CANVAS.landscape30],
      ] as const
    ).map(([id, canvas]) => (
      <Composition key={id} id={id} component={UiDemoComposition} defaultProps={{canvas}} durationInFrames={UI_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} />
    ))}
  </>
);
