import {beforeAll, describe, expect, it} from 'vitest';
const modPath = '../../scripts/kit_review_merge.mjs';
type Merge = (i: unknown) => {markdown: string; counts: Record<string, number | null>; total: number};
let real: Merge = () => {
  throw new Error('not loaded');
};
beforeAll(async () => {
  real = ((await import(/* @vite-ignore */ modPath)) as {mergeReview: Merge}).mergeReview;
});

const contrast = {compositions: [{id: 'A', findings: [{status: 'fail', firstTime: 1, lastTime: 2.5, worst: {text: 'Hello', ratio: 3.21, foreground: '#fff', background: '#ccc', fontSize: 40}}]}]};
const safe = {compositions: [{id: 'A', findings: []}]};
const motion = {compositions: [{id: 'A', stretches: [{start: 3, end: 6, duration: 3}]}]};
const layout = {compositions: [{id: 'A', findings: [{firstTime: 2, lastTime: 2, worst: {rule: 'min-text', label: 'caption', detail: '24px < 28px'}}]}]};

describe('mergeReview', () => {
  it('counts flags per report and totals them', () => {
    const r = real({comp: 'A', times: [1, 3], reports: {contrast, safeArea: safe, motion, layout}});
    expect(r.counts).toEqual({contrast: 1, safeArea: 0, motion: 1, layout: 1});
    expect(r.total).toBe(3);
    expect(r.markdown).toContain('## Safe area: clean');
    expect(r.markdown).toContain('3.21:1');
    expect(r.markdown).toContain('| static | 0:03.00-0:06.00 |');
  });
  it('a report that did not run is "not run", never clean; loudness is omitted unless requested', () => {
    const r = real({comp: 'A', times: [1], reports: {contrast}, skipped: {safeArea: 'exit 1'}});
    expect(r.counts.safeArea).toBeNull();
    expect(r.markdown).toContain('not run (exit 1)');
    expect(r.markdown).not.toContain('Loudness');
  });
  it('flags only off-target loudness results and escapes pipes', () => {
    const r = real({comp: 'A', times: [1], reports: {loudness: {target: {integrated: -14}, results: [{file: 'a|b.wav', ok: false, integrated: -20}, {file: 'ok.wav', ok: true}]}}});
    expect(r.counts.loudness).toBe(1);
    expect(r.markdown).toContain('a|b.wav');
  });
  it('filters by composition id', () => {
    const r = real({comp: 'B', times: [1], reports: {contrast}});
    expect(r.counts.contrast).toBe(0);
  });
});
