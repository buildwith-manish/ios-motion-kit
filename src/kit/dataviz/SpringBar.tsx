import React from 'react';
import type {CSSProperties} from 'react';
import {SPRING} from '../motion';
import {rgba} from '../tokens/color';
import {space, unit} from '../tokens/helpers';
import {textStyle} from '../tokens/text';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme, TypeRole} from '../tokens/types';
import {clamp01, formatValue, pickFormat, resolveProgress, toneColor, type Timing} from './common';
import {barFrameAt, layoutBar, type BarData, type BarOrientation} from './bar';

/** Props for {@link SpringBar}. Sizes are design px (scaled to the canvas by the theme). */
export interface SpringBarProps extends Timing {
  /** Plain-JSON bar data: label, value, optional target, tone, number format. */
  data: BarData;
  /** 'horizontal' (default) grows right; 'vertical' grows up. */
  orientation?: BarOrientation;
  /** Length of the full-scale track. Default 640. */
  length?: number;
  /** Bar thickness. Never below `minThickness`. Default = minThickness. */
  thickness?: number;
  /** Minimum thickness. Default 56. */
  minThickness?: number;
  /** Shared full-scale value, to make several bars comparable. Default: `data.max`, else the larger of value and target. */
  max?: number;
  /** Type role of the name label. Default 'body'. */
  nameRole?: TypeRole;
  /** Type role of the value label. Default 'title'. */
  valueRole?: TypeRole;
  showName?: boolean;
  showValue?: boolean;
  /** Override the theme (default: nearest ThemeProvider). */
  theme?: Theme;
  style?: CSSProperties;
}

const abs = (x: number, y: number, w: number, h: number): CSSProperties => ({position: 'absolute', left: x, top: y, width: w, height: h});

/**
 * Bar that grows to a value on an iOS spring, with rounded caps, a name label, a rolling value label and an optional
 * target marker. When `data.target` is above `data.value` a dashed shortfall fill in the theme's negative colour
 * wipes out from the bar tip to the marker, with its own rolling label ("needed vs earned").
 * Minimum thickness is 56 design px. Labels never overlap: target and shortfall labels are nudged apart.
 * Pure: a function of `progress` or `frame` + `start` (seconds), no hooks.
 *
 * @example
 * <SpringBar frame={frame} start={1} length={640} data={{label: 'Earned', value: 3150, target: 4200, prefix: '$', targetLabel: 'Needed'}} />
 */
export const SpringBar: React.FC<SpringBarProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const {data, orientation = 'horizontal'} = props;
  const u = unit(theme);
  const p = resolveProgress(props, theme, props.response ?? SPRING.GENTLE);
  const L = layoutBar({theme, data, orientation, length: props.length ?? 640, thickness: props.thickness, minThickness: props.minThickness, max: props.max, nameRole: props.nameRole, valueRole: props.valueRole, showName: props.showName, showValue: props.showValue});
  const F = barFrameAt(L, p, data.value, data.target);
  const c = theme.colors;
  const fmt = pickFormat(data);
  const tone = data.tone ?? 'accent';
  const radius = L.T / 2;
  const horizontal = orientation === 'horizontal';
  const labelOpacity = clamp01(p * 3);
  const valueRole = props.valueRole ?? 'title';
  const nameRole = props.nameRole ?? 'body';

  const textBox = (r: {x: number; y: number; w: number; h: number}, align: 'left' | 'right' | 'center'): CSSProperties => ({
    ...abs(r.x, r.y, r.w, r.h), lineHeight: `${r.h}px`, textAlign: align, whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'isolate',
  });
  const small = (color: string): CSSProperties => ({...textStyle(theme, 'caption', {color}), letterSpacing: `${theme.type.caption.tracking}em`});
  const shortfallLabelText = data.shortfallLabel ?? formatValue(-F.shortfallShown, fmt);

  return (
    <div style={{position: 'relative', width: L.width, height: L.height, ...props.style}}>
      <div style={{...abs(L.track.x, L.track.y, L.track.w, L.track.h), borderRadius: radius, background: rgba(c.text.primary, 0.08)}} />
      {F.shortfall ? (
        <div style={{...abs(F.shortfall.x, F.shortfall.y, F.shortfall.w, F.shortfall.h), boxSizing: 'border-box', borderRadius: radius, background: rgba(c.semantic.negative, 0.22), border: `${Math.max(2, 2 * u)}px dashed ${rgba(c.semantic.negative, 0.9)}`}} />
      ) : null}
      {F.bar ? <div style={{...abs(F.bar.x, F.bar.y, F.bar.w, F.bar.h), borderRadius: radius, background: toneColor(theme, tone), opacity: F.opacity}} /> : null}
      {F.marker ? <div style={{...abs(F.marker.x, F.marker.y, F.marker.w, F.marker.h), borderRadius: 999, background: c.text.primary, opacity: clamp01(p * 3), zIndex: 3}} /> : null}

      {L.name ? <div style={{...textStyle(theme, nameRole, {color: 'secondary'}), ...textBox(L.name, horizontal ? 'left' : 'center'), ...(horizontal ? {overflow: 'hidden', textOverflow: 'ellipsis'} : null), opacity: labelOpacity}}>{data.label}</div> : null}
      {L.value ? <div style={{...textStyle(theme, valueRole, {color: 'primary', tabular: true}), ...textBox(L.value, horizontal ? 'right' : 'center'), opacity: labelOpacity}}>{formatValue(F.shown, fmt)}</div> : null}
      {L.targetLabel ? <div style={{...small(c.text.primary), ...textBox(L.targetLabel, horizontal ? 'center' : 'left'), opacity: clamp01(p * 3)}}>{L.targetText}</div> : null}
      {L.shortfallLabel && L.shortfallText ? (
        <div style={{...small(c.semantic.negative), ...textBox(L.shortfallLabel, horizontal ? 'center' : 'left'), opacity: clamp01((F.p2 - 0.4) / 0.6), fontVariantNumeric: 'tabular-nums'}}>{shortfallLabelText}</div>
      ) : null}
    </div>
  );
};

