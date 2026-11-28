import React from 'react';
import type {CSSProperties} from 'react';
import {Glass} from '../glass';
import {useTheme} from '../tokens/ThemeProvider';
import {radius, unit} from '../tokens/helpers';
import {rgba} from '../tokens/color';
import type {Theme} from '../tokens/types';
import {Icon} from './Icon';
import type {IconTone} from './Icon';
import type {IconName} from './generated';

export interface IconTileProps {
  name: IconName;
  size?: number;
  iconSize?: number;
  tone?: IconTone;
  /** Glass surface by default; `tinted` uses the theme accent fill instead. */
  fill?: 'glass' | 'tinted';
  frame?: number;
  drawOn?: number;
  theme?: Theme;
  style?: CSSProperties;
}

/** Generic rounded-square icon surface; contains no platform or device framing. */
export const IconTile: React.FC<IconTileProps> = ({
  name,
  size,
  iconSize,
  tone = 'accent',
  fill = 'glass',
  frame,
  drawOn,
  theme,
  style,
}) => {
  const contextTheme = useTheme();
  const th = theme ?? contextTheme;
  const resolvedSize = size ?? 64 * unit(th);
  const resolvedIconSize = iconSize ?? resolvedSize * 0.48;
  const content = <Icon name={name} size={resolvedIconSize} tone={tone} drawOn={drawOn} theme={th} />;
  const surface: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: resolvedSize,
    height: resolvedSize,
    borderRadius: radius(th, 'lg'),
    ...style,
  };

  if (fill === 'glass') return <Glass tier="chip" frame={frame} theme={th} style={surface}>{content}</Glass>;
  return <div aria-hidden style={{...surface, background: rgba(th.colors.accent, 0.14)}}>{content}</div>;
};
