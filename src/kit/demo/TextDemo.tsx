import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, safeRect, space, ThemeProvider, unit, type Canvas, type Theme} from '../index';
import {Caption, Emphasis, NumberText, RevealText, type TimedWord} from '../text';

/** Demo length in seconds. */
export const TEXT_DEMO_SECONDS = 10;

const EN = {
  headline: 'Where your paycheck\ngoes further',
  sentence: 'Housing takes the biggest bite, so a small raise can feel like a big one.',
  emphasize: 'biggest',
  caption: 'Same salary, different outcomes. Compare before you move.',
  label: 'MONTHLY COST',
  label2: 'OF INCOME',
};
const HE = {
  headline: 'לאן הכסף שלך\nמגיע רחוק יותר',
  sentence: 'הדיור לוקח את הנתח הגדול ביותר, ולכן העלאה קטנה מרגישה גדולה.',
  emphasize: 'הגדול',
  caption: 'אותו משכורת, תוצאות שונות. השוו לפני שעוברים.',
  label: 'עלות חודשית',
  label2: 'מההכנסה',
};

/** Deterministic fake voice-over timings: ~0.075 s per letter + 0.12 s base, 0.05 s gap. */
export const fakeTimings = (sentence: string, startAt: number): TimedWord[] => {
  let t = startAt;
  return sentence.split(/\s+/).map((text) => {
    const dur = 0.12 + text.length * 0.065;
    const w = {text, start: t, end: t + dur};
    t += dur + 0.05;
    return w;
  });
};

/** Props for {@link TextDemoFrame}. */
export interface TextDemoProps {
  /** Theme (default: createTheme() = midnight at 1920x1080@60). */
  theme?: Theme;
  /** Right-to-left variant (Hebrew copy). */
  rtl?: boolean;
}

/** Pure demo frame: headline reveal, word-synced sentence with an emphasis, number rolls, burned-in caption. */
export const TextDemoFrame: React.FC<TextDemoProps & {frame: number}> = ({frame, theme: themeProp, rtl = false}) => {
  const theme = themeProp ?? createTheme();
  const copy = rtl ? HE : EN;
  const {width, height} = theme.canvas;
  const u = unit(theme);
  const safe = safeRect(theme, 'title');
  const portrait = height > width;
  const sentence = fakeTimings(copy.sentence, 2.4);
  const caption = fakeTimings(copy.caption, 7.0);
  const emIdx = sentence.findIndex((w) => w.text.startsWith(copy.emphasize));
  const bg = theme.colors.background;
  const dir = rtl ? 'rtl' : 'ltr';

  return (
    <div style={{position: 'relative', width, height, overflow: 'hidden', background: `linear-gradient(160deg, ${bg.lift}, ${bg.base} 55%, ${bg.deep})`}}>
      <ThemeProvider theme={theme}>
        <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, display: 'flex', flexDirection: 'column', gap: space(theme, portrait ? 10 : 10), direction: dir}}>
          <RevealText text={copy.headline} frame={frame} mode="lines" mask start={0.3} gap={0.14} role="display" maxWidth={safe.width} fit={{maxHeight: safe.height * (portrait ? 0.22 : 0.3)}} direction={dir} />
          <RevealText
            timings={sentence}
            frame={frame}
            mode="words"
            role="title"
            color="secondary"
            highlightActive
            inactiveOpacity={0.72}
            maxWidth={safe.width * (portrait ? 1 : 0.8)}
            direction={dir}
            renderWord={(w, node) => (w.index === emIdx ? <Emphasis frame={frame} start={(w.start ?? 0) + 0.1} variant="underline">{node}</Emphasis> : node)}
          />
          <div style={{display: 'flex', gap: space(theme, portrait ? 6 : 16), flexDirection: portrait ? 'column' : 'row', alignItems: 'flex-start'}}>
            <div>
              <div style={{fontFamily: theme.fonts.body, fontSize: 26 * u, letterSpacing: '0.08em', color: theme.colors.text.tertiary, fontWeight: theme.weights.bold, marginBottom: space(theme, 2)}}>{copy.label}</div>
              <NumberText prefix="$" to={2480} then={[{at: 7.4, to: 2715, duration: 0.8}]} frame={frame} start={5.0} duration={1.1} role="number" />
            </div>
            <div>
              <div style={{fontFamily: theme.fonts.body, fontSize: 26 * u, letterSpacing: '0.08em', color: theme.colors.text.tertiary, fontWeight: theme.weights.bold, marginBottom: space(theme, 2)}}>{copy.label2}</div>
              <NumberText to={41.5} decimals={1} suffix="%" frame={frame} start={5.3} duration={1.1} role="number" color="accent" />
            </div>
          </div>
        </div>
        <Caption frame={frame} timings={caption} glass="pill" direction={dir} />
      </ThemeProvider>
    </div>
  );
};

/** Remotion wrapper: reads the frame once, here, and passes it down. */
export const TextDemo: React.FC<TextDemoProps> = (props) => <TextDemoFrame frame={useCurrentFrame()} {...props} />;

const VARIANTS: Array<{id: string; canvas: Canvas; rtl?: boolean}> = [
  {id: 'Kit-Text-Demo', canvas: CANVAS.landscape60},
  {id: 'Kit-Text-Demo-Vertical', canvas: CANVAS.vertical60},
  {id: 'Kit-Text-Demo-30fps', canvas: CANVAS.landscape30},
  {id: 'Kit-Text-Demo-RTL', canvas: CANVAS.landscape60, rtl: true},
];

/**
 * Registers the text demo compositions (landscape 60, vertical 60, landscape 30, RTL).
 * @example <KitTextCompositions />
 */
export const KitTextCompositions: React.FC = () => (
  <>
    {VARIANTS.map(({id, canvas, rtl}) => (
      <Composition key={id} id={id} component={TextDemo} durationInFrames={TEXT_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{theme: createTheme({canvas}), rtl: !!rtl}} />
    ))}
  </>
);
