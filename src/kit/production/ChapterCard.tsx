import React from 'react';
import {Glass} from '../glass';
import {radius, safeRect, space, textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {rgba} from '../tokens/color';
import {chapterFillEnd, chapterNodeCenters, clampUnit, springAt} from './logic';

export interface ChapterItem {
  title: string;
  /** One line saying what the viewer is about to see. */
  sub?: string;
}

export interface ChapterCardProps {
  frame: number;
  /** Seconds. */
  start: number;
  theme: Theme;
  chapters: readonly ChapterItem[];
  /** The current chapter, 1-based. */
  current: number;
  /** Card length in seconds; it leaves over the last 0.4 s. Default 2.5. */
  duration?: number;
  /** Word before the number. Default "Chapter". */
  kicker?: string;
}

/** Roadmap-strip chapter card: finished chapters filled, the current one lit, title over a ghost numeral. Pure function of frame. */
export const ChapterCard: React.FC<ChapterCardProps> = ({frame, start, theme, chapters, current, duration = 2.5, kicker = 'Chapter'}) => {
  if (current < 1 || current > chapters.length) throw new RangeError(`ChapterCard: current ${current} is outside 1..${chapters.length}`);
  const t = frame / theme.canvas.fps - start;
  const u = unit(theme);
  const safe = safeRect(theme, 'title');
  const ch = chapters[current - 1];
  const nn = String(current).padStart(2, '0');
  const total = String(chapters.length).padStart(2, '0');
  const out = springAt(t, duration - 0.4, 0.35);
  const rise = (at: number) => springAt(t, at, 0.5);
  const centers = chapterNodeCenters(chapters.length, safe.width * 0.12, safe.width * 0.76);
  const node = 52 * u;
  const stripY = safe.height * 0.82;
  const fillEnd = chapterFillEnd(centers, current - 1, springAt(t, 0.3, 0.6));
  const step = chapters.length > 1 ? centers[1] - centers[0] : safe.width * 0.76;
  return (
    <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, color: theme.colors.text.primary, opacity: 1 - out, transform: `translateX(${-out * 120 * u}px)`}}>
      <div style={{position: 'absolute', left: '10%', width: '80%', top: '12%', height: '48%', borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(theme.colors.accent, 0.18)}, transparent)`, opacity: rise(0.1)}} />
      <div style={{position: 'absolute', left: 0, width: '100%', top: '2%', textAlign: 'center', fontFamily: theme.fonts.display, fontWeight: theme.weights.bold, fontSize: 560 * u, lineHeight: 1, color: 'transparent', WebkitTextStroke: `${2 * u}px ${theme.colors.accent}`, opacity: 0.18 * rise(0.0), transform: `scale(${1.08 - 0.08 * rise(0.05)})`, whiteSpace: 'nowrap'}}>{nn}</div>
      <div style={{position: 'absolute', left: 0, width: '100%', top: '33%', textAlign: 'center', ...textStyle(theme, 'caption', {weight: 'bold', color: 'secondary'}), letterSpacing: 8 * u, textTransform: 'uppercase', opacity: rise(0.2)}}>
        {kicker} <span style={{color: theme.colors.accentText}}>{nn}</span> of {total}
      </div>
      <div style={{position: 'absolute', left: '4%', width: '92%', top: '39%', textAlign: 'center', ...textStyle(theme, 'display', {weight: 'bold'}), lineHeight: 1.05, opacity: rise(0.35), transform: `translateY(${(1 - rise(0.35)) * 30 * u}px)`}}>{ch.title}</div>
      <div style={{position: 'absolute', left: `calc(50% - ${130 * u * rise(0.6)}px)`, width: 260 * u * rise(0.6), top: '60%', height: 4 * u, borderRadius: 2 * u, background: theme.colors.accent}} />
      {ch.sub && <div style={{position: 'absolute', left: '6%', width: '88%', top: '63%', textAlign: 'center', ...textStyle(theme, 'body', {color: 'secondary'}), opacity: rise(0.75)}}>{ch.sub}</div>}
      <div style={{position: 'absolute', left: centers[0], top: stripY + node / 2 - 1.5 * u, width: centers[centers.length - 1] - centers[0], height: 3 * u, borderRadius: 2 * u, background: rgba(theme.colors.text.primary, 0.14), opacity: rise(0.2)}} />
      <div style={{position: 'absolute', left: centers[0], top: stripY + node / 2 - 1.5 * u, width: fillEnd - centers[0], height: 3 * u, borderRadius: 2 * u, background: theme.colors.accent}} />
      {chapters.map((c, i) => {
        const pop = rise(0.15 + i * 0.1);
        const active = i === current - 1;
        const done = i < current - 1;
        const lit = active ? springAt(t, 0.75, 0.5) : done ? 1 : 0;
        const ring = active ? clampUnit(((t - 0.9) % 1.1) / 1.1) : -1;
        return (
          <React.Fragment key={`${i}-${c.title}`}>
            <div style={{position: 'absolute', left: centers[i] - node / 2, top: stripY, width: node, height: node, opacity: pop, transform: `scale(${0.4 + 0.6 * pop + (active ? 0.16 * lit : 0)})`}}>
              {ring >= 0 && t > 0.9 && <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `${2 * u}px solid ${theme.colors.accent}`, opacity: 0.5 * (1 - ring), transform: `scale(${1 + ring})`}} />}
              <Glass tier="chip" theme={theme} radius={radius(theme, 'pill')} style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active || done ? rgba(theme.colors.accent, active ? 0.25 + 0.75 * lit : 0.2) : undefined, border: `${3 * u}px solid ${active || done ? theme.colors.accent : rgba(theme.colors.text.tertiary, 0.6)}`, boxSizing: 'border-box', ...textStyle(theme, 'caption', {weight: 'bold'}), color: active && lit > 0.5 ? theme.colors.onAccent : done ? theme.colors.accentText : theme.colors.text.secondary}}>{String(i + 1).padStart(2, '0')}</Glass>
            </div>
            <div style={{position: 'absolute', left: centers[i] - step * 0.45, width: step * 0.9, top: stripY + node + space(theme, 3), textAlign: 'center', ...textStyle(theme, 'caption', {weight: active ? 'bold' : 'regular', color: active ? 'primary' : 'secondary'}), opacity: (active ? 1 : done ? 0.85 : 0.55) * rise(0.3 + i * 0.1)}}>{c.title}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
