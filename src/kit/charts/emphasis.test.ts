import {describe, expect, it} from 'vitest';
import {createTheme} from '../tokens';
import {karaokeInactiveOpacity} from '../tokens/contrast';
import {activeStepAt, dimmedOpacity, emphasisDimAt, emphasisFloor, emphasisFocusAt, emphasisOpacity, emphasisTime, focusMatches, stepTargets, type ChartEmphasis} from './emphasis';
import {bracketGeometry, compareText} from './CompareMarker';
import {directLabelLayout} from './DirectLabel';
import {anyOverlap} from '../dataviz/layout';

const theme = createTheme();
const em: ChartEmphasis = {steps: [{at: 1, focus: 'B'}, {at: 3, focus: {index: 2}}]};
const A = {id: 'A', index: 0};
const B = {id: 'B', index: 1};
const C = {id: 'C', index: 2};

describe('emphasis focus matching', () => {
  it('matches id, index, series and range', () => {
    expect(focusMatches('B', B)).toBe(true);
    expect(focusMatches('B', A)).toBe(false);
    expect(focusMatches(2, C)).toBe(true);
    expect(focusMatches(2, A)).toBe(false);
    expect(focusMatches({series: 'Rent'}, {index: 0, seriesName: 'Rent'})).toBe(true);
    expect(focusMatches({series: 1}, {index: 0, series: 0})).toBe(false);
    expect(focusMatches({range: [1, 2]}, B)).toBe(true);
    expect(focusMatches({range: [2, 1]}, A)).toBe(false);
  });
  it('ignores index constraints for series-level items', () => {
    expect(focusMatches({index: 2, series: 0}, {series: 0, seriesName: 'x'})).toBe(true);
  });
  it('lists the indices a step points at', () => {
    expect(stepTargets({at: 0, focus: ['A', {index: 2}]}, ['A', 'B', 'C'])).toEqual([0, 2]);
  });
});

describe('emphasis timing', () => {
  it('does nothing before the first step', () => {
    expect(emphasisDimAt(0.5, em)).toBe(0);
    expect(emphasisOpacity(theme, em, 0.5, A)).toBe(1);
  });
  it('settles: focused item 1, others at the floor', () => {
    const floor = emphasisFloor(theme);
    expect(emphasisOpacity(theme, em, 2.9, B)).toBe(1);
    expect(emphasisOpacity(theme, em, 2.9, A)).toBeCloseTo(floor, 3);
    expect(emphasisDimAt(2.9, em)).toBe(1);
  });
  it('hands focus over: both between 0 and 1 mid-handoff, dim holds', () => {
    const t = 3.1;
    const fb = emphasisFocusAt(t, em, B);
    const fc = emphasisFocusAt(t, em, C);
    expect(fb).toBeGreaterThan(0);
    expect(fb).toBeLessThan(1);
    expect(fc).toBeGreaterThan(0);
    expect(fc).toBeLessThan(1);
    expect(emphasisDimAt(t, em)).toBeGreaterThan(0.9);
    expect(emphasisOpacity(theme, em, 10, C)).toBe(1);
    expect(emphasisOpacity(theme, em, 10, B)).toBeCloseTo(emphasisFloor(theme), 3);
  });
  it('is deterministic and order independent', () => {
    const rev: ChartEmphasis = {steps: [...em.steps].reverse()};
    expect(emphasisOpacity(theme, rev, 3.1, B)).toBe(emphasisOpacity(theme, em, 3.1, B));
    expect(emphasisOpacity(theme, em, 3.1, B)).toBe(emphasisOpacity(theme, em, 3.1, B));
  });
  it('active step and settled time', () => {
    expect(activeStepAt(0, em)).toBe(-1);
    expect(activeStepAt(1, em)).toBe(0);
    expect(activeStepAt(5, em)).toBe(1);
    expect(emphasisOpacity(theme, em, emphasisTime(undefined, 30), C)).toBe(1);
  });
});

describe('dim math', () => {
  it('floors dimTo at the theme token so dimmed items stay readable', () => {
    const token = karaokeInactiveOpacity(theme);
    expect(emphasisFloor(theme, 0.1)).toBe(token);
    expect(emphasisFloor(theme)).toBe(Math.max(0.28, token));
    expect(emphasisFloor(theme, 0.9)).toBe(0.9);
  });
  it('interpolates opacity between 1 and the floor', () => {
    expect(dimmedOpacity(0.4, 0, 0)).toBe(1);
    expect(dimmedOpacity(0.4, 1, 0)).toBe(0.4);
    expect(dimmedOpacity(0.4, 1, 1)).toBe(1);
    expect(dimmedOpacity(0.4, 0.5, 0)).toBe(0.7);
  });
});

describe('compare marker', () => {
  it('writes ratios and differences', () => {
    expect(compareText(1000, 2100)).toBe('2.1x');
    expect(compareText(1000, 2000)).toBe('2.0x');
    expect(compareText(0, 5)).toBeNull();
    expect(compareText(1000, 3300, 'diff', 'usd')).toBe('+$2,300');
    expect(compareText(3300, 1000, 'diff', 'usd')).toMatch(/2,300/);
  });
  it('bracket sits above the taller item; arrow is a straight line', () => {
    const b = bracketGeometry({x: 100, y: 300}, {x: 300, y: 100}, {offset: 20});
    expect(b.path[1].y).toBe(80);
    expect(b.path[2].y).toBe(80);
    expect(b.label.x).toBe(200);
    const a = bracketGeometry({x: 0, y: 0}, {x: 10, y: 20}, {offset: 5, arrow: true});
    expect(a.path).toHaveLength(2);
    expect(a.label).toEqual({x: 5, y: 10});
  });
});

describe('direct label layout', () => {
  const bounds = {x: 0, y: 0, w: 400, h: 300};
  it('keeps colliding labels apart and off their anchors', () => {
    const boxes = [
      {anchor: {x: 100, y: 150}, w: 80, h: 20},
      {anchor: {x: 120, y: 152}, w: 80, h: 20},
      {anchor: {x: 140, y: 150}, w: 80, h: 20},
    ];
    const out = directLabelLayout(boxes, bounds, {gap: 6});
    expect(anyOverlap(out.map((o) => o.rect))).toBe(false);
    out.forEach((o, i) => {
      const a = boxes[i].anchor;
      const r = o.rect;
      expect(a.x >= r.x && a.x <= r.x + r.w && a.y >= r.y && a.y <= r.y + r.h).toBe(false);
    });
    expect(out.some((o) => o.moved)).toBe(true);
  });
  it('leaves a lone label where it was asked and inside bounds', () => {
    const [p] = directLabelLayout([{anchor: {x: 200, y: 100}, w: 60, h: 20, side: 'top'}], bounds, {gap: 6});
    expect(p.moved).toBe(false);
    expect(p.rect).toEqual({x: 170, y: 74, w: 60, h: 20});
    const [q] = directLabelLayout([{anchor: {x: 5, y: 5}, w: 60, h: 20, side: 'top'}], bounds);
    expect(q.rect.x).toBeGreaterThanOrEqual(0);
    expect(q.rect.y).toBeGreaterThanOrEqual(0);
  });
  it('is deterministic', () => {
    const boxes = [{anchor: {x: 50, y: 50}, w: 50, h: 20}, {anchor: {x: 60, y: 52}, w: 50, h: 20}];
    expect(directLabelLayout(boxes, bounds)).toEqual(directLabelLayout(boxes, bounds));
  });
});
