import React from 'react';
import type {CSSProperties, SVGProps} from 'react';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {ICON_COMPONENTS} from './generated';
import type {IconName} from './generated';

export type IconTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'positive' | 'warning' | 'negative' | 'onAccent';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'width' | 'height' | 'stroke' | 'strokeWidth' | 'color'> {
  name: IconName;
  /** Logical canvas pixels; the default scales with the theme's canvas. */
  size?: number;
  /** Theme color role. Defaults to the accent graphic color. */
  tone?: IconTone;
  /** Explicit stroke width in canvas pixels. Defaults to an optical size-aware width. */
  stroke?: number;
  /** Draw progress in the range 0..1. Animate this with iosSpring() and the passed frame time. */
  drawOn?: number;
  theme?: Theme;
  /** Supply a label for a meaningful icon; unlabeled icons are hidden from assistive technology. */
  label?: string;
}

const toneColor = (theme: Theme, tone: IconTone): string => {
  if (tone === 'primary' || tone === 'secondary' || tone === 'tertiary') return theme.colors.text[tone];
  if (tone === 'positive' || tone === 'warning' || tone === 'negative') return theme.colors.semantic[tone];
  if (tone === 'onAccent') return theme.colors.onAccent;
  return theme.colors.accent;
};

/** Render a token-colored inline Lucide icon. No icon reads the Remotion clock. */
export const Icon: React.FC<IconProps> = ({
  name,
  size,
  tone = 'accent',
  stroke,
  drawOn,
  theme,
  label,
  style,
  ...svgProps
}) => {
  const contextTheme = useTheme();
  const th = theme ?? contextTheme;
  const resolvedSize = size ?? 24 * (Math.min(th.canvas.width, th.canvas.height) / 1080);
  if (!Number.isFinite(resolvedSize) || resolvedSize <= 0) throw new RangeError('Icon: size must be finite and > 0');
  if (stroke !== undefined && (!Number.isFinite(stroke) || stroke <= 0)) throw new RangeError('Icon: stroke must be finite and > 0');
  if (drawOn !== undefined && (!Number.isFinite(drawOn) || drawOn < 0 || drawOn > 1)) throw new RangeError('Icon: drawOn must be between 0 and 1');
  const Shape = ICON_COMPONENTS[name];
  const strokeWidth = stroke ?? 2 * Math.sqrt(resolvedSize / 24);
  const drawStyle: CSSProperties = drawOn === undefined
    ? {}
    : {strokeDasharray: 1000, strokeDashoffset: 1000 * (1 - drawOn)};

  return (
    <Shape
      {...svgProps}
      width={resolvedSize}
      height={resolvedSize}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{color: toneColor(th, tone), overflow: 'visible', ...drawStyle, ...style}}
    />
  );
};
