/** Pure helpers for the production components. No React, no frame reads: everything takes time in seconds. */
import {iosSpring} from '../motion';

export const clampUnit = (v: number): number => Math.min(1, Math.max(0, v));

/** Spring progress 0..1 of an event at `at` seconds. */
export const springAt = (time: number, at: number, response = 0.5): number => clampUnit(iosSpring(time - at, response));

export type EndCardPlatform = 'youtube' | 'facebook' | 'instagram';
export const END_CARD_PLATFORMS: readonly EndCardPlatform[] = ['youtube', 'facebook', 'instagram'];

/** Seconds from the card start. `taps` are the touch moments; `open` is when the result opens; `end` is the full demo length. */
export interface PlatformTiming {
  ui: number;
  taps: readonly number[];
  open: number;
  end: number;
}

export const platformTiming = (platform: EndCardPlatform): PlatformTiming => {
  switch (platform) {
    case 'youtube':
      return {ui: 0.7, taps: [2.2], open: 2.4, end: 4};
    case 'facebook':
      return {ui: 0.7, taps: [1.5, 2.3], open: 2.4, end: 4};
    case 'instagram':
      return {ui: 0.7, taps: [2.2], open: 2.4, end: 4};
  }
};

/** 0 -> 1 -> 0 over `len` seconds after `at`: the press depth of a tap. */
export const tapPress = (time: number, at: number, len = 0.27): number => {
  const p = clampUnit((time - at) / len);
  return Math.sin(Math.PI * p);
};

/** Touch point travel 0 (far) -> 1 (on target) between `from` and `at`. */
export const fingerTravel = (time: number, from: number, at: number): number => clampUnit((time - from) / Math.max(1e-6, at - from));

/** The tap with the highest index already pressed at `time`, or -1. */
export const tapsDone = (timing: PlatformTiming, time: number): number => timing.taps.reduce((n, t, i) => (time >= t ? i : n), -1);

export interface FooterItem {
  at: number;
  text: string;
}
export interface FooterState {
  current?: FooterItem;
  previous?: FooterItem;
  /** Cross-fade 0..1 toward `current`. */
  mix: number;
}

/** The item that started most recently is shown; it cross-fades from the one before it. Empty text clears the footer. */
export const sourceFooterState = (items: readonly FooterItem[], time: number, fade = 0.35): FooterState => {
  const sorted = [...items].sort((a, b) => a.at - b.at);
  let idx = -1;
  sorted.forEach((it, i) => {
    if (time >= it.at) idx = i;
  });
  if (idx < 0) return {mix: 0};
  const current = sorted[idx];
  return {current, previous: idx > 0 ? sorted[idx - 1] : undefined, mix: clampUnit((time - current.at) / Math.max(1e-6, fade))};
};

/** Evenly spaced chapter node centres across `width` (first and last node centred at the ends). One chapter sits in the middle. */
export const chapterNodeCenters = (count: number, left: number, width: number): number[] => {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('chapterNodeCenters needs at least one chapter');
  if (count === 1) return [left + width / 2];
  return Array.from({length: count}, (_, i) => left + (width * i) / (count - 1));
};

/** Roadmap fill: x where the filled line ends for chapter `current` (0-based) at `progress` 0..1. */
export const chapterFillEnd = (centers: readonly number[], current: number, progress: number): number => {
  const i = Math.min(Math.max(current, 0), centers.length - 1);
  return centers[0] + (centers[i] - centers[0]) * clampUnit(progress);
};

export interface RailLayout {
  gap: number;
  sizes: number[];
  starts: number[];
  span: number;
  /** 0..1 activity of each circle (1 on the active one). */
  activity: number[];
}

export const RAIL_GAP_MIN = 14;
export const RAIL_GAP_MAX = 24;

/** Equal-gap rail layout. `pos` is the fractional index of the active circle; sizes always add up to the same span. */
export const railLayout = (count: number, pos: number, length: number, node: number, active: number): RailLayout => {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('railLayout needs at least one number');
  const room = length + active;
  const gap = count > 1 ? Math.min(Math.max((room - (count - 1) * node - active) / (count - 1), RAIL_GAP_MIN), RAIL_GAP_MAX) : 0;
  const activity = Array.from({length: count}, (_, i) => Math.max(1 - Math.abs(i - pos), 0));
  const sizes = activity.map((s) => node + (active - node) * s);
  const starts: number[] = [];
  sizes.reduce((x, s, i) => {
    starts[i] = x;
    return x + s + gap;
  }, 0);
  const span = sizes.reduce((a, b) => a + b, 0) + Math.max(count - 1, 0) * gap;
  return {gap, sizes, starts, span, activity};
};

/** Fractional index of the active rail circle: moves from `prev` to `current` over `dur` seconds from `at`. */
export const railPosition = (numbers: readonly number[], current: number, prev: number | undefined, time: number, at: number, dur: number, ease: (x: number) => number = (x) => x): number => {
  const idx = (v: number) => Math.max(numbers.indexOf(v), 0);
  const from = prev === undefined ? idx(current) : idx(prev);
  return from + (idx(current) - from) * ease(clampUnit((time - at) / Math.max(1e-6, dur)));
};

/** Lower third visibility 0..1: springs in at `start`, out at `end` (seconds). */
export const lowerThirdPhase = (time: number, start: number, end?: number, response = 0.5): number => {
  const enter = springAt(time, start, response);
  const exit = end === undefined ? 0 : springAt(time, end, response);
  return clampUnit(enter * (1 - exit));
};
