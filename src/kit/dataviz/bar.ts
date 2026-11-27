/**
 * Pure geometry for <SpringBar>: where the track, the bar, the target marker, the shortfall fill and every label go,
 * for both orientations. Text is measured from the kit's width tables (no DOM), so layout is identical in every
 * render worker. Labels that could collide (target label vs shortfall label) are nudged apart with `nudge1D`.
 */
import {iosEase} from '../motion';
import {space, unit} from '../tokens/helpers';
import type {Theme, TypeRole} from '../tokens/types';
import {clamp01, fitWidth, formatValue, lerp, pickFormat, roleFontPx, textWidthPx, type DvRect, type NumberFormat, type Tone} from './common';
import {nudge1D} from './layout';

/** Direction a bar grows. */
export type BarOrientation = 'horizontal' | 'vertical';

/**
 * Plain-JSON data for one bar (safe to load from a CSV/JSON file).
 * @example {label: 'Earned', value: 3150, target: 4200, prefix: '$'}
 */
export interface BarData extends NumberFormat {
  label?: string;
  value: number;
  /** Value that fills the track. Default: the larger of value and target. Share one `max` across bars to compare them. */
  max?: number;
  /** Optional target: draws a marker, and a shortfall fill when `value` is below it. */
  target?: number;
  /** Fill colour. Default 'accent'. */
  tone?: Tone;
  /** Text next to the target marker, e.g. 'Needed'. */
  targetLabel?: string;
  /** Override for the shortfall label. Default: the shortfall as a formatted negative number. */
  shortfallLabel?: string;
}

/** Inputs of {@link layoutBar}. Sizes are design px (scaled by the theme's canvas unit). */
export interface BarLayoutInput {
  theme: Theme;
  data: BarData;
  orientation: BarOrientation;
  /** Length of the full-scale track, design px. */
  length: number;
  /** Bar thickness, design px. Never below `minThickness`. Default = minThickness. */
  thickness?: number;
  /** Minimum thickness, design px. Default 56. */
  minThickness?: number;
  max?: number;
  nameRole?: TypeRole;
  valueRole?: TypeRole;
  showName?: boolean;
  showValue?: boolean;
}

/** Everything {@link SpringBar} needs to draw one bar; all px are canvas px inside the component box. */
export interface BarLayout {
  orientation: BarOrientation;
  width: number;
  height: number;
  /** Bar thickness in px. */
  T: number;
  /** Full-scale track length in px. */
  length: number;
  max: number;
  track: DvRect;
  /** Final bar length, exactly proportional to the value (before the minimum-length rule). */
  valueLen: number;
  /** Final drawn length: at least one thickness so rounded caps stay round. */
  barEnd: number;
  minLen: number;
  targetLen: number | null;
  /** Final shortfall length beyond the bar tip, px (0 = none). */
  shortfallLen: number;
  shortfallText: string;
  /** The shortfall label sits inside its fill (else below / beside the bar). */
  shortfallInside: boolean;
  name: DvRect | null;
  value: DvRect | null;
  targetLabel: DvRect | null;
  shortfallLabel: DvRect | null;
  /** How far the marker sticks out of the bar on each side, px. */
  overhang: number;
  fonts: {name: number; value: number; small: number};
  valueText: string;
  targetText: string;
}

/**
 * Computes the full layout of one bar. Horizontal: header row (name left, value right), bar, footer labels.
 * Vertical: bar column growing upward, value and name under it, target/shortfall labels beside it.
 * @example const L = layoutBar({theme, data: {value: 3150, target: 4200, prefix: '$'}, orientation: 'horizontal', length: 600});
 */
