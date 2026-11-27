import React from 'react';
import type {CSSProperties} from 'react';
import {useTheme} from '../tokens/ThemeProvider';
import {safeRect, unit} from '../tokens/helpers';
import {textStyle} from '../tokens/text';
import type {Theme, TypeRole} from '../tokens/types';
import {fitText, layoutText, layoutWords} from './layout';
import {detectDirection, hasConnectedScript, metricsForWeight, type FontMetrics} from './metrics';
import {wordActivity} from './timing';
import type {TextDirection, RevealMode, TextAlign, TimedWord} from './types';
import {unitEnter, unitStyle, type UnitMotion} from './unitMotion';

/** Props for {@link RevealText}. */
export interface RevealTextProps {
  /** The text. "\n" forces a line break. Optional when `timings` is given. */
  text?: string;
  /**
   * Voice-over word timings in seconds. Each word appears on its own `start` (plus `start` prop as an offset) instead
   * of a fixed stagger. Words must contain no spaces.
   */
  timings?: readonly TimedWord[];
  /** 'timings' (default when timings are given) or 'stagger' (fixed gap; timings are then used only for highlight). */
  appear?: 'timings' | 'stagger';
  /** Karaoke style: brighten the word being spoken, dim the rest. Needs `timings`. Default false. */
  highlightActive?: boolean;
  /** Opacity of words that are not active. Default 0.4. */
  inactiveOpacity?: number;
  /** Keep already-spoken words fully bright (only upcoming words dim). Default false. */
  keepSpoken?: boolean;
  /** Seconds the active/inactive cross-fade lasts. Default 0.12. */
  activeFade?: number;
  /** Wraps each word, e.g. in <Emphasis>. Receives the word's index, text and timing (if any). */
  renderWord?: (word: {text: string; index: number; start?: number; end?: number}, node: React.ReactNode) => React.ReactNode;
  /** Current frame number (passed in; no Remotion hook is read). */
  frame: number;
  /** What enters as one unit. Default 'words'. 'chars' falls back to words for connected scripts (Arabic, Indic). */
  mode?: RevealMode;
  /** Second the first unit begins. Default 0. */
  start?: number;
  /** Seconds between consecutive units. Default 0.12 lines / 0.07 words / 0.025 chars. */
  gap?: number;
  /** Spring response in seconds. Default theme.motion.spring.SMOOTH. */
  response?: number;
  /** Rise distance in px at the 1080 design size, scaled to the canvas; 12-24 recommended. Default 18. */
  rise?: number;
  /** Starting blur in px. Default 8. */
  blur?: number;
  /** Starting scale. Default 1. */
  scale?: number;
  /** Clip each line so units rise out of a baseline (iOS title style). Default false. */
  mask?: boolean;
  /** 'ltr' | 'rtl' | 'auto'. Default 'auto'. */
  direction?: TextDirection;
  /** Logical alignment inside the box. Default 'start'. */
  align?: TextAlign;
  /** Theme type role. Default 'display'. */
  role?: TypeRole;
  /** Theme colour name or any CSS colour. Default 'primary'. */
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | (string & {});
  /** Overrides the role's weight. */
  weight?: 'regular' | 'bold';
  /** Font size in canvas px. Default: the role's size scaled to the canvas. */
  fontSize?: number;
  /** Unitless line-height multiplier. Default: the role's. */
  lineHeight?: number;
  /** Box width in canvas px. Default: the width of the theme's title safe area. */
  maxWidth?: number;
  /** Line limit used for the overflow flag and wrapping decisions. */
  maxLines?: number;
  /**
   * Auto-fit: shrink the font from `fontSize` (or the role's size) until the text fits `maxWidth` x `maxHeight`
   * within `maxLines`, using the width table (no DOM measurement). `minFontSize` defaults to a third of the start size.
   */
  fit?: {maxHeight: number; minFontSize?: number};
  /** Width table of the font. Default: the shipped Inter table nearest the weight. */
  metrics?: FontMetrics;
  /** Overrides the theme (default: nearest ThemeProvider). */
  theme?: Theme;
  /** Frame rate override (default theme.canvas.fps). */
  fps?: number;
  style?: CSSProperties;
  className?: string;
}

const DEFAULT_GAP: Record<RevealMode, number> = {lines: 0.12, words: 0.07, chars: 0.025};
const MASK_PAD_Y = 0.12;
const MASK_PAD_X = 0.5;

/**
 * Staggered text reveal with the standard enter (opacity, rise 12-24 px, blur 8 -> 0) on an iOS spring.
 * Line breaks come from a precomputed width table (no DOM measurement), so the same lines appear in every render
 * worker. Pure: a function of `frame`.
 *
 * @example
 * <RevealText text="Where your paycheck goes furthest" frame={frame} mode="lines" mask start={0.4} maxWidth={1400} />
 */
