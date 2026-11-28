import {describe, expect, it} from 'vitest';
import {createTheme} from '../tokens';
import {bandScale, linearScale, linearTicks, niceDomain, niceStep, parseTime, timeTicks} from './scales';
import {stackExtent, stackValues} from './stack';
import {barPath, barRects, chartLayout, growRect, lineSegments, prefixSamples, seriesPoints, type ChartSpec} from './geometry';

const theme = createTheme();
const spec = (o: Partial<ChartSpec> = {}): ChartSpec => ({x: ['A', 'B', 'C'], series: [{name: 's', values: [1, 2, 3]}], ...o});

describe('scales', () => {
  it('linear maps and inverts; zero span centres', () => {
    const s = linearScale([0, 10], [100, 200]);
    expect(s(5)).toBe(150);
    expect(s.invert(150)).toBe(5);
    expect(linearScale([3, 3], [0, 10])(3)).toBe(5);
  });
  it('nice domain and ticks', () => {
    expect(niceStep(100, 4)).toBe(20);
    expect(niceDomain(0, 97, 4)).toEqual([0, 100]);
    expect(niceDomain(5, 5)).toEqual([4.4, 5.6]);
    expect(niceDomain(0, 0)).toEqual([0, 1]);
    expect(linearTicks(0, 1, 4)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(linearTicks(-10, 10, 4)).toEqual([-10, -5, 0, 5, 10]);
    expect(linearTicks(2, 2)).toEqual([2]);
  });
  it('band scale', () => {
    const b = bandScale(4, [0, 400], 0, 0);
    expect(b.step).toBe(100);
    expect(b.center(0)).toBe(50);
    expect(bandScale(0, [0, 100]).step).toBe(0);
  });
  it('time ticks are month aligned', () => {
    const t = timeTicks(parseTime('2025-01-01'), parseTime('2026-01-01'), 5);
    expect(t.length).toBeLessThanOrEqual(5);
    expect(t.every((v) => new Date(v).getUTCDate() === 1)).toBe(true);
  });
});

describe('stack', () => {
  it('stacks positives up and negatives down, gaps take no space', () => {
    const st = stackValues([[1, -1, 2], [2, -2, null], [3, 1, 1]]);
    expect(st[0][0]).toEqual({y0: 0, y1: 1, missing: false});
    expect(st[1][0]).toEqual({y0: 1, y1: 3, missing: false});
    expect(st[2][0]).toEqual({y0: 3, y1: 6, missing: false});
    expect(st[1][1]).toEqual({y0: -1, y1: -3, missing: false});
    expect(st[2][1]).toEqual({y0: 0, y1: 1, missing: false});
    expect(st[1][2].missing).toBe(true);
    expect(st[2][2]).toEqual({y0: 2, y1: 3, missing: false});
    expect(stackExtent(st)).toEqual([-3, 6]);
    expect(stackExtent(stackValues([[null]]))).toBeNull();
  });
});

describe('layout + geometry', () => {
  it('value axis puts larger values higher; gaps stay null', () => {
    const l = chartLayout(theme, spec({series: [{name: 's', values: [1, null, 3]}]}), 800, 400);
    const pts = seriesPoints(l, [1, null, 3]);
    expect(pts[1]).toBeNull();
    expect(pts[2]!.y).toBeLessThan(pts[0]!.y);
    expect(pts[2]!.x).toBeGreaterThan(pts[0]!.x);
  });
  it('single point, all-equal, empty, negatives', () => {
    expect(() => chartLayout(theme, spec({x: ['A'], series: [{name: 's', values: [5]}]}), 600, 300)).not.toThrow();
    const eq = chartLayout(theme, spec({zero: false, series: [{name: 's', values: [4, 4, 4]}]}), 600, 300);
    expect(eq.value.domain[0]).toBeLessThan(4);
    expect(eq.value.domain[1]).toBeGreaterThan(4);
    const empty = chartLayout(theme, {x: [], series: []}, 600, 300);
    expect(empty.value.domain).toEqual([0, 1]);
    const neg = chartLayout(theme, spec({series: [{name: 's', values: [-3, -1, -2]}]}), 600, 300);
    expect(neg.value.domain[1]).toBe(0);
    expect(neg.baseline).toBeLessThanOrEqual(neg.plot.y + 0.001);
  });
  it('line segments split at gaps and prefix by arc length', () => {
    const segs = lineSegments([{x: 0, y: 0}, {x: 10, y: 0}, null, {x: 20, y: 0}], 'linear');
    expect(segs.length).toBe(2);
    expect(segs[0].total).toBe(10);
    expect(segs[1].total).toBe(0);
    expect(prefixSamples(segs[0], 5)[1]).toEqual({x: 5, y: 0});
    const smooth = lineSegments([{x: 0, y: 0}, {x: 1, y: 5}, {x: 2, y: 5}, {x: 3, y: 10}], 'smooth');
    const ys = smooth[0].samples.map((q) => q.y);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10);
  });
  it('grouped and stacked bars', () => {
    const two: ChartSpec = spec({series: [{name: 'a', values: [2, 4, null]}, {name: 'b', values: [1, -1, 3]}]});
    const g = barRects(chartLayout(theme, two, 800, 400), two);
    expect(g[0][2]).toBeNull();
    expect(g[0][0]!.x).toBeLessThan(g[1][0]!.x);
    expect(g[1][1]!.dir).toBe('down');
    const st: ChartSpec = {...two, stacked: true};
    const ls = chartLayout(theme, st, 800, 400);
    const r = barRects(ls, st);
    expect(r[0][0]!.x).toBe(r[1][0]!.x);
    expect(r[0][0]!.cap).toBeNull();
    expect(r[1][0]!.cap).toBe('up');
    expect(r[0][1]!.cap).toBe('up');
    expect(r[1][1]!.cap).toBe('down');
    expect(r[1][0]!.y + r[1][0]!.h).toBeCloseTo(r[0][0]!.y, 5);
  });
  it('horizontal bars grow rightwards; growRect anchors at baseline', () => {
    const h: ChartSpec = spec({orientation: 'horizontal'});
    const r = barRects(chartLayout(theme, h, 800, 400), h);
    expect(r[0][2]!.w).toBeGreaterThan(r[0][0]!.w);
    expect(r[0][0]!.dir).toBe('right');
    const up = {x: 0, y: 10, w: 20, h: 40, series: 0, index: 0, value: 1, cap: 'up' as const, dir: 'up' as const};
    expect(growRect(up, 0.5)).toEqual({x: 0, w: 20, h: 20, y: 30});
    expect(growRect(up, 0).h).toBe(0);
  });
  it('bar path radius clamps; null cap is square', () => {
    expect(barPath({x: 0, y: 0, w: 10, h: 50}, null, 99)).not.toContain('A');
    expect(barPath({x: 0, y: 0, w: 10, h: 50}, 'up', 99)).toContain('A5.00 5.00');
  });
});
