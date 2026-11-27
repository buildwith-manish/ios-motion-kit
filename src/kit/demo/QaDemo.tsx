import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, safeRect, unit, type Canvas, type Theme} from '../tokens';
import {QA_FIXTURE, qaMotionTime} from '../qa';

/**
 * Props for {@link QaDemoFrame}.
 * @example const clean: QaDemoProps = {faults: false};
 */
export interface QaDemoProps {
  /** Theme (default: createTheme() = midnight at 1920x1080@60). The QA scripts read it for the title-safe area. */
  theme?: Theme;
  /** true (default) plants the known faults; false is the clean variant every check must pass. */
  faults?: boolean;
}

/**
 * Test card for the QA scripts: continuous motion with two holds, safe-area faults and contrast faults at known
 * places (see QA_FIXTURE), plus traps that must not be flagged (clipped text, ignored decoration).
 * @example <QaDemoFrame frame={90} theme={createTheme()} faults={false} />
 */
export const QaDemoFrame: React.FC<QaDemoProps & {frame: number}> = ({frame, theme: themeProp, faults = true}) => {
  const theme = themeProp ?? createTheme();
  const {width, height, fps} = theme.canvas;
  const u = unit(theme);
  const safe = safeRect(theme, 'title');
  const t = frame / fps;
  const m = qaMotionTime(t, faults);
  const size = 110 * u;
  // Triangle wave, 520 design px/s, always inside the safe area.
  const travel = safe.width - size;
  const phase = (m * 520 * u) % (2 * travel);
  const x = safe.left + (phase <= travel ? phase : 2 * travel - phase);
  const text = (px: number, color = theme.colors.text.primary): React.CSSProperties => ({fontFamily: theme.fonts.body, fontWeight: theme.weights.bold, fontSize: px * u, lineHeight: 1.25, color, whiteSpace: 'nowrap'});
  const abs = (left: number, top: number): React.CSSProperties => ({position: 'absolute', left, top});

  return (
    <div style={{position: 'relative', width, height, overflow: 'hidden', background: theme.colors.background.base}}>
      <div style={{...abs(safe.left + 20 * u, safe.top + 20 * u), ...text(64)}}>QA test card</div>
      <div style={{...abs(safe.left + 20 * u, safe.top + 120 * u), ...text(34, theme.colors.text.secondary)}}>Readable body copy</div>

      {/* Contrast fault 1: colour barely above the page colour. */}
      <div style={{...abs(safe.left + 20 * u, safe.top + 200 * u), ...text(34, faults ? '#3A5578' : theme.colors.text.primary)}}>Dim footnote text</div>

      {/* Contrast fault 2: the declared colour is fine on the page, but not on what is actually behind it. */}
      <div style={{...abs(safe.left + 20 * u, safe.top + 290 * u), padding: `${18 * u}px ${24 * u}px`, borderRadius: 18 * u, background: faults ? '#C9D6E8' : '#10233F'}}>
        <div style={text(34, '#FFFFFF')}>White on a pale card</div>
      </div>

      {/* Safe-area faults: a text and a tagged element hugging the canvas edge. */}
      <div style={{...abs(faults ? 6 * u : safe.left + 20 * u, safe.top + 430 * u), ...text(30)}}>EDGE LABEL</div>
      <div data-qa-safe="unsafe-box" style={{...abs(faults ? width - 70 * u : safe.left + safe.width - 80 * u, safe.top + 20 * u), width: 60 * u, height: 60 * u, borderRadius: 12 * u, background: theme.colors.accent}} />

      {/* Traps. Decoration that bleeds off on purpose, and text clipped away by overflow:hidden (like a digit column). */}
      <div data-qa-ignore style={{...abs(width - 150 * u, height - 70 * u), ...text(40, '#27456E')}}>DECORATION</div>
      <div style={{...abs(safe.left + 20 * u, safe.top + 500 * u), width: 520 * u, height: 40 * u, overflow: 'hidden'}}>
        <div style={text(30)}>Visible line</div>
        <div style={{...text(30), position: 'absolute', left: -4000 * u, top: 0}}>Clipped away</div>
        <div style={{...text(30), position: 'absolute', left: 0, top: 4000 * u}}>Clipped below</div>
      </div>
      <div style={{...abs(safe.left + 20 * u, safe.top + 560 * u), ...text(30), opacity: 0}}>Invisible text</div>

      {/* The only moving thing. */}
      <div style={{...abs(x, safe.top + safe.height - size - 10 * u), width: size, height: size, borderRadius: 24 * u, background: theme.colors.accent}} />
    </div>
  );
};

/**
 * Remotion wrapper: reads the frame once, here, and passes it down.
 * @example <Composition id="Card" component={QaDemo} durationInFrames={600} fps={60} width={1920} height={1080} />
 */
export const QaDemo: React.FC<QaDemoProps> = (props) => <QaDemoFrame frame={useCurrentFrame()} {...props} />;

const VARIANTS: Array<{id: string; canvas: Canvas; faults: boolean}> = [
  {id: 'Kit-Qa-Demo', canvas: CANVAS.landscape60, faults: true},
  {id: 'Kit-Qa-Demo-Vertical', canvas: CANVAS.vertical60, faults: true},
  {id: 'Kit-Qa-Demo-30fps', canvas: CANVAS.landscape30, faults: true},
  {id: 'Kit-Qa-Demo-Clean', canvas: CANVAS.landscape60, faults: false},
];

/**
 * Registers the QA test cards (landscape 60, vertical 60, landscape 30, and a clean landscape 60).
 * @example <KitQaCompositions />
 */
export const KitQaCompositions: React.FC = () => (
  <>
    {VARIANTS.map(({id, canvas, faults}) => (
      <Composition key={id} id={id} component={QaDemo} durationInFrames={QA_FIXTURE.seconds * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{theme: createTheme({canvas}), faults}} />
    ))}
  </>
);
