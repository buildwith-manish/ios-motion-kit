import {midnight, themes, type ThemeName} from './themes';
import type {DeepPartial, Theme} from './types';

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const merge = (base: unknown, over: unknown): unknown => {
  if (over === undefined) return base;
  if (!isPlain(base) || !isPlain(over)) return over;
  const out: Record<string, unknown> = {...base};
  for (const key of Object.keys(over)) {
    const value = over[key];
    if (value !== undefined) out[key] = merge(base[key], value);
  }
  return out;
};

/**
 * Builds a theme by deep-merging `overrides` over a base theme (default: midnight). Plain objects merge key by
 * key; arrays (beziers) are replaced whole. Throws on an invalid canvas.
 * @example const brand = createTheme({colors: {accent: '#FF7A00'}, canvas: CANVAS.vertical60, name: 'brand'});
 */
export const createTheme = (overrides: DeepPartial<Theme> = {}, base: Theme | ThemeName = midnight): Theme => {
  const b = typeof base === 'string' ? themes[base] : base;
  const t = merge(b, overrides) as Theme;
  const {fps, width, height} = t.canvas;
  if (!(fps > 0) || !(width > 0) || !(height > 0)) {
    throw new Error(`createTheme: invalid canvas ${JSON.stringify(t.canvas)}`);
  }
  return t;
};

/**
 * Looks up a built-in theme by name (plain-object access for non-React code).
 * @example getTheme('mono').colors.accent
 */
export const getTheme = (name: ThemeName): Theme => themes[name];
