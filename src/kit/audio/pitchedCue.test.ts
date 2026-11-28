import {describe, expect, it} from 'vitest';
import {pitchedCue} from './cues';
import {valueToNoteIndex} from './families';

describe('valueToNoteIndex', () => {
  it('maps min..max to 0..11 and clamps outside', () => {
    const r = {min: 10, max: 20};
    expect([valueToNoteIndex(10, r), valueToNoteIndex(20, r), valueToNoteIndex(-5, r), valueToNoteIndex(99, r)]).toEqual([0, 11, 0, 11]);
  });
  it('is monotonic', () => {
    let prev = -1;
    for (let v = 0; v <= 100; v += 0.5) {
      const n = valueToNoteIndex(v, {min: 0, max: 100});
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
  it('min == max gives note 0; bad input throws', () => {
    expect(valueToNoteIndex(7, {min: 7, max: 7})).toBe(0);
    expect(() => valueToNoteIndex(1, {min: 5, max: 1})).toThrow(RangeError);
    expect(() => valueToNoteIndex(NaN, {min: 0, max: 1})).toThrow(RangeError);
  });
});

describe('pitchedCue', () => {
  it('builds a note cue', () => {
    expect(pitchedCue('pop', 100, {min: 0, max: 100, at: 1.5, gain: 0.5})).toEqual({name: 'pop', at: 1.5, gain: 0.5, note: 11});
    expect(pitchedCue('tick', 0, {min: 0, max: 100}).note).toBe(0);
  });
});
