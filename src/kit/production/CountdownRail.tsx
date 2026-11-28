import React from 'react';
import {iosSpring} from '../motion';
import {safeRect, textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {rgba} from '../tokens/color';
import {clampUnit, railLayout, railPosition} from './logic';

export interface CountdownRailProps {
  frame: number;
  theme: Theme;
  /** The number now lit. */
  current: number;
  /** Seconds when `current` lights. */
  at: number;
  /** The number lit before; the connector draws from it. Omit on first appearance (the rail fades in). */
  prev?: number;
  /** Numbers on the rail, first to last. Default 10..1. */
  numbers?: readonly number[];
  orientation?: 'horizontal' | 'vertical';
  /** Px along the axis from the first circle's edge to the last one's (design px, scaled). Default 560 horizontal, 640 vertical. */
  length?: number;
  /** Seconds the connector takes to draw. Default 0.6. */
  dur?: number;
  /** Seconds when the rail leaves. Omit to stay. */
  exitAt?: number;
  /** Place at the top-right of the title-safe area (default true). False: the caller positions it. */
  corner?: boolean;
  style?: React.CSSProperties;
}

const DEFAULT_NUMBERS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/** A persistent ranking-countdown rail (#N..#1). One equal gap between circles; the active circle grows as the previous one shrinks, so the length never changes. */
export const CountdownRail: React.FC<CountdownRailProps> = ({frame, theme, current, at, prev, numbers = DEFAULT_NUMBERS, orientation = 'horizontal', length, dur = 0.6, exitAt, corner = true, style}) => {
  const u = unit(theme);
  const time = frame / theme.canvas.fps;
  const horizontal = orientation === 'horizontal';
  const node = 40 * u;
  const active = 64 * u;
  const lineW = 3 * u;
  const pos = railPosition(numbers, current, prev, time, at, dur, (x) => iosSpring(x * dur, dur * 0.8));
  const lay = railLayout(numbers.length, pos, (length ?? (horizontal ? 560 : 640)) * u, node, active);
  const enter = prev === undefined ? clampUnit(iosSpring(time - at, 0.5)) : 1;
  const exit = exitAt === undefined ? 0 : clampUnit(iosSpring(time - exitAt, 0.4));
  const safe = safeRect(theme, 'title');
  const place = (m: number, sz: number): React.CSSProperties => (horizontal ? {left: m, top: (active - sz) / 2, width: sz, height: sz} : {top: m, left: (active - sz) / 2, width: sz, height: sz});
  const pinned: React.CSSProperties = corner ? {position: 'absolute', top: safe.top, right: safe.right} : {position: 'relative'};
  return (
    <div style={{...pinned, width: horizontal ? lay.span : active, height: horizontal ? active : lay.span, opacity: enter * (1 - exit), ...style}}>
      {numbers.slice(0, -1).map((v, k) => {
        const m = lay.starts[k] + lay.sizes[k];
        const fill = clampUnit(pos - k);
        const along = (p: number, len: number): React.CSSProperties => (horizontal ? {left: m + p, top: (active - lineW) / 2, width: len, height: lineW} : {top: m + p, left: (active - lineW) / 2, height: len, width: lineW});
        return (
          <React.Fragment key={`c${v}`}>
            <div style={{position: 'absolute', ...along(0, lay.gap), background: rgba(theme.colors.text.tertiary, 0.45), borderRadius: lineW / 2}} />
            {fill > 0 && <div style={{position: 'absolute', ...along(0, lay.gap * fill), background: theme.colors.accent, borderRadius: lineW / 2}} />}
          </React.Fragment>
        );
      })}
      {numbers.map((v, i) => {
        const s = lay.activity[i];
        const reached = clampUnit(pos - i + 1);
        return (
          <div key={v} style={{position: 'absolute', ...place(lay.starts[i], lay.sizes[i]), borderRadius: '50%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', background: s > 0.5 ? theme.colors.accent : rgba(theme.colors.accent, 0.1 + 0.15 * reached), border: `${3 * u}px solid ${s > 0 || reached > 0.5 ? theme.colors.accent : rgba(theme.colors.text.tertiary, 0.6)}`, color: s > 0.5 ? theme.colors.onAccent : reached > 0.5 ? theme.colors.text.primary : theme.colors.text.secondary, boxShadow: s > 0.8 ? `0 0 ${18 * u}px ${rgba(theme.colors.accent, 0.5)}` : undefined, ...textStyle(theme, 'number', {weight: 'bold'}), fontSize: (22 + 10 * s) * u, lineHeight: 1}}>{v}</div>
        );
      })}
    </div>
  );
};
