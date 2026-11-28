import React from 'react';
import type {CSSProperties} from 'react';
import {MotionBlur} from '../transitions/MotionBlur';
import {useTheme} from '../tokens/ThemeProvider';
import {textStyle, tabularNums} from '../tokens/text';
import type {Theme, TypeRole} from '../tokens/types';
import {metricsForWeight, type FontMetrics} from './metrics';
import {buildRollSegments, digitPresence, rollValueAt} from './numberRoll';
import {formatNumber, resolveSpec, type FormatPresetName, type FormatSpec} from './format';

/** Props for {@link NumberText}. */
export interface NumberTextProps {
  /** Value the roll ends on. */
  to: number;
  /** Value it starts from. Default 0. */
  from?: number;
  /** Current frame number (passed in). */
  frame: number;
  /** Second the roll begins. Default 0. */
  start?: number;
  /** Seconds the roll takes. Default 0.9. */
  duration?: number;
  /** Further updates after the first roll: each rolls on from the previous value. Times in seconds. */
  then?: ReadonlyArray<{at: number; to: number; duration?: number}>;
  /** Preset name or spec (see format.ts). Explicit prefix/suffix/decimals/groupSep props still win. Compact and accounting specs render as formatted text (no per-digit odometer) at a fixed width. */
  format?: FormatPresetName | FormatSpec;
  /** Digits after the decimal point. Default 0. */
  decimals?: number;
  /** Text before the number, e.g. '$'. */
  prefix?: string;
  /** Text after the number, e.g. '%' or '/mo'. */
  suffix?: string;
  /** Thousands separator; '' for none. Default ','. */
  groupSep?: string;
  /** Decimal separator. Default '.'. */
  decimalSep?: string;
  /**
   * 'collapse' (default): leading digits that are not there yet take no width, and the total width springs as digits
   * appear or leave. 'reserve': the width is fixed at the widest value of the roll (for centred layouts).
   */
  layout?: 'collapse' | 'reserve';
  /** Directional blur on rolling digits (only above 1 px/frame, capped at blurCap). Default true. */
  motionBlur?: boolean;
  /** Max digit blur in px (kit cap is 20). Default 14. */
  blurCap?: number;
  role?: TypeRole;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | (string & {});
  weight?: 'regular' | 'bold';
  /** Font size in canvas px. Default: the role's size scaled to the canvas. */
  fontSize?: number;
  metrics?: FontMetrics;
  theme?: Theme;
  /** Frame rate override (default theme.canvas.fps). */
  fps?: number;
  style?: CSSProperties;
}

const LINE_BOX = 1.12;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Position of one odometer column for value `v` at place `e` (10^e). The lowest displayed column follows the value
 * continuously; higher columns hold their digit and only carry (roll to the next) while the column below is in its
 * last tenth, like a mechanical odometer. Settled values therefore always sit exactly on a digit.
 */
export const columnPosition = (v: number, e: number, lowest: boolean): number => {
  const x = v / 10 ** e;
  if (lowest) return x;
  const base = Math.floor(x + 1e-9);
  const frac = x - base;
  return base + Math.min(1, Math.max(0, (frac - 0.9) / 0.1));
};

interface ColumnProps {
  /** Continuous place value: floor() is the digit centred, the fraction rolls into the next. */
  cont: number;
  prevCont: number;
  width: number;
  /** Full digit width; `width` is smaller while a collapsing column opens. */
  cellWidth?: number;
  lineBoxPx: number;
  blur: boolean;
  cap: number;
  /** 0..1 opacity: leading columns fade in as the value reaches them. */
  visible: number;
  /** Leading column: its zero is drawn blank, so it carries from nothing to '1'. */
  leading?: boolean;
}

const DigitColumn: React.FC<ColumnProps> = ({cont, prevCont, width, cellWidth = width, lineBoxPx, blur, cap, visible, leading}) => {
  const base = Math.floor(cont);
  const frac = cont - base;
  const d0 = ((base % 10) + 10) % 10;
  const d1 = (d0 + 1) % 10;
  const land = clamp01(1 - Math.min(frac, 1 - frac) * 2);
  // Right-anchored at full digit width, so a column that is still opening reveals its digit instead of squeezing it.
  const cell: CSSProperties = {position: 'absolute', right: 0, width: cellWidth, height: lineBoxPx, lineHeight: `${lineBoxPx}px`, textAlign: 'center'};
  return (
    <MotionBlur
      dy={blur ? (cont - prevCont) * lineBoxPx : 0}
      cap={cap}
      style={{display: 'inline-block', position: 'relative', width, height: lineBoxPx, overflow: 'hidden', opacity: visible, transform: `scale(${1 + land * 0.015}, ${1 - land * 0.025})`}}
    >
      <span style={{...cell, top: 0, transform: `translateY(${-frac * lineBoxPx}px)`}}>{leading && base === 0 ? '' : d0}</span>
      <span style={{...cell, top: lineBoxPx, transform: `translateY(${-frac * lineBoxPx}px)`}}>{d1}</span>
    </MotionBlur>
  );
};

/**
 * Money / percent / counter text with tabular figures, prefix + suffix, and an odometer roll: each digit column
 * slides continuously (no hard cut) with vertical directional blur that only appears above 1 px/frame. Further
 * updates chain with `then`. Numbers always lay out left-to-right (isolated), also inside RTL text.
 * Pure: a function of `frame` (the previous frame's value is recomputed, never stored).
 *
 * @example
 * <NumberText prefix="$" to={2480} suffix="/mo" frame={frame} start={1.0} role="number" />
 */