export const RevealText: React.FC<RevealTextProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const {timings, highlightActive = false, inactiveOpacity = 0.4, keepSpoken = false, activeFade = 0.12, renderWord, frame, start = 0, mask = false, align = 'start', role = 'display', maxWidth, maxLines, style, className} = props;
  const fps = props.fps ?? theme.canvas.fps;
  const time = frame / fps;
  const u = unit(theme);
  const text = props.text ?? (timings ? timings.map((w) => w.text).join(' ') : '');
  const timed = !!timings && timings.length > 0 && props.appear !== 'stagger';

  const base = textStyle(theme, role, {color: props.color, weight: props.weight});
  const requestedSize = props.fontSize ?? (base.fontSize as number);
  const lineHeight = props.lineHeight ?? (base.lineHeight as number);
  const numericWeight = theme.weights[props.weight ?? theme.type[role].weight];
  const metrics = props.metrics ?? metricsForWeight(numericWeight);
  const trackingEm = theme.type[role].tracking;
  const width = maxWidth ?? safeRect(theme, 'title').width;
  const fontSize = props.fit
    ? fitText(text || ' ', {maxWidth: width, maxHeight: props.fit.maxHeight, maxFontSize: requestedSize, minFontSize: props.fit.minFontSize, maxLines, metrics, letterSpacingEm: trackingEm, lineHeight}).fontSize
    : requestedSize;

  const dir = !props.direction || props.direction === 'auto' ? detectDirection(text) : props.direction;
  const requested = props.mode ?? 'words';
  const mode: RevealMode = requested === 'chars' && hasConnectedScript(text) ? 'words' : requested;
  const gap = props.gap ?? DEFAULT_GAP[mode];

  const lineBox = fontSize * lineHeight;
  const motion: UnitMotion = {
    response: props.response ?? theme.motion.spring.SMOOTH,
    rise: mask ? lineBox * (1 + MASK_PAD_Y) : (props.rise ?? 18) * u,
    blur: props.blur ?? 8,
    scale: props.scale ?? 1,
    fastFade: mask,
  };

  const layoutOpts = {fontSize, metrics, letterSpacingEm: trackingEm, maxWidth: width, maxLines, lineHeight};
  const layout = timings && timings.length > 0 ? layoutWords(timings.map((w) => w.text), layoutOpts) : layoutText(text, layoutOpts);
  /** Opacity multiplier from karaoke state. */
  const lit = (index: number): number => {
    const t = timings?.[index];
    if (!highlightActive || !t) return 1;
    const a = wordActivity(time, t.start + start, t.end + start, activeFade);
    const spoken = keepSpoken && time >= t.end + start ? 1 : 0;
    return inactiveOpacity + (1 - inactiveOpacity) * Math.max(a, spoken);
  };
  const wordStart = (index: number): number => (timed && timings ? timings[index].start + start : start + wordCounter * gap);
  let wordCounter = 0;
  let charCounter = 0;

  const lines = layout.lines.map((line, li) => {
    const words = line.words.map((w, wi) => {
      const isLast = wi === line.words.length - 1;
      const space = isLast ? null : ' ';
      if (mode === 'words') {
        const s = unitEnter(time, wordStart(w.index), motion);
        wordCounter++;
        const us = unitStyle(s);
        const node = <span style={{display: 'inline-block', ...us, opacity: s.opacity * lit(w.index)}}>{w.text}</span>;
        return (
          <React.Fragment key={wi}>
            {renderWord ? renderWord({text: w.text, index: w.index, start: timings?.[w.index]?.start, end: timings?.[w.index]?.end}, node) : node}
            {space}
          </React.Fragment>
        );
      }
      if (mode === 'chars') {
        const glyphs = Array.from(w.text);
        const t = timings?.[w.index];
        const step = timed && t ? Math.min(gap, Math.max(t.end - t.start, 0.001) / glyphs.length) : gap;
        const chars = glyphs.map((ch, ci) => {
          const s = unitEnter(time, timed && t ? t.start + start + ci * step : start + charCounter * gap, motion);
          charCounter++;
          return (
            <span key={ci} style={{display: 'inline-block', ...unitStyle(s)}}>
              {ch}
            </span>
          );
        });
        return (
          <React.Fragment key={wi}>
            {renderWord ? renderWord({text: w.text, index: w.index, start: timings?.[w.index]?.start, end: timings?.[w.index]?.end}, <span style={{display: 'inline-block', opacity: lit(w.index)}}>{chars}</span>) : <span style={{display: 'inline-block', opacity: lit(w.index)}}>{chars}</span>}
            {space}
          </React.Fragment>
        );
      }
      const plain = highlightActive || renderWord ? <span style={{opacity: lit(w.index)}}>{w.text}</span> : w.text;
      return (
        <React.Fragment key={wi}>
          {renderWord ? renderWord({text: w.text, index: w.index, start: timings?.[w.index]?.start, end: timings?.[w.index]?.end}, plain) : plain}
          {space}
        </React.Fragment>
      );
    });
    const lineStyle: CSSProperties = {whiteSpace: 'nowrap'};
    const inner =
      mode === 'lines' ? (
        <div style={{...lineStyle, ...unitStyle(unitEnter(time, timed && timings ? timings[line.words[0].index].start + start : start + li * gap, motion))}}>{words}</div>
      ) : (
        <div style={lineStyle}>{words}</div>
      );
    if (!mask) return <React.Fragment key={li}>{inner}</React.Fragment>;
    return (
      <div
        key={li}
        style={{
          overflow: 'hidden',
          padding: `${MASK_PAD_Y}em ${MASK_PAD_X}em`,
          margin: `${-MASK_PAD_Y}em ${-MASK_PAD_X}em`,
        }}
      >
        {inner}
      </div>
    );
  });

  return (
    <div
      className={className}
      dir={dir}
      style={{
        ...base,
        fontSize,
        lineHeight,
        width,
        direction: dir,
        textAlign: align === 'start' ? 'start' : align === 'end' ? 'end' : 'center',
        ...style,
      }}
    >
      {lines}
    </div>
  );
};
