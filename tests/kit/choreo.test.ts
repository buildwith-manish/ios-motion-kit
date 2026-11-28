import {describe, expect, it} from 'vitest';
import {emphasize, enterStack, exit, handoff, retarget, sampleSpring, springWithVelocity} from '../../src/kit/motion/choreo';
import {iosSpring} from '../../src/kit/motion/ios';

describe('choreo presets', () => {
  it('enterStack staggers starts and progress rises to 1', () => {
    const s = enterStack(3, {start: 1, stagger: 0.1});
    expect(s.map((i) => i.start)).toEqual([1, 1.1, 1.2]);
    expect(s[0].progress(0.9)).toBe(0);
    expect(s[2].progress(4)).toBeGreaterThan(0.999);
  });
  it('emphasize pulses and returns to 0; exit and handoff run 0 to 1', () => {
    const e = emphasize(1);
    expect(e.progress(1.15)).toBeGreaterThan(0.3);
    expect(Math.abs(e.progress(5))).toBeLessThan(1e-3);
    expect(exit(2).progress(5)).toBeGreaterThan(0.999);
    const [out, inc] = handoff(1, 1.2);
    expect(out.start).toBe(1);
    expect(inc.start).toBe(1.2);
  });
  it('is fps independent (30 vs 60 agree at shared times)', () => {
    const s = enterStack(4, {start: 0.3, stagger: 0.09});
    for (let k = 0; k < 90; k++) {
      const t = k / 30;
      for (const item of s) expect(item.progress(t)).toBeCloseTo(item.progress((2 * k) / 60), 12);
    }
  });
});

describe('springWithVelocity / retarget', () => {
  it('matches iosSpring at zero velocity', () => {
    const m = springWithVelocity(0, {response: 0.5});
    for (const t of [0.1, 0.25, 0.6, 1.2]) expect(sampleSpring(m, t).value).toBeCloseTo(iosSpring(t, 0.5), 10);
    const b = springWithVelocity(0, {response: 0.8, bounce: 0.15});
    expect(sampleSpring(b, 0.5).value).toBeCloseTo(iosSpring(0.5, 0.8, {bounce: 0.15}), 10);
  });
  it('analytic velocity matches finite difference', () => {
    for (const bounce of [0, 0.2]) {
      const m = springWithVelocity(3, {response: 0.6, bounce});
      const h = 1e-6;
      const num = (sampleSpring(m, 0.4 + h).value - sampleSpring(m, 0.4 - h).value) / (2 * h);
      expect(sampleSpring(m, 0.4).velocity).toBeCloseTo(num, 4);
    }
  });
  it('retarget keeps position and velocity continuous', () => {
    for (const bounce of [0, 0.15]) {
      const a = springWithVelocity(0, {start: 0, from: 0, to: 1, response: 0.7, bounce});
      const t = 0.33;
      const before = sampleSpring(a, t);
      const b = retarget(a, t, 2.5);
      const after = sampleSpring(b, t);
      expect(after.value).toBeCloseTo(before.value, 10);
      expect(after.velocity).toBeCloseTo(before.velocity, 10);
      const eps = 1e-5;
      expect(Math.abs(sampleSpring(b, t + eps).value - before.value)).toBeLessThan(Math.abs(before.velocity) * eps * 1.5 + 1e-9);
      expect(sampleSpring(b, 6).value).toBeCloseTo(2.5, 3);
    }
  });
  it('is fps independent through retargets (30 vs 60)', () => {
    const run = (fps: number) => {
      let m = springWithVelocity(0, {response: 0.6});
      const out: number[] = [];
      for (let f = 0; f <= 2 * fps; f++) {
        const t = f / fps;
        if (f === Math.round(0.5 * fps)) m = retarget(m, t, 3);
        if (f % (fps / 30) === 0) out.push(sampleSpring(m, t).value);
      }
      return out;
    };
    const a = run(30);
    const b = run(60);
    expect(a.length).toBe(b.length);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
  });
});