export const layoutBar = (i: BarLayoutInput): BarLayout => {
  const {theme, data, orientation} = i;
  const u = unit(theme);
  const horizontal = orientation === 'horizontal';
  const T = Math.max(i.thickness ?? 0, i.minThickness ?? 56) * u;
  const length = i.length * u;
  const g = space(theme, 3);
  const fmt = pickFormat(data);
  const max = Math.max(i.max ?? data.max ?? Math.max(data.value, data.target ?? 0), 1e-9);
  const toLen = (v: number): number => length * clamp01(v / max);
  const valueLen = toLen(Math.max(0, data.value));
  const minLen = T;
  const barEnd = valueLen > 0 ? Math.max(valueLen, minLen) : 0;
  const targetLen = data.target !== undefined ? toLen(data.target) : null;
  const shortfallLen = targetLen !== null && data.target! > data.value ? Math.max(0, targetLen - barEnd) : 0;

  const nameRole = i.nameRole ?? 'body';
  const valueRole = i.valueRole ?? 'title';
  const fonts = {name: roleFontPx(theme, nameRole), value: roleFontPx(theme, valueRole), small: roleFontPx(theme, 'caption')};
  const showName = !!data.label && i.showName !== false;
  const showValue = i.showValue !== false;
  const nameW = showName ? fitWidth(theme, textWidthPx(theme, nameRole, data.label!)) : 0;
  const valueText = formatValue(data.value, fmt);
  const valueW = showValue ? fitWidth(theme, textWidthPx(theme, valueRole, valueText)) : 0;
  const targetText = data.targetLabel ?? '';
  const targetW = targetText ? fitWidth(theme, textWidthPx(theme, 'caption', targetText)) : 0;
  const shortfallText = shortfallLen > 0 ? data.shortfallLabel ?? formatValue(-(data.target! - data.value), fmt) : '';
  const shortfallW = shortfallText ? fitWidth(theme, textWidthPx(theme, 'caption', shortfallText)) : 0;
  const smallH = fonts.small * 1.25;
  const overhang = Math.min(T * 0.16, g * 0.75);
  const pad = space(theme, 2);

  if (horizontal) {
    const headerH = showName || showValue ? Math.max(showName ? fonts.name : 0, showValue ? fonts.value : 0) * 1.15 : 0;
    const trackY = headerH > 0 ? headerH + g : 0;
    const track: DvRect = {x: 0, y: trackY, w: length, h: T};
    const inside = shortfallLen > 0 && shortfallLen >= shortfallW + 2 * pad;
    const footer: Array<{key: 'target' | 'shortfall'; center: number; size: number}> = [];
    if (targetW > 0 && targetLen !== null) footer.push({key: 'target', center: targetLen, size: targetW});
    if (shortfallW > 0 && !inside) footer.push({key: 'shortfall', center: barEnd + shortfallLen / 2, size: shortfallW});
    const centers = nudge1D(footer, {gap: pad, min: 0, max: length});
    const footY = trackY + T + overhang + g * 0.5;
    const place = (key: 'target' | 'shortfall'): DvRect | null => {
      const k = footer.findIndex((f) => f.key === key);
      return k < 0 ? null : {x: centers[k] - footer[k].size / 2, y: footY, w: footer[k].size, h: smallH};
    };
    const targetLabel = place('target');
    const shortfallOutside = place('shortfall');
    const shortfallLabel: DvRect | null = inside ? {x: barEnd + (shortfallLen - shortfallW) / 2, y: trackY + (T - smallH) / 2, w: shortfallW, h: smallH} : shortfallOutside;
    const hasFooter = !!(targetLabel || shortfallOutside);
    const nameMax = Math.max(0, length - valueW - g);
    return {
      orientation, width: length, height: hasFooter ? footY + smallH : trackY + T + (targetLen !== null ? overhang : 0), T, length, max, track,
      valueLen, barEnd, minLen, targetLen, shortfallLen, shortfallText, shortfallInside: inside,
      name: showName ? {x: 0, y: 0, w: Math.min(nameW, nameMax), h: headerH} : null,
      value: showValue ? {x: length - valueW, y: 0, w: valueW, h: headerH} : null,
      targetLabel, shortfallLabel, overhang, fonts, valueText, targetText,
    };
  }

  const colW = Math.max(T, nameW, valueW);
  const trackX = (colW - T) / 2;
  const track: DvRect = {x: trackX, y: 0, w: T, h: length};
  const sideX = trackX + T + overhang + g * 0.5;
  const side: Array<{key: 'target' | 'shortfall'; center: number; size: number}> = [];
  if (targetW > 0 && targetLen !== null) side.push({key: 'target', center: length - targetLen, size: smallH});
  if (shortfallW > 0) side.push({key: 'shortfall', center: length - barEnd - shortfallLen / 2, size: smallH});
  const centers = nudge1D(side, {gap: pad, min: 0, max: length});
  const sidePlace = (key: 'target' | 'shortfall', w: number): DvRect | null => {
    const k = side.findIndex((s) => s.key === key);
    return k < 0 ? null : {x: sideX, y: centers[k] - smallH / 2, w, h: smallH};
  };
  const targetLabel = sidePlace('target', targetW);
  const shortfallLabel = sidePlace('shortfall', shortfallW);
  const sideW = Math.max(targetLabel ? targetW : 0, shortfallLabel ? shortfallW : 0);
  const valueH = fonts.value * 1.15;
  const nameH = fonts.name * 1.15;
  const valueTop = length + g;
  const nameTop = valueTop + (showValue ? valueH + g * 0.25 : 0);
  const height = showName ? nameTop + nameH : showValue ? valueTop + valueH : length;
  return {
    orientation, width: sideW > 0 ? sideX + sideW : colW, height, T, length, max, track,
    valueLen, barEnd, minLen, targetLen, shortfallLen, shortfallText, shortfallInside: false,
    name: showName ? {x: (colW - nameW) / 2, y: nameTop, w: nameW, h: nameH} : null,
    value: showValue ? {x: (colW - valueW) / 2, y: valueTop, w: valueW, h: valueH} : null,
    targetLabel, shortfallLabel, overhang, fonts, valueText, targetText,
  };
};

