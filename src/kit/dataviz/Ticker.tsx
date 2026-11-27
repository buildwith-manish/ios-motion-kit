import React from 'react';
import type {CSSProperties} from 'react';
import {Glass} from '../glass/Glass';
import {rgba} from '../tokens/color';
import {radius as radiusPx, space, unit} from '../tokens/helpers';
import {textStyle} from '../tokens/text';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {fitWidth, formatValue, lerp, onToneColor, pickFormat, textWidthPx, toneColor} from './common';
import {tickerEndTime, tickerStateAt, type TickerStep} from './flip';

/** Props for {@link Ticker}. Sizes are design px (scaled to the canvas by the theme). */
export interface TickerProps {
  /** Timed ranked lists (plain JSON). The first step enters; each later step re-ranks with FLIP. */
  data: readonly TickerStep[];
  /** Current frame number, passed in. Use this or `time` or `progress`. */
  frame?: number;
  /** Current time in seconds (alternative to `frame`). */
  time?: number;
  /** Explicit 0..1 progress over the whole timeline (first step to settled end). Wins over frame/time. */
  progress?: number;
  /** Frame rate override. Default `theme.canvas.fps`. */
  fps?: number;
  /** Row width. Default 560. */
  width?: number;
  /** Row height. Default 76. */
  rowHeight?: number;
  /** Gap between rows. Default 10. */
  rowGap?: number;
  /** Spring response of the slide, seconds. Default 0.6. */
  response?: number;
  /** Seconds between rows of the first step entering. Default 0.07. */
  stagger?: number;
  /** 'glass' (default, chip tier) or 'flat' (cheap translucent fill, no backdrop blur). */
  surface?: 'glass' | 'flat';
  /** Rows with this id get an accent rank chip. */
  highlight?: string;
  theme?: Theme;
  style?: CSSProperties;
}

/**
 * Ranked list whose rows re-rank with FLIP: when a step changes the order, each row slides from its current position
 * to its new slot on an iOS spring (no teleporting, even mid-flight), the rank number counts through, and values
 * roll. New rows rise in, removed rows fade out. Good for countdowns and rankings.
 * Pure: a function of `frame`/`time` (or `progress`) and the data, no hooks.
 *
 * @example
 * <Ticker frame={frame} width={560} data={[
 *   {at: 1.0, rows: [{id: 'a', label: 'Alder', value: 4200}, {id: 'b', label: 'Birch', value: 3900}]},
 *   {at: 4.5, rows: [{id: 'b', label: 'Birch', value: 4600}, {id: 'a', label: 'Alder', value: 4200}]},
 * ]} />
 */
export const Ticker: React.FC<TickerProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const {data} = props;
  const u = unit(theme);
  const fps = props.fps ?? theme.canvas.fps;
  const response = props.response ?? 0.6;
  const stagger = props.stagger ?? 0.07;
  const W = (props.width ?? 560) * u;
  const H = (props.rowHeight ?? 76) * u;
  const gap = (props.rowGap ?? 10) * u;
  const pitch = H + gap;

  const first = data[0]?.at ?? 0;
  const end = tickerEndTime(data, response, stagger);
  const time = props.progress !== undefined ? lerp(first, end, Math.min(1, Math.max(0, props.progress))) : props.time ?? (props.frame !== undefined ? props.frame / fps : end);
  const rows = tickerStateAt(data, time, {response, stagger});
  const latest = [...data].reverse().find((st) => st.at <= time);

  // Reserve room from the widest value any step will show, so the label gets a stable measure.
  const valueFont = theme.type.body.size * u;
  const rankSize = H * 0.52;
  const padX = space(theme, 4);
  let valueW = 0;
  let slots = 0;
  data.forEach((s) => {
    slots = Math.max(slots, s.rows.length);
    s.rows.forEach((r) => {
      valueW = Math.max(valueW, fitWidth(theme, textWidthPx(theme, 'body', formatValue(r.value, pickFormat(r)), {weight: 'bold'})));
    });
  });
  const labelW = Math.max(0, W - 2 * padX - rankSize - padX - valueW - padX);
  const col = theme.colors;
  const rad = radiusPx(theme, 'lg');

  return (
    <div style={{position: 'relative', width: W, height: Math.max(0, slots * pitch - gap), ...props.style}}>
      {rows.map((s) => {
        const tone = s.row.tone ?? (props.highlight === s.id ? 'accent' : undefined);
        const content = (
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: padX, paddingRight: padX, gap: padX, direction: 'ltr'}}>
            <div style={{width: rankSize, height: rankSize, flex: 'none', borderRadius: rankSize / 2, background: tone ? toneColor(theme, tone) : rgba(col.text.primary, 0.14), color: tone ? onToneColor(theme, tone) : col.text.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center', ...textStyle(theme, 'caption', {color: tone ? onToneColor(theme, tone) : 'secondary', weight: 'bold', tabular: true}), letterSpacing: 0, fontSize: rankSize * 0.5}}>
              {Math.round(s.rank)}
            </div>
            <div style={{...textStyle(theme, 'body', {color: 'primary'}), width: labelW, flex: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.row.label}</div>
            <div style={{...textStyle(theme, 'body', {color: 'primary', weight: 'bold', tabular: true}), fontSize: valueFont, width: valueW, flex: 'none', textAlign: 'right', whiteSpace: 'nowrap'}}>{formatValue(s.value, pickFormat(s.row))}</div>
          </div>
        );
        // The row still travelling is stacked on top; leaving rows go underneath. Each row has an opaque backing so rows
        // that cross never show each other's text through the glass.
        const target = latest ? latest.rows.findIndex((r) => r.id === s.id) : -1;
        const z = target < 0 ? 0 : 1 + Math.round(Math.abs(s.slot - target) * 100);
        const wrap: CSSProperties = {position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translateY(${s.slot * pitch}px)`, opacity: s.opacity < 0.999 ? s.opacity : undefined, zIndex: z};
        const backing: CSSProperties = {position: 'absolute', inset: 0, borderRadius: rad, background: rgba(col.background.base, 0.96)};
        return (
          <div key={s.id} style={wrap}>
            <div style={backing} />
            {props.surface === 'flat' ? (
              <div style={{position: 'absolute', inset: 0, borderRadius: rad, background: rgba(col.text.primary, 0.07)}}>{content}</div>
            ) : (
              <Glass tier="chip" radius="lg" width="100%" height="100%">{content}</Glass>
            )}
          </div>
        );
      })}
    </div>
  );
};
