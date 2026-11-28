import React from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {CueTrack} from '../audio/CueTrack';
import {RevealText} from '../text/RevealText';
import {NumberText} from '../text/NumberText';
import {CANVAS, createTheme, safeRect, type Canvas, type Theme} from '../tokens';
import {TIMING_DEMO_RESULT, TIMING_DEMO_WORDS, timingDemoWordStart} from './demoData';

export const TIMING_DEMO_SECONDS = 12;

const TimingDemo: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = theme.canvas;
  const safe = safeRect(theme, 'title');
  const portrait = height > width;
  const scale = Math.min(width, height) / 1080;
  const rentStart = timingDemoWordStart('rent');
  const totalStart = timingDemoWordStart('total');
  const textTop = safe.top + safe.height * 0.15;
  const textHeight = safe.height * (portrait ? 0.31 : 0.34);
  const numberTop = safe.top + safe.height * (portrait ? 0.51 : 0.53);
  const timelineTop = safe.top + safe.height * (portrait ? 0.76 : 0.78);

  return (
    <AbsoluteFill style={{background: theme.colors.background.deep, color: theme.colors.text.primary, fontFamily: theme.fonts.body}}>
      <div style={{position: 'absolute', left: safe.left, top: safe.top, color: theme.colors.text.primary, fontFamily: theme.fonts.display, fontSize: 30 * scale, fontWeight: 700}}>
        WORD TIMING · CUES · SCENE STARTS
      </div>
      <div style={{position: 'absolute', left: safe.left, top: safe.top + 42 * scale, color: theme.colors.text.secondary, fontSize: 17 * scale}}>
        40-word sample · JSON → word spans · audio linked to number-roll motion
      </div>
      <div style={{position: 'absolute', left: safe.left, top: textTop, width: safe.width, height: textHeight, overflow: 'hidden'}}>
        <RevealText
          timings={TIMING_DEMO_WORDS}
          frame={frame}
          fps={fps}
          theme={theme}
          role="title"
          fontSize={portrait ? 42 * scale : 48 * scale}
          maxWidth={safe.width}
          maxLines={6}
          mode="words"
          appear="timings"
          highlightActive
          keepSpoken
          inactiveOpacity={0.45}
          style={{lineHeight: 1.28}}
        />
      </div>
      <div style={{position: 'absolute', left: safe.left, top: numberTop, width: safe.width, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 * scale}}>
        <div>
          <div style={{color: theme.colors.text.secondary, fontSize: 17 * scale}}>RENT → MONTHLY TOTAL</div>
          <NumberText
            prefix="$"
            from={0}
            to={2000}
            then={[{at: totalStart, to: 3250, duration: 0.85}]}
            frame={frame}
            fps={fps}
            start={rentStart}
            duration={0.85}
            fontSize={portrait ? 92 * scale : 116 * scale}
            theme={theme}
          />
        </div>
        <div style={{color: theme.colors.text.tertiary, fontSize: 15 * scale, textAlign: 'right'}}>
          <div>same transcript</div>
          <div>text · cues · scenes</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: safe.left, top: timelineTop, width: safe.width}}>
        <div style={{color: theme.colors.text.secondary, fontSize: 16 * scale, fontWeight: 700, marginBottom: 12 * scale}}>SCENE STARTS</div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 12 * scale}}>
          {TIMING_DEMO_RESULT.scenes.map((scene) => (
            <div key={scene.id} style={{padding: `${8 * scale}px ${12 * scale}px`, borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.accent}88`, background: `color-mix(in srgb, ${theme.colors.accent} 12%, transparent)`, fontSize: 16 * scale}}>
              {scene.id} · {scene.start.toFixed(2)}s
            </div>
          ))}
        </div>
      </div>
      <CueTrack cues={TIMING_DEMO_RESULT.cues} fps={fps} seed={17} />
    </AbsoluteFill>
  );
};

const TimingDemoComposition: React.FC<{canvas: Canvas}> = ({canvas}) => {
  return <TimingDemo theme={createTheme({canvas})} />;
};

export const KitTimingCompositions: React.FC = () => (
  <>
    {(
      [
        ['Kit-Timing-Demo', CANVAS.landscape60],
        ['Kit-Timing-Demo-Vertical', CANVAS.vertical60],
        ['Kit-Timing-Demo-30fps', CANVAS.landscape30],
      ] as const
    ).map(([id, canvas]) => (
      <Composition key={id} id={id} component={TimingDemoComposition} defaultProps={{canvas}} durationInFrames={TIMING_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} />
    ))}
  </>
);
