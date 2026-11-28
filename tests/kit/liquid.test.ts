import {describe, expect, it} from 'vitest';
import {glassStyle} from '../../src/kit/glass/glassStyle';
import {liquidStyle, tintFor} from '../../src/kit/glass/liquid';
import {themes} from '../../src/kit/tokens/themes';

describe('liquid glass', () => {
  for (const name of ['midnight', 'light', 'mono'] as const) {
    const th = themes[name];
    it(`${name}: tintFor is pure, bounded and position dependent`, () => {
      const a = tintFor(th, {x: 0.2, y: 0.2});
      expect(tintFor(th, {x: 0.2, y: 0.2})).toEqual(a);
      expect(a.alpha).toBeLessThanOrEqual(th.colors.orbMaxAlpha * 0.35);
      expect(tintFor(th, {x: 0.8, y: 0.9}).color).not.toEqual(a.color);
      expect(tintFor(th, {x: -4, y: 9}).color).toMatch(/^rgba\(/);
    });
    it(`${name}: liquidStyle is deterministic, has no second blur and moves with the light`, () => {
      const a = liquidStyle(th, undefined, {lightAngle: 315});
      expect(liquidStyle(th, undefined, {lightAngle: 315})).toEqual(a);
      expect(String(a.surface.backdropFilter).match(/blur\(/g)).toHaveLength(1);
      expect(a.under).toHaveLength(3);
      expect(liquidStyle(th, undefined, {lightAngle: 45}).rim.background).not.toEqual(a.rim.background);
      expect(a.borderRadius).toBe(glassStyle(th, 'card').borderRadius);
    });
  }
  it('existing tiers are unchanged by the liquid addition', () => {
    expect(Object.keys(themes.midnight.glass).sort()).toEqual(['card', 'chip', 'pill', 'sheet']);
  });
});
