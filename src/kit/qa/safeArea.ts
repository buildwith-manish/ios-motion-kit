/** Pure safe-area rules. Rectangles are canvas px. No React, no Node APIs. */
import {createTheme} from '../tokens/createTheme';
import {safeRect} from '../tokens/helpers';
import type {ThemeName} from '../tokens/themes';
import type {SafeKind, SafeRect, Theme} from '../tokens/types';

/**
 * An axis-aligned box in canvas px.
 * @example const box: Box = {left: 0, top: 0, right: 100, bottom: 40};
 */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * How far (px, >= 0) a box sticks out past each side of the safe area.
 * @example const worst = (o: Overshoot) => Math.max(o.left, o.top, o.right, o.bottom);
 */
export type Overshoot = Box;

/**
 * Safe rectangle for a composition: the composition's own `theme` prop when it has one, otherwise a built-in theme.
 * The canvas always comes from the composition, so one theme serves every size.
 * @example qaSafeRect({width: 1080, height: 1920, fps: 60}, undefined, 'midnight', 'title')
 */
export const qaSafeRect = (
  canvas: {width: number; height: number; fps: number},
  themeProp: unknown,
  fallback: ThemeName = 'midnight',
  kind: SafeKind = 'title',
): {rect: SafeRect; themeName: string; fromProps: boolean} => {
  const {width, height, fps} = canvas;
  const own = themeProp as Partial<Theme> | undefined;
  const fromProps = !!own?.safeArea?.landscape && !!own?.safeArea?.portrait;
  const theme: Theme = fromProps ? {...(own as Theme), canvas: {width, height, fps}} : createTheme({canvas: {width, height, fps}}, fallback);
  return {rect: safeRect(theme, kind), themeName: theme.name, fromProps};
};

/**
 * Compares a visible box with the safe area. Returns null when it is inside (within `tolerance` px) or entirely off
 * the canvas (nothing on screen); otherwise the overshoot per side. Only the on-canvas part is measured, and a box
 * cut by the canvas edge always counts as outside.
 * @example safeOvershoot({left: 6, top: 500, right: 200, bottom: 540}, rect, {width: 1920, height: 1080}) // {left: 90, ...}
 */
export const safeOvershoot = (box: Box, safe: SafeRect, canvas: {width: number; height: number}, tolerance = 2): Overshoot | null => {
  const left = Math.max(box.left, 0);
  const top = Math.max(box.top, 0);
  const right = Math.min(box.right, canvas.width);
  const bottom = Math.min(box.bottom, canvas.height);
  if (right - left < 1 || bottom - top < 1) return null;
  const o = {
    left: Math.max(0, safe.left - left),
    top: Math.max(0, safe.top - top),
    right: Math.max(0, right - (safe.left + safe.width)),
    bottom: Math.max(0, bottom - (safe.top + safe.height)),
  };
  return Math.max(o.left, o.top, o.right, o.bottom) > tolerance ? o : null;
};

/**
 * One observation of a problem at one sampled time.
 * @example const hit: Hit<null> = {key: 'title', time: 1, severity: 4, data: null};
 */
export interface Hit<T> {
  /** Identifies "the same thing" across samples. */
  key: string;
  time: number;
  /** Larger is worse; the worst observation is kept. */
  severity: number;
  data: T;
}

/**
 * All observations of one problem, merged.
 * @example const once = (f: Finding<unknown>) => f.samples === 1;
 */
export interface Finding<T> {
  key: string;
  firstTime: number;
  lastTime: number;
  samples: number;
  worstTime: number;
  worst: T;
}

/**
 * Merges per-sample hits into one finding per key. `samples === 1` usually means a transient (mid-animation) state.
 * @example mergeHits([{key: 'a', time: 1, severity: 4, data: {}}, {key: 'a', time: 2, severity: 9, data: {}}])
 */
export const mergeHits = <T>(hits: ReadonlyArray<Hit<T>>): Array<Finding<T>> => {
  const map = new Map<string, Finding<T> & {severity: number; times: Set<number>}>();
  for (const h of hits) {
    const f = map.get(h.key);
    if (!f) {
      map.set(h.key, {key: h.key, firstTime: h.time, lastTime: h.time, samples: 1, worstTime: h.time, worst: h.data, severity: h.severity, times: new Set([h.time])});
      continue;
    }
    f.firstTime = Math.min(f.firstTime, h.time);
    f.lastTime = Math.max(f.lastTime, h.time);
    f.times.add(h.time);
    f.samples = f.times.size;
    if (h.severity > f.severity) Object.assign(f, {severity: h.severity, worst: h.data, worstTime: h.time});
  }
  return [...map.values()].map(({severity: _s, times: _t, ...f}) => f).sort((a, b) => a.firstTime - b.firstTime || a.key.localeCompare(b.key));
};
