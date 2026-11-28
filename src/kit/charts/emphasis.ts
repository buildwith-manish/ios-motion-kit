/** Chart emphasis (pure, seconds in, 0..1 out): one claim at a time, focus handed from item to item like regionHighlight. */
import {SPRING} from '../motion';
import {highlightProgress} from '../map/highlight';
import {karaokeInactiveOpacity} from '../tokens/contrast';
import type {Theme} from '../tokens/types';

/** What a step points at. A bare string matches an item id (category label / item name) or a series name; a bare number matches an item index. */
export type EmphasisFocus =
  | string
  | number
  | {
      id?: string;
      index?: number;
      series?: number | string;
      /** Inclusive item-index range [from, to]. */
      range?: readonly [number, number];
    };

export interface EmphasisStep {
  /** Seconds, on the same clock as the chart's frame / fps. The step hands over to the next step's `at`. */
  at: number;
  focus: EmphasisFocus | readonly EmphasisFocus[];
  /** Short text for the step (used by chart scenes for a DirectLabel). */
  label?: string;
  /** Spring response in seconds. Default `emphasis.response` or SPRING.SMOOTH. */
  response?: number;
}

export interface ChartEmphasis {
  steps: readonly EmphasisStep[];
  /** Opacity the unfocused items dim to. Default 0.28, never below the theme's readable floor (see emphasisFloor). */
  dimTo?: number;
  /** Default spring response for every step. */
  response?: number;
}

/** What a mark knows about one of its items. Series-level marks (a line) leave `index` undefined. */
export interface EmphasisItem {
  id?: string;
  index?: number;
  series?: number;
  seriesName?: string;
}

export const EMPHASIS_DIM_TO = 0.28;

/** Time used when a chart has no frame: everything settled (the last step in focus). */
export const EMPHASIS_SETTLED = 1e6;

export const emphasisTime = (frame: number | undefined, fps: number): number => (frame === undefined ? EMPHASIS_SETTLED : frame / fps);

/** Lowest opacity a dimmed item may have: the larger of `dimTo` and the theme's karaoke-dim token (contrast-checked). */
export const emphasisFloor = (theme: Theme, dimTo: number = EMPHASIS_DIM_TO): number => Math.min(1, Math.max(dimTo, karaokeInactiveOpacity(theme)));

const focusList = (f: EmphasisStep['focus']): readonly EmphasisFocus[] => (Array.isArray(f) ? (f as readonly EmphasisFocus[]) : [f as EmphasisFocus]);

/** True when `focus` points at `item`. Index/range constraints are ignored for series-level items (no index). */
export const focusMatches = (focus: EmphasisFocus, item: EmphasisItem): boolean => {
  if (typeof focus === 'string') return item.id === focus || item.seriesName === focus;
  if (typeof focus === 'number') return item.index === undefined ? true : item.index === focus;
  if (focus.id !== undefined && item.id !== focus.id) return false;
  if (focus.series !== undefined && (typeof focus.series === 'number' ? item.series !== focus.series : item.seriesName !== focus.series)) return false;
  if (item.index !== undefined) {
    if (focus.index !== undefined && item.index !== focus.index) return false;
    if (focus.range && (item.index < Math.min(...focus.range) || item.index > Math.max(...focus.range))) return false;
  }
  return true;
};

const sorted = (e: ChartEmphasis): EmphasisStep[] => [...e.steps].sort((a, b) => a.at - b.at);

/** 0..1 progress of step `i` (steps sorted by `at`): springs in at `at`, springs out when the next step begins. */
export const emphasisStepProgress = (time: number, e: ChartEmphasis, i: number): number => {
  const s = sorted(e);
  const step = s[i];
  if (!step) return 0;
  return highlightProgress(time, step.at, s[i + 1]?.at, step.response ?? e.response ?? SPRING.SMOOTH);
};

/** How dimmed the unfocused items are, 0..1: the sum of step progress capped at 1, so it holds through a handoff (no flash). */
export const emphasisDimAt = (time: number, e: ChartEmphasis): number => {
  let sum = 0;
  for (let i = 0; i < e.steps.length; i++) sum += emphasisStepProgress(time, e, i);
  const d = Math.min(1, sum);
  return d > 0.999 ? 1 : d < 0.001 ? 0 : d;
};

/** Focus 0..1 of one item: the strongest matching step. */
export const emphasisFocusAt = (time: number, e: ChartEmphasis, item: EmphasisItem): number => {
  const s = sorted(e);
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    if (!focusList(s[i].focus).some((f) => focusMatches(f, item))) continue;
    best = Math.max(best, emphasisStepProgress(time, e, i));
  }
  return best;
};

/** Opacity of one item: 1 with no emphasis yet, easing to the floor when unfocused. */
export const dimmedOpacity = (floor: number, dim: number, focus: number): number => {
  const o = 1 - dim * (1 - focus) * (1 - floor);
  return Math.round(o * 1e4) / 1e4;
};

export const emphasisOpacity = (theme: Theme, e: ChartEmphasis | undefined, time: number, item: EmphasisItem): number => {
  if (!e || e.steps.length === 0) return 1;
  return dimmedOpacity(emphasisFloor(theme, e.dimTo), emphasisDimAt(time, e), emphasisFocusAt(time, e, item));
};

/** Index (in `at` order) of the step in charge at `time`, or -1 before the first. */
export const activeStepAt = (time: number, e: ChartEmphasis): number => {
  const s = sorted(e);
  let k = -1;
  for (let i = 0; i < s.length; i++) if (time >= s[i].at) k = i;
  return k;
};

/** Item indices (into a list of ids) an emphasis step points at; for scenes that attach labels to the focused item. */
export const stepTargets = (step: EmphasisStep, ids: readonly string[]): number[] => {
  const out: number[] = [];
  ids.forEach((id, index) => {
    if (focusList(step.focus).some((f) => focusMatches(f, {id, index}))) out.push(index);
  });
  return out;
};
