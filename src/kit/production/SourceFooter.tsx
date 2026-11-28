import React from 'react';
import {safeRect, space, textStyle} from '../tokens';
import type {Theme} from '../tokens';
import {sourceFooterState, type FooterItem} from './logic';

export interface SourceFooterProps {
  frame: number;
  theme: Theme;
  /** {at (seconds), text}. The newest started item shows and cross-fades from the one before. Empty text clears. Build text with sourceLine(). */
  items: readonly FooterItem[];
  /** Word before the text. Default "Source: ". Empty string for none. */
  label?: string;
  /** Cross-fade seconds. Default 0.35. */
  fade?: number;
}

/** One fixed spot (bottom-left of the title-safe area), one size: sources never wander around the frame. */
export const SourceFooter: React.FC<SourceFooterProps> = ({frame, theme, items, label = 'Source: ', fade = 0.35}) => {
  const state = sourceFooterState(items, frame / theme.canvas.fps, fade);
  const safe = safeRect(theme, 'title');
  const line = (item: FooterItem | undefined, o: number) =>
    item && item.text && o > 0.01 ? (
      <div style={{position: 'absolute', left: 0, bottom: 0, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.85 * o, ...textStyle(theme, 'caption', {color: 'secondary'})}}>
        {label}{item.text}
      </div>
    ) : null;
  if (!state.current) return null;
  return (
    <div style={{position: 'absolute', left: safe.left, width: safe.width, bottom: safe.bottom, height: space(theme, 8), pointerEvents: 'none'}}>
      {line(state.previous, 1 - state.mix)}
      {line(state.current, state.mix)}
    </div>
  );
};