/** Plain-JSON data for {@link ShortfallBars}. */
export interface ShortfallBarsData {
  needed: {label?: string; value: number};
  earned: {label?: string; value: number};
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Text at the marker on the earned bar. Default: none (the needed bar already shows it). */
  targetLabel?: string;
  /** Override for the shortfall label. */
  shortfallLabel?: string;
}

/** Props for {@link ShortfallBars}. */
export interface ShortfallBarsProps extends Timing {
  data: ShortfallBarsData;
  /** Full-scale track length, design px. Default 640. */
  length?: number;
  thickness?: number;
  minThickness?: number;
  /** Gap between the two bars, design px. Default 24. */
  gap?: number;
  /** Seconds the earned bar starts after the needed bar (frame mode only). Default 0.12. */
  stagger?: number;
  theme?: Theme;
  style?: CSSProperties;
}

/**
 * The "needed vs earned" case: two bars on a shared scale. The needed bar is neutral; the earned bar is accent with a
 * marker at the needed value and, when it falls short, a dashed negative-colour shortfall fill with its label.
 * @example
 * <ShortfallBars frame={frame} start={1} data={{needed: {label: 'Needed', value: 4200}, earned: {label: 'Earned', value: 3150}, prefix: '$'}} />
 */
export const ShortfallBars: React.FC<ShortfallBarsProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const {data} = props;
  const fmt = {prefix: data.prefix, suffix: data.suffix, decimals: data.decimals};
  const max = Math.max(data.needed.value, data.earned.value, 1e-9);
  const gap = space(theme, 6) * ((props.gap ?? 24) / 24);
  const earnedTiming: Timing = props.progress !== undefined ? {progress: props.progress} : {frame: props.frame, start: (props.start ?? 0) + (props.stagger ?? 0.12), response: props.response, fps: props.fps};
  const neededTiming: Timing = props.progress !== undefined ? {progress: props.progress} : {frame: props.frame, start: props.start, response: props.response, fps: props.fps};
  const common = {theme, length: props.length, thickness: props.thickness, minThickness: props.minThickness, max} as const;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap, ...props.style}}>
      <SpringBar {...common} {...neededTiming} data={{...fmt, label: data.needed.label, value: data.needed.value, tone: 'secondary'}} />
      <SpringBar {...common} {...earnedTiming} data={{...fmt, label: data.earned.label, value: data.earned.value, target: data.needed.value, tone: 'accent', targetLabel: data.targetLabel, shortfallLabel: data.shortfallLabel}} />
    </div>
  );
};