/** Drawn rectangles of a bar at one moment. */
export interface BarFrame {
  /** The filled bar (null before it starts). */
  bar: DvRect | null;
  /** The shortfall fill beyond the bar tip (null when there is none yet). Tucked under the bar's rounded cap. */
  shortfall: DvRect | null;
  /** The target marker (null when no target). */
  marker: DvRect | null;
  /** 0..1 fade for the bar while it starts. */
  opacity: number;
  /** Value the roll shows right now. */
  shown: number;
  /** Shortfall the label shows right now (rolls with the fill). */
  shortfallShown: number;
  /** Shortfall progress 0..1. */
  p2: number;
}

/**
 * Bar, shortfall fill and marker at progress `p` (0..1). The bar grows from a dot of one thickness (so rounded caps
 * stay round); the shortfall wipes out from the bar tip once the bar is half way; the marker pops in early.
 * @example const f = barFrameAt(layout, 0.6, data.value, data.target)
 */
export const barFrameAt = (L: BarLayout, p: number, value: number, target: number | undefined): BarFrame => {
  const horizontal = L.orientation === 'horizontal';
  const grown = L.valueLen > 0 ? Math.max(L.valueLen * p, L.minLen * Math.min(1, p * 4)) : 0;
  const p2 = iosEase(clamp01((p - 0.5) / 0.5));
  const t = L.track;
  const bar: DvRect | null = grown > 0.01 ? (horizontal ? {x: t.x, y: t.y, w: grown, h: L.T} : {x: t.x, y: t.y + L.length - grown, w: L.T, h: grown}) : null;

  let shortfall: DvRect | null = null;
  if (L.shortfallLen > 0 && L.targetLen !== null) {
    const tip = grown;
    const end = lerp(tip, L.targetLen, p2);
    const from = Math.max(0, tip - L.T / 2);
    if (end - tip > 0.5) {
      shortfall = horizontal ? {x: t.x + from, y: t.y, w: end - from, h: L.T} : {x: t.x, y: t.y + L.length - end, w: L.T, h: end - from};
    }
  }

  const mw = Math.max(3, L.T * 0.08);
  let marker: DvRect | null = null;
  if (L.targetLen !== null) {
    marker = horizontal
      ? {x: t.x + L.targetLen - mw / 2, y: t.y - L.overhang, w: mw, h: L.T + 2 * L.overhang}
      : {x: t.x - L.overhang, y: t.y + L.length - L.targetLen - mw / 2, w: L.T + 2 * L.overhang, h: mw};
  }
  const shortfallTotal = target !== undefined && target > value ? target - value : 0;
  return {bar, shortfall, marker, opacity: clamp01(p * 4), shown: value * p, shortfallShown: shortfallTotal * p2, p2};
};
