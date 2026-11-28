import React from 'react';
import {Glass} from '../glass';
import {radius, safeRect, space, textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {springAt} from './logic';

export interface DisclaimerCardProps {
  frame: number;
  start: number;
  theme: Theme;
  /** e.g. "General information, not financial or tax advice." */
  text: string;
  title?: string;
  /** Seconds; leaves over the last 0.4 s when given. */
  duration?: number;
}

/** A calm centred glass card for a disclaimer. Text comes from props only. */
export const DisclaimerCard: React.FC<DisclaimerCardProps> = ({frame, start, theme, text, title, duration}) => {
  const t = frame / theme.canvas.fps - start;
  const safe = safeRect(theme, 'title');
  const inP = springAt(t, 0.1, 0.5);
  const out = duration === undefined ? 0 : springAt(t, duration - 0.4, 0.35);
  return (
    <div data-kit-role="hero" style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.text.primary, opacity: inP * (1 - out), transform: `translateY(${(1 - inP) * 24 * unit(theme)}px)`}}>
      <Glass tier="card" theme={theme} style={{maxWidth: '92%', width: 1000 * unit(theme), boxSizing: 'border-box', padding: space(theme, 8), borderRadius: radius(theme, 'xl'), textAlign: 'center'}}>
        {title && <div style={{...textStyle(theme, 'caption', {weight: 'bold', color: 'secondary'}), letterSpacing: 6 * unit(theme), textTransform: 'uppercase', marginBottom: space(theme, 3)}}>{title}</div>}
        <div style={{...textStyle(theme, 'body', {weight: 'bold'}), lineHeight: 1.25}}>{text}</div>
      </Glass>
    </div>
  );
};
