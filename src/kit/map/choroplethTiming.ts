/** Staggered fill-in timing for <Choropleth> (pure, seconds). */
import {highlightProgress} from './highlight';
import type {MapShape} from './regions';
import type {ChoroplethData} from './colorScale';

export type ChoroplethOrder = 'value' | 'west-east' | 'center-out' | 'id';

/** Start delay per region: ranks spread evenly over `spread` seconds, so any number of regions takes the same time. */
export const staggerDelays = (shapes: readonly MapShape[], data: ChoroplethData, order: ChoroplethOrder, spread: number): Map<string, number> => {
  const cx = shapes.reduce((a, s) => a + s.centroid[0], 0) / (shapes.length || 1);
  const cy = shapes.reduce((a, s) => a + s.centroid[1], 0) / (shapes.length || 1);
  const key = (s: MapShape): number => {
    if (order === 'value') { const v = data[s.id]; return typeof v === 'number' && Number.isFinite(v) ? v : -Infinity; }
    if (order === 'west-east') return s.centroid[0];
    if (order === 'center-out') return Math.hypot(s.centroid[0] - cx, s.centroid[1] - cy);
    return 0;
  };
  const sorted = [...shapes].sort((a, b) => { const x = key(a), y = key(b); return x === y ? a.id.localeCompare(b.id) : x < y ? -1 : 1; });
  return new Map(sorted.map((s, i) => [s.id, sorted.length < 2 ? 0 : (i / (sorted.length - 1)) * spread]));
};

export const fillProgress = (time: number, start: number, delay: number, response: number): number => highlightProgress(time, start + delay, undefined, response);
