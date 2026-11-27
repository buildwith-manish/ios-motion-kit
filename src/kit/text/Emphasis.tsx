import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {iosSpring} from '../motion';
import {rgba} from '../tokens/color';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {detectDirection} from './metrics';
import type {TextDirection} from './types';

/** Props for {@link Emphasis}. */
export interface EmphasisProps {
  children: ReactNode;
  /** Current frame number (passed in). */
  frame: number;
  /** Second the highlight starts drawing. Default 0. */
  start?: number;
  /** 'underline' (animated line) or 'glass' (soft translucent highlight). Default 'underline'. */
  variant?: 'underline' | 'glass';
  /** Highlight colour (any CSS colour). Default theme.colors.accent. */
  color?: string;
  /** Colour the text turns to as the highlight lands (e.g. theme.colors.text.primary). Omit to leave unchanged. */
  textColor?: string;
  /** Spring response in seconds. Default theme.motion.spring.SMOOTH. */
  response?: number;
  /** Underline thickness in em. Default 0.09. */
  thickness?: number;
  /** Direction the highlight draws in. Default 'auto' (from the text if it is a string, else 'ltr'). */
  direction?: TextDirection;
  theme?: Theme;
  /** Frame rate override (default theme.canvas.fps). */
  fps?: number;
  style?: CSSProperties;
}

/**
 * Inline highlight for a word or number: an underline that draws in on an iOS spring, or a soft glass-like
 * highlight that wipes in behind the text. Draws from the start edge (right edge in RTL). Pure: a function of `frame`.
 * Works inside <RevealText renderWord> or any JSX.
 *
 * @example
 * <p>Rent is <Emphasis frame={frame} start={1.2}>41%</Emphasis> of income</p>
 */
export const Emphasis: React.FC<EmphasisProps> = ({children, frame, start = 0, variant = 'underline', color, textColor, response, thickness = 0.09, direction = 'auto', theme, fps, style}) => {
  const ctx = useTheme();
  const th = theme ?? ctx;
  const time = frame / (fps ?? th.canvas.fps);
  const p = iosSpring(time - start, response ?? th.motion.spring.SMOOTH);
  const c = color ?? th.colors.accent;
  const dir = direction === 'auto' ? (typeof children === 'string' ? detectDirection(children) : 'ltr') : direction;
  const fromEnd = dir === 'rtl';
  const reveal = `inset(0 ${fromEnd ? 0 : (1 - p) * 100}% 0 ${fromEnd ? (1 - p) * 100 : 0}%`;
  const mix = textColor && p > 0 ? {color: textColor} : null;

  const layer: CSSProperties =
    variant === 'underline'
      ? {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: `${-0.08 - thickness / 2}em`,
          height: `${thickness}em`,
          borderRadius: '999px',
          background: c,
          transformOrigin: fromEnd ? '100% 50%' : '0% 50%',
          transform: `scaleX(${p})`,
          opacity: Math.min(1, p * 4),
        }
      : {
          position: 'absolute',
          inset: '-0.06em -0.2em',
          borderRadius: '0.3em',
          background: `linear-gradient(135deg, ${rgba(c, 0.38)}, ${rgba(c, 0.16)})`,
          boxShadow: `inset 0 0 0 1px ${rgba('#FFFFFF', 0.22)}, inset 0 1px 0 ${rgba('#FFFFFF', 0.3)}, 0 0.2em 0.6em ${rgba(c, 0.18)}`,
          clipPath: `${reveal} round 0.3em)`,
          opacity: Math.min(1, p * 3),
        };

  return (
    <span style={{position: 'relative', display: 'inline-block', isolation: 'isolate', ...mix, ...style}}>
      <span aria-hidden style={{...layer, zIndex: -1}} />
      {children}
    </span>
  );
};
