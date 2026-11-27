import React, {useId} from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {iosSpring} from '../motion';
import {useTheme} from '../tokens/ThemeProvider';

export interface ChromaSplitProps {
  frame: number;
  fps: number;
  /** Seconds at which the RGB offset begins. Omit to keep the effect off. */
  eventTime?: number;
  /** Maximum channel offset in logical pixels; capped at 3. */
  amount?: number;
  response?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

export const chromaSplitOffset = (time: number, eventTime: number | undefined, amount: number, response: number): number => {
  if (eventTime === undefined || time < eventTime) return 0;
  return amount * (1 - iosSpring(time - eventTime, response));
};

/** RGB channel separation for a hard hit; it is off unless an event time is provided. */
export const ChromaSplit: React.FC<ChromaSplitProps> = ({
  frame,
  fps,
  eventTime,
  amount = 3,
  response,
  style,
  children,
}) => {
  const theme = useTheme();
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) throw new RangeError('ChromaSplit: frame and fps must be finite, and fps must be > 0');
  if (!Number.isFinite(amount) || amount < 0 || amount > 3) throw new RangeError('ChromaSplit: amount must be between 0 and 3');
  if (eventTime !== undefined && !Number.isFinite(eventTime)) throw new RangeError('ChromaSplit: eventTime must be finite');
  const spring = response ?? theme.motion.spring.SNAPPY;
  if (!Number.isFinite(spring) || spring <= 0) throw new RangeError('ChromaSplit: response must be > 0');
  const offset = chromaSplitOffset(frame / fps, eventTime, amount, spring);
  const id = useId().replace(/:/g, '');
  const filterId = `kit-chroma-${id}`;

  return (
    <div style={{position: 'relative', width: '100%', height: '100%', ...style}}>
      {offset > 0 && (
        <svg aria-hidden style={{position: 'absolute', width: 0, height: 0}}>
          <defs>
            <filter id={filterId} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
              <feColorMatrix in="SourceGraphic" result="red" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
              <feOffset in="red" dx={offset} result="red-offset" />
              <feColorMatrix in="SourceGraphic" result="green" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" />
              <feColorMatrix in="SourceGraphic" result="blue" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" />
              <feOffset in="blue" dx={-offset} result="blue-offset" />
              <feBlend in="red-offset" in2="green" mode="screen" result="red-green" />
              <feBlend in="red-green" in2="blue-offset" mode="screen" />
            </filter>
          </defs>
        </svg>
      )}
      <div style={{position: 'relative', width: '100%', height: '100%', filter: offset > 0 ? `url(#${filterId})` : undefined}}>
        {children}
      </div>
    </div>
  );
};
