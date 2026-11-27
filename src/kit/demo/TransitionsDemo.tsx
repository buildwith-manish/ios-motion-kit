import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Composition} from 'remotion';
import {CANVAS, createTheme, type Canvas, type Theme} from '../tokens';
import {MatchedElement, TransitionScene, type Rect, type TransitionKind} from '../transitions';

/** The six transitions in demo order. */
export const DEMO_KINDS: TransitionKind[] = ['push', 'blurDissolve', 'sheet', 'zoomThrough', 'matchedGeometry', 'wipeMask'];

/** Demo timing options (seconds). */
export type DemoTiming = {
  /** Seconds each scene is held between transitions. Default 1.2. */
  hold?: number;
  /** Seconds per transition. Default 1.0. */
  duration?: number;
};

const HUES = [212, 262, 330, 24, 160, 190, 48];

/** Start time (s) of transition `k` in the demo. */
export const demoStart = (k: number, t: DemoTiming = {}): number => (t.hold ?? 1.2) + k * ((t.hold ?? 1.2) + (t.duration ?? 1.0));

/** Total demo length in frames at `fps`. */
export const demoFrames = (fps: number, t: DemoTiming = {}): number =>
  Math.round((demoStart(DEMO_KINDS.length - 1, t) + (t.duration ?? 1.0) + (t.hold ?? 1.2)) * fps);

/**
 * Frame numbers for stills at 25 / 50 / 75% of every transition.
 * @example demoStills(60) // [{kind: 'push', pct: 25, frame: 90}, ...]
 */
export const demoStills = (fps: number, t: DemoTiming = {}): {kind: TransitionKind; pct: number; frame: number}[] =>
  DEMO_KINDS.flatMap((kind, k) => [25, 50, 75].map((pct) => ({kind, pct, frame: Math.round((demoStart(k, t) + ((t.duration ?? 1.0) * pct) / 100) * fps)})));

const heroRects = (w: number, h: number): [Rect, Rect] => {
  const m = Math.min(w, h);
  const aw = m * 0.3;
  const bw = m * 0.58;
  return [
    {x: w * 0.1, y: h * 0.14, width: aw, height: aw * 0.62, radius: 22},
    {x: (w - bw) / 2, y: h * 0.19, width: bw, height: bw * 0.62, radius: 56},
  ];
};

/** A labelled demo scene: gradient background, big "Scene N", optional matched hero card. */
export const DemoScene: React.FC<{index: number; theme: Theme}> = ({index, theme}) => {
  const {width: w, height: h} = theme.canvas;
  const m = Math.min(w, h);
  const hue = HUES[index % HUES.length];
  const [ra, rb] = heroRects(w, h);
  const hero = index === 4 ? ra : index === 5 ? rb : null;
  return (
    <div style={{position: 'absolute', inset: 0, background: `linear-gradient(145deg, hsl(${hue} 70% 34%), hsl(${(hue + 40) % 360} 75% 16%))`, color: theme.colors.text.primary, fontFamily: theme.fonts.body}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.62, textAlign: 'center', fontSize: m * 0.13, fontWeight: 700, letterSpacing: -2}}>Scene {index + 1}</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.62 + m * 0.17, textAlign: 'center', fontSize: m * 0.035, opacity: 0.7}}>{index === 6 ? 'last' : `of 7`}</div>
      {/* a few static shapes so motion/parallax is readable */}
      {[0, 1, 2, 3].map((n) => (
        <div key={n} style={{position: 'absolute', left: w * (0.12 + n * 0.22), top: h * (0.08 + (n % 2) * 0.05), width: m * 0.07, height: m * 0.07, borderRadius: '50%', background: `hsl(${hue + n * 20} 90% 70% / 0.5)`}} />
      ))}
      {hero && (
        <MatchedElement id="hero" rect={hero}>
          <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #FFD166, #EF476F)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1b1b1b', fontWeight: 800, fontSize: hero.height * 0.3}}>Hero</div>
        </MatchedElement>
      )}
    </div>
  );
};

/** Props for {@link TransitionsDemoFrame}. */
export type TransitionsDemoProps = DemoTiming & {
  theme: Theme;
  motionBlur?: boolean;
};

/**
 * Pure demo: cycles through all six transitions across seven labelled scenes, as a function of `frame`.
 * @example <TransitionsDemoFrame frame={90} theme={createTheme()} />
 */
export const TransitionsDemoFrame: React.FC<TransitionsDemoProps & {frame: number}> = ({frame, theme, hold, duration, motionBlur = true}) => {
  const dur = duration ?? 1.0;
  const {fps, width: cw, height: ch} = theme.canvas;
  const t = frame / fps;
  let k = -1;
  DEMO_KINDS.forEach((_, i) => {
    if (t >= demoStart(i, {hold, duration})) k = i;
  });
  const inWindow = k >= 0 && t < demoStart(k, {hold, duration}) + dur;
  const kind = DEMO_KINDS[Math.max(0, k)];
  const m = Math.min(cw, ch);
  const label = inWindow ? `${k + 1}/6  ${kind}  (Scene ${k + 1} → ${k + 2})` : `Scene ${k + 2}`;
  return (
    <div style={{position: 'absolute', inset: 0, background: theme.colors.background.deep}}>
      {inWindow || k < 0 ? (
        <TransitionScene
          frame={frame}
          theme={theme}
          kind={kind}
          start={demoStart(Math.max(0, k), {hold, duration})}
          duration={dur}
          outgoing={<DemoScene index={Math.max(0, k)} theme={theme} />}
          incoming={<DemoScene index={Math.max(0, k) + 1} theme={theme} />}
          motionBlur={motionBlur}
        />
      ) : (
        <DemoScene index={k + 1} theme={theme} />
      )}
      <div style={{position: 'absolute', left: m * 0.04, top: m * 0.04, padding: `${m * 0.01}px ${m * 0.02}px`, borderRadius: m * 0.03, background: 'rgba(0,0,0,0.55)', color: '#fff', fontFamily: theme.fonts.body, fontSize: m * 0.03, zIndex: 100}}>
        {label}
      </div>
    </div>
  );
};

/**
 * Remotion composition body: reads the frame once (thin wrapper) and passes it to the pure demo.
 * @example <Composition id="Kit-Transitions-Demo" component={TransitionsDemo} ... />
 */
export const TransitionsDemo: React.FC<TransitionsDemoProps> = (props) => <TransitionsDemoFrame frame={useCurrentFrame()} {...props} />;

const CANVASES: {id: string; canvas: Canvas}[] = [
  {id: 'Kit-Transitions-Demo', canvas: CANVAS.landscape60},
  {id: 'Kit-Transitions-Demo-Vertical', canvas: CANVAS.vertical60},
  {id: 'Kit-Transitions-Demo-30fps', canvas: CANVAS.landscape30},
];

/**
 * Registers the three transition demo compositions (16:9 @ 60, 9:16 @ 60, 16:9 @ 30).
 * @example <KitTransitionsCompositions />
 */
export const KitTransitionsCompositions: React.FC = () => (
  <>
    {CANVASES.map(({id, canvas}) => (
      <Composition key={id} id={id} component={TransitionsDemo} durationInFrames={demoFrames(canvas.fps)} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{theme: createTheme({canvas})}} />
    ))}
  </>
);
