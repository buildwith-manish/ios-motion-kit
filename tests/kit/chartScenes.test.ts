import {describe, expect, it} from 'vitest';
import {CANVAS, createTheme} from '../../src/kit/tokens';
import {chartHeadlineLayout, fitClaim, layoutSceneSequence, validateChartScene, chartItemIds, chartSceneSource, type SceneDefinition} from '../../src/kit/scenes';
import {CHART_HEADLINE_DEMO_SCENES} from '../../src/kit/scenes/ChartHeadlineDemo';

const bar = (o: Record<string, unknown> = {}): SceneDefinition => ({
  id: 's', type: 'chartHeadline', duration: 8, title: 'A claim',
  chart: {kind: 'bar', data: [{label: 'A', value: 1}, {label: 'B', value: 2}]},
  ...o,
}) as SceneDefinition;
const msg = (s: SceneDefinition): string => { try { validateChartScene(s); } catch (e) { return (e as Error).message; } return ''; };

describe('chartHeadline validation', () => {
  it('accepts the demo scenes and lays them out', () => {
    CHART_HEADLINE_DEMO_SCENES.forEach(validateChartScene);
    expect(layoutSceneSequence(CHART_HEADLINE_DEMO_SCENES).duration).toBeGreaterThan(17);
  });
  it('requires the claim', () => {
    expect(msg(bar({title: '  '}))).toMatch(/states the claim/);
  });
  it('rejects empty, non-finite and duplicate data', () => {
    expect(msg(bar({chart: {kind: 'bar', data: []}}))).toMatch(/data is empty/);
    expect(msg(bar({chart: {kind: 'bar', data: [{label: 'A', value: NaN}]}}))).toMatch(/finite/);
    expect(msg(bar({chart: {kind: 'bar', data: [{label: 'A', value: 1}, {label: 'A', value: 2}]}}))).toMatch(/listed twice/);
    expect(msg(bar({chart: {kind: 'pie', data: []}}))).toMatch(/unknown chart kind|data is empty/);
  });
  it('rejects unknown ids with the known ones listed', () => {
    const m = msg(bar({emphasis: {steps: [{at: 1, focus: 'Z'}]}}));
    expect(m).toMatch(/"Z"/);
    expect(m).toMatch(/known: A, B/);
    expect(msg(bar({emphasis: {steps: [{at: 1, focus: 5}]}}))).toMatch(/outside 0\.\.1/);
    expect(msg(bar({emphasis: {steps: [{at: 1, focus: {range: [0, 9]}}]}}))).toMatch(/range/);
    expect(msg(bar({labels: [{item: 'Q'}]}))).toMatch(/label 1 item "Q"/);
    expect(msg(bar({compare: [{from: 'A', to: 'A'}]}))).toMatch(/two different items/);
  });
  it('rejects bad times and unsupported markers', () => {
    expect(msg(bar({emphasis: {steps: [{at: 99, focus: 'A'}]}}))).toMatch(/within the scene/);
    expect(msg(bar({emphasis: {steps: []}}))).toMatch(/at least one step/);
    expect(msg(bar({chart: {kind: 'slope', items: [{name: 'A', from: 1, to: 2}], leftLabel: 'a', rightLabel: 'b'}, compare: [{from: 'A', to: 'A'}]}))).toMatch(/bar and line/);
  });
  it('checks source ids against the manifest', () => {
    expect(msg(bar({sourceIds: ['cpi']}))).toMatch(/manifest/);
    const manifest = {datasets: [{id: 'cpi', sourceName: 'BLS CPI', dataYear: 2025, units: 'medians'}]};
    expect(msg(bar({sourceIds: ['nope'], manifest}))).toMatch(/"nope"/);
    expect(msg(bar({sourceIds: ['cpi'], manifest}))).toBe('');
    expect(chartSceneSource(bar({sourceIds: ['cpi'], manifest}) as never)).toBe('Source: BLS CPI, 2025, medians');
  });
  it('line charts match x values and series names', () => {
    const line = {kind: 'line', x: ['Q1', 'Q2'], series: [{name: 'Rent', values: [1, 2]}]};
    expect(chartItemIds(line as never)).toEqual(['Q1', 'Q2']);
    expect(msg(bar({chart: line, emphasis: {steps: [{at: 1, focus: 'Rent'}]}}))).toBe('');
    expect(msg(bar({chart: {...line, series: [{name: 'Rent', values: [1]}]}}))).toMatch(/1 values for 2/);
  });
});

describe('chartHeadline layout (title-safe)', () => {
  const inside = (r: {x: number; y: number; w: number; h: number}, s: {x: number; y: number; w: number; h: number}) =>
    r.x >= s.x - 0.5 && r.y >= s.y - 0.5 && r.x + r.w <= s.x + s.w + 0.5 && r.y + r.h <= s.y + s.h + 0.5;
  for (const [name, canvas] of [['landscape', CANVAS.landscape30], ['portrait', CANVAS.vertical30]] as const) {
    it(`${name}: every block sits inside the title-safe rect and nothing overlaps`, () => {
      const theme = createTheme({canvas});
      const L = chartHeadlineLayout(theme, {title: 'Austin rents rose fastest while Memphis barely moved at all this year', subtitle: 'Median asking rent'});
      [L.title, L.subtitle!, L.chart, L.caption, L.source].forEach((r) => expect(inside(r, L.safe)).toBe(true));
      expect(L.title.y + L.title.h).toBeLessThanOrEqual(L.subtitle!.y + 0.5);
      expect(L.subtitle!.y + L.subtitle!.h).toBeLessThanOrEqual(L.chart.y + 0.5);
      expect(L.chart.y + L.chart.h).toBeLessThanOrEqual(L.caption.y + 0.5);
      expect(L.caption.y + L.caption.h).toBeLessThanOrEqual(L.source.y + 0.5);
      expect(L.chart.h).toBeGreaterThan(L.safe.h * 0.3);
    });
  }
  it('shrinks a long claim to fit its line budget', () => {
    const short = fitClaim('Short claim', 800, 60, 30, 2);
    const long = fitClaim('x'.repeat(120), 800, 60, 30, 2);
    expect(short.fontPx).toBe(60);
    expect(long.fontPx).toBeLessThan(60);
    expect(long.lines).toBeLessThanOrEqual(2);
  });
});
