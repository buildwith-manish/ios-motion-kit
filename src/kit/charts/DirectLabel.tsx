import React from 'react';
import {unit} from '../tokens/helpers';
import {clamp01, roleFontPx, springProgress, textWidthPx, toneColor, type DvPoint, type DvRect, type Tone} from '../dataviz/common';
import {nudgeRects} from '../dataviz/layout';
import {formatNumber} from '../text/format';
import {isMissing} from './stack';
import {useChart} from './Chart';

export type LabelSide = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export interface LabelBox {
  /** The mark point the label belongs to, px. */
  anchor: DvPoint;
  w: number;
  h: number;
  side?: Exclude<LabelSide, 'auto'>;
}

export interface PlacedLabel {
  rect: DvRect;
  /** True when collision avoidance pushed the label off its preferred spot (draw a leader). */
  moved: boolean;
}

/**
 * Places each label beside its anchor on `side`, then separates overlaps with the same rectangle nudging the callouts use.
 * Anchors are fixed obstacles, so a label never covers a data point. Deterministic.
 */
export const directLabelLayout = (boxes: readonly LabelBox[], bounds: DvRect, o: {gap?: number} = {}): PlacedLabel[] => {
  const gap = o.gap ?? 6;
  const pref = boxes.map((b) => {
    const side = b.side ?? 'top';
    const {anchor: a, w, h} = b;
    const x = side === 'left' ? a.x - gap - w : side === 'right' ? a.x + gap : a.x - w / 2;
    const y = side === 'top' ? a.y - gap - h : side === 'bottom' ? a.y + gap : a.y - h / 2;
    return {x, y, w, h};
  });
  const obstacles = boxes.map((b) => ({x: b.anchor.x - 3, y: b.anchor.y - 3, w: 6, h: 6, fixed: true}));
  const placed = nudgeRects([...pref, ...obstacles], {gap: gap / 2, bounds});
  return pref.map((p, i) => {
    const r = placed[i];
    return {rect: r, moved: Math.abs(r.x - p.x) > 0.5 || Math.abs(r.y - p.y) > 0.5};
  });
};

export interface DirectLabelItem {
  /** Category index and series (default 0). */
  index: number;
  series?: number;
  /** Text. Default: the value in the chart's yFormat. */
  text?: string;
  /** Prefix the series name. */
  name?: boolean;
  side?: LabelSide;
  tone?: Tone;
  /** Seconds (same clock as frame / fps) the label appears. Default 0. */
  at?: number;
}

export interface DirectLabelProps {
  labels: readonly DirectLabelItem[];
  response?: number;
}

/** Value / name labels attached to mark points, kept apart from each other and from the points. Inside <Chart>. */
export const DirectLabel: React.FC<DirectLabelProps> = ({labels, response = 0.5}) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const font = roleFontPx(theme, 'caption');
  const time = c.frame === undefined ? 1e6 : c.frame / c.fps;
  const items = labels.flatMap((l) => {
    const s = spec.series[l.series ?? 0];
    const v = s?.values[l.index];
    if (!s || v === undefined || isMissing(v)) return [];
    const text = l.text ?? `${l.name ? `${s.name} ` : ''}${formatNumber(v, spec.yFormat ?? 'int')}`;
    const pt = layout.point(l.index, v);
    const side = l.side && l.side !== 'auto' ? l.side : layout.horizontal ? 'right' : v < 0 ? 'bottom' : 'top';
    return [{l, text, pt, side, w: textWidthPx(theme, 'caption', text, {weight: 'bold'}) + 4 * u, h: font * 1.3}];
  });
  const {plot} = layout;
  const pad = font * 1.5;
  const bounds = {x: plot.x - pad, y: plot.y - pad, w: plot.w + 2 * pad, h: plot.h + 2 * pad};
  const placed = directLabelLayout(items.map((i) => ({anchor: i.pt, w: i.w, h: i.h, side: i.side})), bounds, {gap: 6 * u});
  return (
    <g>
      {items.map((it, k) => {
        const p = springProgress(time - (it.l.at ?? 0), response);
        if (p <= 0) return null;
        const r = placed[k];
        const color = toneColor(theme, it.l.tone ?? 'primary');
        return (
          <g key={`dl${k}`} opacity={clamp01(p)}>
            {r.moved ? <line x1={it.pt.x} y1={it.pt.y} x2={r.rect.x + r.rect.w / 2} y2={r.rect.y + r.rect.h / 2} stroke={color} strokeOpacity={0.5} strokeWidth={Math.max(1, 1.5 * u)} /> : null}
            <text x={r.rect.x + r.rect.w / 2} y={r.rect.y + r.rect.h / 2} textAnchor="middle" dominantBaseline="central"
              style={{fontFamily: theme.fonts.body, fontSize: font, fontWeight: theme.weights.bold, fill: color, fontVariantNumeric: 'tabular-nums'}}>{it.text}</text>
          </g>
        );
      })}
    </g>
  );
};
