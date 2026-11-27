import React from 'react';
import type {CSSProperties} from 'react';
import {Glass} from '../glass/Glass';
import {SPRING} from '../motion';
import {textStyle} from '../tokens/text';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {clamp01, resolveProgress, roleFontPx, toneColor, type Timing} from './common';
import {layoutCallout, type CalloutData} from './callout';

/**
 * Props for {@link Callout}. `width`/`height` and every `at` in `data` are CANVAS px — see {@link layoutCallout}.
 * `progress` (from {@link Timing}), when given, drives every callout in the group alike and ignores each item's
 * own `delay`; omit it and pass `frame`/`start` to have the group stagger by `delay`.
 */
export interface CalloutProps extends Timing {
  /** One annotation or a group that should avoid each other. A group also avoids each other's anchor dots. */
  data: CalloutData | readonly CalloutData[];
  /** Bounds to stay inside and to measure 'auto' sides against, canvas px — usually the panel this sits over. */
  width: number;
  height: number;
  /** Distance from the dot to the label, design px. Default 36. */
  leaderLength?: number;
  /** Minimum gap between labels/dots, design px. Default 8. */
  gap?: number;
  /** Anchor dot radius, design px. Default 5. */
  dotRadius?: number;
  theme?: Theme;
  style?: CSSProperties;
}

/**
 * Annotation that attaches to any point: a dot on the anchor, a leader line that draws out to a glass label,
 * popping in on an iOS spring. Several callouts placed together are kept from overlapping each other, and from
 * sitting on top of one another's dots, by {@link layoutCallout}'s collision nudge. Pure: a function of `progress`
 * or `frame` + `start` (+ each item's own `delay`, seconds), no hooks.
 *
 * @example
 * <Callout frame={frame} start={1.6} width={panel.w} height={panel.h}
 *   data={[{at: {x: 420, y: 180}, text: 'Peak week', tone: 'positive'}]} />
 */
export const Callout: React.FC<CalloutProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const list = Array.isArray(props.data) ? props.data : [props.data];
  const L = layoutCallout({theme, data: list, width: props.width, height: props.height, leaderLength: props.leaderLength, gap: props.gap, dotRadius: props.dotRadius});
  const fontPx = roleFontPx(theme, 'caption');

  const progressFor = (delay: number): number => {
    if (props.progress !== undefined) return clamp01(props.progress);
    if (props.frame === undefined) return 1;
    return resolveProgress({frame: props.frame, start: (props.start ?? 0) + delay, response: props.response ?? SPRING.SNAPPY, fps: props.fps}, theme, props.response ?? SPRING.SNAPPY);
  };

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: L.width, height: L.height, pointerEvents: 'none', ...props.style}}>
      <svg width={L.width} height={L.height} viewBox={`0 0 ${L.width} ${L.height}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {L.items.map((it, k) => {
          const p = progressFor(list[k].delay ?? 0);
          if (p < 0.001) return null;
          const color = toneColor(theme, it.tone);
          const edge = it.side === 'top' ? {x: it.label.x + it.label.w / 2, y: it.label.y + it.label.h}
            : it.side === 'bottom' ? {x: it.label.x + it.label.w / 2, y: it.label.y}
            : it.side === 'left' ? {x: it.label.x + it.label.w, y: it.label.y + it.label.h / 2}
            : {x: it.label.x, y: it.label.y + it.label.h / 2};
          const lx = it.anchor.x + (edge.x - it.anchor.x) * p;
          const ly = it.anchor.y + (edge.y - it.anchor.y) * p;
          return (
            <g key={k} opacity={clamp01(p * 3)}>
              <circle cx={it.anchor.x} cy={it.anchor.y} r={it.dotR * Math.min(1, p * 3)} fill={color} />
              <line x1={it.anchor.x} y1={it.anchor.y} x2={lx} y2={ly} stroke={color} strokeWidth={Math.max(1.5, it.dotR * 0.4)} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      {L.items.map((it, k) => {
        const p = progressFor(list[k].delay ?? 0);
        if (p < 0.001) return null;
        const color = toneColor(theme, it.tone);
        const rise = it.side === 'top' ? (1 - p) * 10 : it.side === 'bottom' ? -(1 - p) * 10 : 0;
        return (
          <div key={k} style={{position: 'absolute', left: it.label.x, top: it.label.y + rise, width: it.label.w, height: it.label.h, opacity: clamp01((p - 0.25) / 0.75)}}>
            <Glass tier="chip" radius="md" width="100%" height="100%" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', borderLeft: `3px solid ${color}`}}>
              <span style={{...textStyle(theme, 'caption', {color: 'primary', weight: 'bold'}), fontSize: fontPx, lineHeight: 1, whiteSpace: 'nowrap'}}>{it.text}</span>
            </Glass>
          </div>
        );
      })}
    </div>
  );
};
