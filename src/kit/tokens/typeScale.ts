import type {CSSProperties} from 'react';
import {unit} from './helpers';
import type {Theme, TypeScaleEntry, TypeScaleRole} from './types';

/**
 * The type scale in design px (1080 short side; multiply by unit(theme) for the canvas). Floors follow
 * scripts/kit_layout_lint.config.json: text >= 28 (minText), label >= 36 (minLabel), hero 120..200 (hero.min/max).
 * The older Theme.type roles (display, title, body, caption, number) are unchanged.
 */
export const TYPE_SCALE: Readonly<Record<TypeScaleRole, TypeScaleEntry>> = {
  hero: {size: 160, min: 120, max: 200, lineHeight: 1, tracking: -0.03, family: 'display', weight: 'bold', tabular: true},
  number: {size: 96, min: 72, max: 120, lineHeight: 1, tracking: -0.02, family: 'display', weight: 'bold', tabular: true},
  figure: {size: 72, min: 48, max: 96, lineHeight: 1.05, tracking: -0.02, family: 'display', weight: 'bold', tabular: true},
  title: {size: 56, min: 40, max: 72, lineHeight: 1.1, tracking: -0.02, family: 'display', weight: 'bold', tabular: false},
  stat: {size: 48, min: 36, max: 64, lineHeight: 1.1, tracking: -0.01, family: 'display', weight: 'bold', tabular: true},
  label: {size: 36, min: 36, max: 44, lineHeight: 1.2, tracking: 0, family: 'body', weight: 'regular', tabular: false},
  caption: {size: 30, min: 28, max: 36, lineHeight: 1.25, tracking: 0.01, family: 'body', weight: 'regular', tabular: false},
  footnote: {size: 28, min: 28, max: 30, lineHeight: 1.25, tracking: 0.01, family: 'body', weight: 'regular', tabular: false},
};

/** The theme's type scale, or the kit default for themes built before typeScale existed. */
export const typeScaleOf = (theme: Theme): Readonly<Record<TypeScaleRole, TypeScaleEntry>> => theme.typeScale ?? TYPE_SCALE;

/**
 * CSS for a scale role: family, size (design px * unit), weight, line height, tracking, tabular figures where the role has them.
 * @example <div style={scaleStyle(theme, 'hero')}>$2,480</div>
 */
export const scaleStyle = (theme: Theme, role: TypeScaleRole, opts: {scale?: number; color?: string; tabular?: boolean} = {}): CSSProperties => {
  const t = typeScaleOf(theme)[role];
  const {scale = 1, color = theme.colors.text.primary, tabular = t.tabular} = opts;
  return {
    fontFamily: theme.fonts[t.family], fontSize: t.size * scale * unit(theme), fontWeight: theme.weights[t.weight], lineHeight: t.lineHeight,
    letterSpacing: `${t.tracking}em`, color, margin: 0, ...(tabular ? {fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1'} : null),
  };
};