export const NumberText: React.FC<NumberTextProps> = (raw) => {
  const ctx = useTheme();
  const theme = raw.theme ?? ctx;
  const spec = raw.format ? resolveSpec(raw.format) : null;
  const text = spec && (spec.compact || spec.sign === 'accounting');
  const k = spec?.scale ?? 1;
  const plus = !!spec && !text && spec.sign === 'always';
  const props: NumberTextProps = spec && !text
    ? {...raw, from: (raw.from ?? 0) * k, to: raw.to * k, then: raw.then?.map((t) => ({...t, to: t.to * k})),
       prefix: raw.prefix ?? spec.prefix, suffix: raw.suffix ?? spec.suffix, decimals: raw.decimals ?? spec.decimals ?? 0, groupSep: raw.groupSep ?? (spec.group === false ? '' : ',')}
    : raw;
  const {frame, start = 0, duration = 0.9, from = 0, to, then, decimals = 0, prefix = '', suffix = '', groupSep = ',', decimalSep = '.', layout = 'collapse', motionBlur = true, blurCap = 14, role = 'number'} = props;
  const fps = props.fps ?? theme.canvas.fps;
  const base = textStyle(theme, role, {color: props.color, weight: props.weight, tabular: true});
  const fontPx = props.fontSize ?? (base.fontSize as number);
  const metrics = props.metrics ?? metricsForWeight(theme.weights[props.weight ?? theme.type[role].weight]);
  const colW = metrics.digit * fontPx;
  const lineBoxPx = fontPx * LINE_BOX;

  const segs = buildRollSegments({from, to, start, duration, then});
  const valueAt = (f: number): number => rollValueAt(f / fps, segs);
  if (spec && text) {
    // Compact / accounting: formatted text, width reserved from the widest string the roll will show.
    const chars = [0, ...segs.flatMap((g) => [g.from, g.to])].reduce((m, v) => Math.max(m, formatNumber(v, spec).length), 1);
    return (
      <span style={{...base, fontSize: fontPx, display: 'inline-block', minWidth: chars * colW, whiteSpace: 'nowrap', unicodeBidi: 'isolate', ...props.style}}>
        {formatNumber(valueAt(frame), spec)}
      </span>
    );
  }
  const cur = valueAt(frame);
  const prev = valueAt(frame - 1);
  const atRest = cur === prev;
  const snap = 10 ** decimals;
  // At rest, snap to the displayed precision so the lowest column sits exactly on a digit.
  const absCur = Math.abs(atRest ? Math.round(cur * snap) / snap : cur);
  const absPrev = Math.abs(prev);
  const lowestE = -decimals;
  // Fixes the width of the whole component from the largest magnitude it will ever show.
  const maxAbs = segs.reduce((m, s) => Math.max(m, Math.abs(s.from), Math.abs(s.to)), 0);
  const intDigits = Math.max(1, Math.round(maxAbs).toString().length);

  const staticCell = (key: string, ch: string, style?: CSSProperties) => (
    <span key={key} style={{display: 'inline-block', height: lineBoxPx, lineHeight: `${lineBoxPx}px`, ...style}}>
      {ch}
    </span>
  );
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < intDigits; i++) {
    const e = intDigits - 1 - i;
    const cont = columnPosition(absCur, e, e === lowestE);
    // The ones column is always shown; a higher column appears as it starts to carry from blank to '1'.
    const visible = e === 0 ? 1 : clamp01((absCur / 10 ** e - 0.9) / 0.03);
    const share = e === 0 || layout === 'reserve' ? 1 : digitPresence(frame, fps, segs, e);
    nodes.push(<DigitColumn key={`i${i}`} cont={cont} prevCont={columnPosition(absPrev, e, e === lowestE)} width={colW * share} cellWidth={colW} lineBoxPx={lineBoxPx} blur={motionBlur} cap={Math.min(20, blurCap)} visible={visible} leading={e > 0} />);
    if (groupSep && e > 0 && e % 3 === 0) {
      nodes.push(staticCell(`g${i}`, groupSep, layout === 'reserve' || share > 0.995 ? {opacity: visible} : {opacity: visible, maxWidth: `${share * 0.5}em`, overflow: 'hidden'}));
    }
  }
  if (decimals > 0) {
    nodes.push(staticCell('dot', decimalSep));
    for (let j = 0; j < decimals; j++) {
      const e = -(j + 1);
      nodes.push(<DigitColumn key={`d${j}`} cont={columnPosition(absCur, e, e === lowestE)} prevCont={columnPosition(absPrev, e, e === lowestE)} width={colW} lineBoxPx={lineBoxPx} blur={motionBlur} cap={Math.min(20, blurCap)} visible={1} />);
    }
  }

  return (
    <span
      style={{
        ...base,
        ...tabularNums(),
        fontSize: fontPx,
        lineHeight: `${lineBoxPx}px`,
        display: 'inline-flex',
        alignItems: 'center',
        direction: 'ltr',
        unicodeBidi: 'isolate',
        whiteSpace: 'nowrap',
        ...props.style,
      }}
    >
      {prefix ? staticCell('pre', prefix, {marginRight: '0.04em'}) : null}
      {plus && cur > 1e-9 ? staticCell('pos', '+', {marginRight: '0.02em'}) : null}
      {cur < -1e-9 ? staticCell('neg', '\u2212', {marginRight: '0.02em'}) : null}
      {nodes}
      {suffix ? staticCell('suf', suffix, {marginLeft: '0.08em'}) : null}
    </span>
  );
};
