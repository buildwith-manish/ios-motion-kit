import {describe, expect, it} from 'vitest';
import {DITHER_PROFILES, ditherFilterValues, ditherSeed, resolveDither} from '../../src/kit/finish';

describe('Finish dither', () => {
  it('is off by default', () => {
    expect(resolveDither()).toBeNull();
    expect(resolveDither(false)).toBeNull();
    expect(resolveDither('off')).toBeNull();
  });
  it('banding-safe profile and partial options', () => {
    expect(resolveDither('banding-safe')).toEqual(DITHER_PROFILES['banding-safe']);
    expect(resolveDither({amount: 1})).toEqual({...DITHER_PROFILES['banding-safe'], amount: 1});
  });
  it('seed is deterministic, per frame, in range', () => {
    expect(ditherSeed(7, 12)).toBe(ditherSeed(7, 12));
    expect(ditherSeed(7, 12)).not.toBe(ditherSeed(7, 13));
    for (let f = 0; f < 500; f++) { const s = ditherSeed(0x5eed, f); expect(s).toBeGreaterThanOrEqual(1); expect(s).toBeLessThanOrEqual(65000); }
  });
  it('filter values scale with amount and fall off toward highlights', () => {
    const cfg = DITHER_PROFILES['banding-safe'];
    const a = ditherFilterValues(cfg, 3);
    const b = ditherFilterValues({...cfg, amount: 2.5}, 3);
    expect(b.gain / a.gain).toBeCloseTo(2, 5);
    const t = a.table.split(' ').map(Number);
    expect(t[0]).toBe(1);
    expect(t[7]).toBeCloseTo(1 - cfg.highlightFalloff, 3);
    expect(ditherFilterValues(cfg, 3)).toEqual(a);
  });
});
