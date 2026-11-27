import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {unit} from './helpers';
import {useTheme} from './ThemeProvider';
import type {Theme, TypeRole, WeightRole} from './types';

/**
 * Tabular figures style patch, for money, counters and anything that must not jitter while it changes.
 * @example <span style={tabularNums()}>$12,400</span>
 */
export const tabularNums = (): CSSProperties => ({fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1'});

/** Options for textStyle(). */
export interface TextStyleOptions {
  /** Multiplies the role's size (default 1). */
  scale?: number;
  /** 'primary' | 'secondary' | 'tertiary' | 'accent' (theme colours) or any CSS colour. Default 'primary'. */
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | (string & {});
  /** Overrides the role's weight. */
  weight?: WeightRole;
  /** Force tabular figures on/off (default: the role's setting). */
  tabular?: boolean;
}

/**
 * Applies the theme's type scale to a role: family, size (scaled to the canvas), weight, line height, tracking,
 * colour and, for numbers, tabular figures.
 * @example <div style={textStyle(theme, 'title', {color: 'secondary'})}>Heading</div>
 */
export const textStyle = (theme: Theme, role: TypeRole, opts: TextStyleOptions = {}): CSSProperties => {
  const t = theme.type[role];
  const {scale = 1, color = 'primary', weight = t.weight, tabular = t.tabular} = opts;
  const c = color === 'primary' ? theme.colors.text.primary
    : color === 'secondary' ? theme.colors.text.secondary
    : color === 'tertiary' ? theme.colors.text.tertiary
    : color === 'accent' ? theme.colors.accent
    : color;
  return {
    fontFamily: theme.fonts[t.family],
    fontSize: t.size * scale * unit(theme),
    fontWeight: theme.weights[weight],
    lineHeight: t.lineHeight,
    letterSpacing: `${t.tracking}em`,
    color: c,
    margin: 0,
    ...(tabular ? tabularNums() : null),
  };
};

/** Props for <Text>. */
export interface TextProps extends TextStyleOptions {
  role?: TypeRole;
  /** Override the theme (default: nearest ThemeProvider). */
  theme?: Theme;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Themed text element using the type scale. Pure presentational.
 * @example <Text role="number" color="accent">$1,240</Text>
 */
export const Text: React.FC<TextProps> = ({role = 'body', theme, style, children, ...opts}) => {
  const ctx = useTheme();
  return <div style={{...textStyle(theme ?? ctx, role, opts), ...style}}>{children}</div>;
};
