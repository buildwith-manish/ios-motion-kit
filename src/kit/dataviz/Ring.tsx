import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {SPRING} from '../motion';
import {rgba} from '../tokens/color';
import {unit} from '../tokens/helpers';
import {textStyle} from '../tokens/text';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {clamp01, fitWidth, formatValue, pickFormat, resolveProgress, textWidthPx, toneColor, type NumberFormat, type Timing, type Tone} from './common';

/**
 * Plain-JSON data for a {@link Ring}.
 * @example {value: 72, suffix: '%', label: 'Funded'}
 */
export interface RingData extends NumberFormat {
  /** Value shown in the centre; the arc covers value / max of the circle. */
  value: number;
  /** Value that fills the whole ring. Default 100. */
  max?: number;
  /** Small caption under the number. */
  label?: string;
  /** Arc colour. Default 'accent'. */
  tone?: Tone;
}

/** Props for {@link Ring}. Sizes are design px (scaled to the canvas by the theme). */
export interface RingProps extends Timing {
  data: RingData;
  /** Outer diameter. Default 320. */
  size?: number;
  /** Stroke width. Default 28. */
  stroke?: number;
  /** Where the arc starts, degrees clockwise from 3 o'clock. Default -90 (12 o'clock). */
  startAngle?: number;
  /** Direction of the arc. Default true. */
  clockwise?: boolean;
  /** Multiplies the centre number's size (it is also shrunk to fit the hole). Default 1. */
  valueScale?: number;
  /** Show the rolling centre value. Default true. */
  showValue?: boolean;
  /** Replaces the centre content. */
  children?: ReactNode;
  theme?: Theme;
  style?: CSSProperties;
}

/**
 * Progress ring on an iOS spring: rounded caps, a soft track, and a centre value that rolls up with the arc.
 * The centre number is sized from the ring and shrunk to fit the hole. Pure: a function of `progress` or
 * `frame` + `start` (seconds), no hooks.
 *
 * @example
 * <Ring frame={frame} start={1} size={320} data={{value: 72, suffix: '%', label: 'Funded'}} />
 */
export const Ring: React.FC<RingProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const {data} = props;
  const u = unit(theme);
  const p = resolveProgress(props, theme, props.response ?? SPRING.GENTLE);
  const D = (props.size ?? 320) * u;
  const sw = (props.stroke ?? 28) * u;
  const r = (D - sw) / 2;
  const c = D / 2;
  const C = 2 * Math.PI * r;
  const max = Math.max(data.max ?? 100, 1e-9);
  const frac = clamp01(data.value / max) * p;
  const start = props.startAngle ?? -90;
  const cw = props.clockwise ?? true;
  const col = theme.colors;
  const fmt = pickFormat(data);

  // Centre text: sized from the ring, shrunk until the widest value it will show fits the hole.
  const hole = Math.max(0, D - 2 * sw);
  const base = theme.type.number.size * u;
  let fontPx = Math.min(base, D * 0.24) * (props.valueScale ?? 1);
  const widest = fitWidth(theme, textWidthPx(theme, 'number', formatValue(data.value, fmt), {fontPx}));
  if (widest > hole * 0.84) fontPx *= (hole * 0.84) / widest;
  const labelPx = Math.max(12 * u, Math.min(fontPx * 0.36, theme.type.body.size * u));

  const transform = cw ? `rotate(${start} ${c} ${c})` : `matrix(1 0 0 -1 0 ${D}) rotate(${-start} ${c} ${c})`;
  const opacity = clamp01(p * 4);

  return (
    <div style={{position: 'relative', width: D, height: D, ...props.style}}>
      <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={rgba(col.text.primary, 0.1)} strokeWidth={sw} />
        {frac > 0.0005 ? (
          <circle cx={c} cy={c} r={r} fill="none" stroke={toneColor(theme, data.tone ?? 'accent')} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform={transform} opacity={opacity} />
        ) : null}
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'ltr', opacity}}>
        {props.children ?? (
          <>
            {props.showValue === false ? null : (
              <div style={{...textStyle(theme, 'number', {color: 'primary', tabular: true}), fontSize: fontPx, lineHeight: 1.05, whiteSpace: 'nowrap'}}>{formatValue(data.value * p, fmt)}</div>
            )}
            {data.label ? <div style={{...textStyle(theme, 'caption', {color: 'secondary'}), fontSize: labelPx, lineHeight: 1.2, marginTop: fontPx * 0.06, whiteSpace: 'nowrap'}}>{data.label}</div> : null}
          </>
        )}
      </div>
    </div>
  );
};
