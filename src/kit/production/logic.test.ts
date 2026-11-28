import {describe, expect, it} from 'vitest';
import {
  chapterFillEnd, chapterNodeCenters, lowerThirdPhase, platformTiming, railLayout, railPosition, sourceFooterState, tapPress, tapsDone, RAIL_GAP_MIN, RAIL_GAP_MAX,
} from './logic';

describe('production logic', () => {
  it('spaces chapter nodes evenly', () => {
    expect(chapterNodeCenters(4, 100, 900)).toEqual([100, 400, 700, 1000]);
    expect(chapterNodeCenters(1, 0, 200)).toEqual([100]);
    expect(() => chapterNodeCenters(0, 0, 100)).toThrow();
  });
  it('fills the roadmap line up to the current chapter', () => {
    const c = chapterNodeCenters(4, 0, 300);
    expect(chapterFillEnd(c, 2, 0.5)).toBe(100);
    expect(chapterFillEnd(c, 9, 1)).toBe(300);
    expect(chapterFillEnd(c, 0, 1)).toBe(0);
  });
  it('keeps the rail span constant while the active circle moves', () => {
    const a = railLayout(10, 2, 400, 40, 64);
    const b = railLayout(10, 6.4, 400, 40, 64);
    expect(a.span).toBeCloseTo(b.span, 6);
    expect(a.gap).toBeGreaterThanOrEqual(RAIL_GAP_MIN);
    expect(a.gap).toBeLessThanOrEqual(RAIL_GAP_MAX);
    expect(a.sizes[2]).toBe(64);
  });
  it('moves the rail position from prev to current', () => {
    const nums = [10, 9, 8];
    expect(railPosition(nums, 9, 10, 0, 1, 1)).toBe(0);
    expect(railPosition(nums, 9, 10, 1.5, 1, 1)).toBeCloseTo(0.5, 6);
    expect(railPosition(nums, 8, 9, 5, 1, 1)).toBe(2);
    expect(railPosition(nums, 9, undefined, 0, 1, 1)).toBe(1);
  });
  it('picks and cross-fades footer sources', () => {
    const items = [{at: 5, text: 'B'}, {at: 1, text: 'A'}];
    expect(sourceFooterState(items, 0.5).current).toBeUndefined();
    expect(sourceFooterState(items, 1.1).current?.text).toBe('A');
    const s = sourceFooterState(items, 5.175, 0.35);
    expect(s.current?.text).toBe('B');
    expect(s.previous?.text).toBe('A');
    expect(s.mix).toBeCloseTo(0.5, 6);
  });
  it('has taps inside each platform demo', () => {
    for (const p of ['youtube', 'facebook', 'instagram'] as const) {
      const t = platformTiming(p);
      expect(t.taps.every((x) => x > t.ui && x < t.end)).toBe(true);
      expect(tapsDone(t, 0)).toBe(-1);
      expect(tapsDone(t, t.end)).toBe(t.taps.length - 1);
    }
    expect(platformTiming('facebook').taps).toHaveLength(2);
  });
  it('presses and releases a tap', () => {
    expect(tapPress(1, 2)).toBe(0);
    expect(tapPress(2.135, 2)).toBeCloseTo(1, 1);
    expect(tapPress(3, 2)).toBeCloseTo(0, 6);
  });
  it('shows and hides a lower third', () => {
    expect(lowerThirdPhase(0, 1, 5)).toBe(0);
    expect(lowerThirdPhase(3, 1, 5)).toBeGreaterThan(0.95);
    expect(lowerThirdPhase(9, 1, 5)).toBeLessThan(0.05);
  });
});
