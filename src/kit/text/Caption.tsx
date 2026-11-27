import React from 'react';
import type {CSSProperties} from 'react';
import {Glass} from '../glass/Glass';
import {unit, safeRect, space} from '../tokens/helpers';
import {useTheme} from '../tokens/ThemeProvider';
import type {GlassTierName, Theme, TypeRole} from '../tokens/types';
import {fitText, layoutWords, splitWords} from './layout';
import {metricsForWeight, detectDirection, type FontMetrics} from './metrics';
import {pageAt, paginateCaptions} from './captionPages';
import {RevealText} from './RevealText';
import type {TextDirection, TimedWord} from './types';

/** Props for {@link Caption}. */
export interface CaptionProps {
  /** Burned-in captions from word timings (seconds); paginated into pages of at most `maxLines` lines. */
  timings?: readonly TimedWord[];
  /** Or one fixed caption (shown from `start` to `end`), auto-fitted to the box. */
  text?: string;
  /** For `text`: second it appears. Default 0. */
  start?: number;
  /** For `text`: second it disappears. Default Infinity. */
  end?: number;
  /** Current frame number (passed in). */
  frame: number;
  /** Line limit. Default 2. */
  maxLines?: number;
  /** 'bottom' | 'center' | 'top' of the title safe area. Default 'bottom'. */
  position?: 'bottom' | 'center' | 'top';
  /** Glass backing tier, or false for none. Default false. Mid-fade, the glass shows its un-blurred fill (see Glass). */
  glass?: false | GlassTierName;
  /** Brighten the spoken word and dim the rest (needs `timings`). Default true when timings are given. */
  highlightActive?: boolean;
  /** Seconds a page lingers after its last word. Default 0.25. */
  hold?: number;
  /** Box width in canvas px. Default 88% of the title safe width. */
  maxWidth?: number;
  /** Font size in canvas px. Default: the role's size scaled to the canvas (text mode may shrink it to fit). */
  fontSize?: number;
  role?: TypeRole;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | (string & {});
  direction?: TextDirection;
  metrics?: FontMetrics;
  theme?: Theme;
  /** Frame rate override (default theme.canvas.fps). */
  fps?: number;
  style?: CSSProperties;
}

/**
 * Burned-in captions: at most 2 lines, kept inside the theme's title safe area (so it clears Shorts/Reels UI in
 * vertical), optional glass backing, word-synced highlight, per-page enter and fade-out. Positions itself absolutely
 * inside its parent, so put it in a full-canvas layer. Pure: a function of `frame`.
 *
 * @example
 * <Caption frame={frame} timings={words} glass="pill" />
 */
export const Caption: React.FC<CaptionProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const {frame, timings, text, start = 0, end = Infinity, maxLines = 2, position = 'bottom', glass = false, hold = 0.25, role = 'body'} = props;
  const fps = props.fps ?? theme.canvas.fps;
  const time = frame / fps;
  const u = unit(theme);
  const safe = safeRect(theme, 'title');
  const boxW = props.maxWidth ?? safe.width * 0.88;
  const padX = glass ? space(theme, 6) : 0;
  const padY = glass ? space(theme, 3) : 0;
  const innerW = boxW - padX * 2;
  const baseSize = props.fontSize ?? theme.type[role].size * u * 1.4;
  const lineHeight = theme.type[role].lineHeight;
  const metrics = props.metrics ?? metricsForWeight(theme.weights.bold);
  const tracking = theme.type[role].tracking;

  let words: TimedWord[] | undefined;
  let pageStart = start;
  let pageEnd = end;
  let fontSize = baseSize;
  let dirText = text ?? '';
  if (timings && timings.length > 0) {
    const pages = paginateCaptions(timings, {fontSize: baseSize, metrics, letterSpacingEm: tracking, maxWidth: innerW, maxLines, lineHeight});
    const i = pageAt(pages, time, hold);
    if (i < 0) return null;
    words = pages[i].words;
    pageStart = pages[i].start;
    pageEnd = pages[i].end;
    dirText = words.map((w) => w.text).join(' ');
  } else if (text) {
    if (time < start || time >= end + hold) return null;
    fontSize = fitText(text, {maxWidth: innerW, maxLines, maxFontSize: baseSize, minFontSize: baseSize * 0.6, metrics, letterSpacingEm: tracking, lineHeight}).fontSize;
  } else return null;

  // Shrink the box to the text (pill hugs the words); RevealText re-wraps with the same table and 3 % slack.
  const tight = layoutWords(words ? words.map((w) => w.text) : splitWords(text ?? ''), {fontSize, metrics, letterSpacingEm: tracking, maxWidth: innerW, lineHeight});
  const innerTight = Math.min(innerW, Math.ceil(tight.width * 1.06) + 2);
  const fade = hold > 0 ? Math.min(1, Math.max(0, 1 - (time - pageEnd) / hold)) : 1;
  const dir = !props.direction || props.direction === 'auto' ? detectDirection(dirText) : props.direction;
  const anchor: CSSProperties =
    position === 'bottom' ? {bottom: theme.canvas.height - safe.top - safe.height} : position === 'top' ? {top: safe.top} : {top: safe.top + safe.height / 2, transform: 'translateY(-50%)'};

  const body = (
    <RevealText
      text={words ? undefined : text}
      timings={words}
      appear="stagger"
      gap={0}
      mode="words"
      start={pageStart}
      frame={frame}
      rise={12}
      blur={6}
      align="center"
      role={role}
      weight="bold"
      color={props.color}
      fontSize={fontSize}
      maxWidth={innerTight}
      maxLines={maxLines}
      direction={dir}
      highlightActive={props.highlightActive ?? !!words}
      keepSpoken
      metrics={metrics}
      theme={theme}
      fps={fps}
    />
  );

  return (
    <div style={{position: 'absolute', left: safe.left, width: safe.width, display: 'flex', justifyContent: 'center', pointerEvents: 'none', ...anchor, ...props.style}}>
      <div style={{opacity: fade}}>
        {glass ? (
          <Glass tier={glass} theme={theme} width={innerTight + padX * 2} style={{padding: `${padY}px ${padX}px`, boxSizing: 'border-box'}}>
            {body}
          </Glass>
        ) : (
          <div style={{width: innerTight, textShadow: `0 ${2 * u}px ${12 * u}px rgba(0,0,0,0.45)`}}>{body}</div>
        )}
      </div>
    </div>
  );
};
