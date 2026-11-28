import React from 'react';
import type {CSSProperties} from 'react';
import {SPRING} from '../motion';
import {rgba} from '../tokens/color';
import {unit} from '../tokens/helpers';
import {textStyle} from '../tokens/text';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {resolveSpec} from '../text/format';
import {clamp01, fitWidth, formatValue, onToneColor, pickFormat, resolveProgress, roleFontPx, textWidthPx, toneColor, type NumberFormat, type Timing, type Tone} from './common';

/**
 * Plain-JSON data for a {@link Delta}: give the change directly (`value`) or let it be computed (`from` -> `to`).
 * @example {value: 12.4, suffix: '%', decimals: 1}   or   {from: 3150, to: 3540, mode: 'percent'}
 */
export interface DeltaData extends NumberFormat {
  /** The change; positive is up. Wins over from/to. */
  value?: number;
  from?: number;
  to?: number;
  /** How from/to becomes a change: 'percent' (default, shows 1 decimal and a % unless you set them) or 'absolute'. */
  mode?: 'percent' | 'absolute';
  /** Lower is better (costs, errors): an increase gets the negative colour, a decrease the positive one. */
  invert?: boolean;
}

/** What a {@link DeltaData} resolves to. */
export interface ResolvedDelta {
  /** Signed change. */
  value: number;
  direction: 'up' | 'down' | 'flat';
  /** Theme colour of the chip. Flat changes use 'tertiary'. */
  tone: Tone;
  format: NumberFormat;
}

/**
 * Resolves delta data to a signed value, direction, tone and number format.
 * @example resolveDelta({from: 100, to: 112}) // {value: 12, direction: 'up', tone: 'positive', format: {suffix: '%', decimals: 1}}
 */
export const resolveDelta = (d: DeltaData): ResolvedDelta => {
  const percent = d.value === undefined && (d.mode ?? 'percent') === 'percent';
  const value = d.value ?? (d.from !== undefined && d.to !== undefined ? (percent ? (d.from === 0 ? 0 : ((d.to - d.from) / Math.abs(d.from)) * 100) : d.to - d.from) : 0);
  const shown = Math.round(Math.abs(value) * 10 ** (d.decimals ?? (percent ? 1 : 0)));
  const direction = shown === 0 ? 'flat' : value > 0 ? 'up' : 'down';
  const good = d.invert ? direction === 'down' : direction === 'up';
  const tone: Tone = direction === 'flat' ? 'tertiary' : good ? 'positive' : 'negative';
  const base = pickFormat(d);
  return {value, direction, tone, format: percent ? {...base, suffix: base.suffix ?? '%', decimals: base.decimals ?? 1} : base};
};

/** Props for {@link Delta}. Sizes are design px (scaled to the canvas by the theme). */
export interface DeltaProps extends Timing {
  data: DeltaData;
  /** Multiplies the body type size (32 px). Default 1. */
  scale?: number;
  /** Solid colour fill with dark text instead of the tinted fill. Default false. */
  solid?: boolean;
  /** Print the sign (+ / minus) before the number as well as the arrow. Default false. */
  showSign?: boolean;
  theme?: Theme;
  style?: CSSProperties;
}

/**
 * Up/down change chip: an arrow that slides in the direction of the change, and a number that rolls up, in the
 * theme's positive / negative colour (flip with `invert` when lower is better). Width is fixed from the final number,
 * so nothing jitters while it rolls. Pure: a function of `progress` or `frame` + `start` (seconds).
 *
 * @example
 * <Delta frame={frame} start={2} data={{from: 3150, to: 3540}} />   // up chip "12.4%"
 */
export const Delta: React.FC<DeltaProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const u = unit(theme);
  const p = resolveProgress(props, theme, props.response ?? SPRING.SNAPPY * 1.4);
  const r = resolveDelta(props.data);
  const fontPx = roleFontPx(theme, 'body', props.scale ?? 1);
  const textOf = (v: number): string => `${props.showSign && r.direction !== 'flat' ? (r.direction === 'up' ? '+' : '−') : ''}${formatValue(Math.abs(v), r.format.format ? {...r.format, format: {...resolveSpec(r.format.format), sign: 'auto'}} : r.format)}`;
  const finalText = textOf(r.value);
  const textW = fitWidth(theme, textWidthPx(theme, 'body', finalText, {fontPx, weight: 'bold'}));
  const h = fontPx * 1.75;
  const padX = fontPx * 0.55;
  const icon = fontPx * 0.8;
  const gap = fontPx * 0.3;
  const w = padX * 2 + icon + gap + textW;
  const color = toneColor(theme, r.tone);
  const ink = props.solid ? onToneColor(theme, r.tone) : r.tone === 'accent' ? theme.colors.accentText : color;
  const dir = r.direction === 'up' ? -1 : 1;
  const slide = r.direction === 'flat' ? 0 : dir * -1 * (1 - p) * fontPx * 0.5;
  const sw = Math.max(2, fontPx * 0.12);
  const s = icon;

  return (
    <div data-kit-role="secondary" style={{display: 'inline-flex', alignItems: 'center', width: w, height: h, boxSizing: 'border-box', paddingLeft: padX, paddingRight: padX, gap, borderRadius: h / 2, background: props.solid ? color : rgba(color, 0.18), opacity: clamp01(p * 3), transform: `scale(${0.94 + 0.06 * p})`, direction: 'ltr', ...props.style}}>
      <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none', overflow: 'visible', transform: `translateY(${slide}px)`}} fill="none" stroke={ink} strokeWidth={(sw / s) * 24} strokeLinecap="round" strokeLinejoin="round">
        {r.direction === 'flat' ? <path d="M5 12 H19" /> : r.direction === 'up' ? <path d="M12 20 V5 M5.5 11.5 L12 5 L18.5 11.5" /> : <path d="M12 4 V19 M5.5 12.5 L12 19 L18.5 12.5" />}
      </svg>
      <span style={{...textStyle(theme, 'body', {color: ink, weight: 'bold', tabular: true}), fontSize: fontPx, lineHeight: 1, whiteSpace: 'nowrap', width: textW, display: 'inline-block'}}>{textOf(r.value * p)}</span>
    </div>
  );
};
