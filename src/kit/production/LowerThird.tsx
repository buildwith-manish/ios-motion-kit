import React from 'react';
import {Glass} from '../glass';
import {radius, safeRect, space, textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {lowerThirdPhase} from './logic';

export interface LowerThirdProps {
  frame: number;
  /** Seconds. */
  start: number;
  /** Seconds. Omit to stay. */
  end?: number;
  theme: Theme;
  text: string;
  /** Smaller second line. */
  detail?: string;
}

/** A glass strip at the bottom of the title-safe area (above the source footer). Text via props. */
export const LowerThird: React.FC<LowerThirdProps> = ({frame, start, end, theme, text, detail}) => {
  const p = lowerThirdPhase(frame / theme.canvas.fps, start, end);
  if (p < 0.005) return null;
  const safe = safeRect(theme, 'title');
  const u = unit(theme);
  return (
    <div style={{position: 'absolute', left: safe.left, width: safe.width, bottom: safe.bottom + space(theme, 10), display: 'flex', justifyContent: 'flex-start', opacity: p, transform: `translateY(${(1 - p) * 28 * u}px)`, color: theme.colors.text.primary}}>
      <Glass tier="pill" theme={theme} style={{maxWidth: '100%', boxSizing: 'border-box', padding: `${space(theme, 3)}px ${space(theme, 6)}px`, borderRadius: radius(theme, 'lg')}}>
        <div style={{...textStyle(theme, 'body', {weight: 'bold'}), lineHeight: 1.2}}>{text}</div>
        {detail && <div style={{...textStyle(theme, 'caption', {color: 'secondary'}), marginTop: space(theme, 1)}}>{detail}</div>}
      </Glass>
    </div>
  );
};
