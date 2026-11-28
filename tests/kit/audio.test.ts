import {existsSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {cue, cueFile, formatCueTable, resolveCues} from '../../src/kit/audio/cues';
import {PITCHED_FAMILIES, PITCHED_NOTES, allPitchedSfx, allSfx, noteForValue, pitchedInfo} from '../../src/kit/audio/families';
import {cuesFromMotion, numberRollEvents} from '../../src/kit/audio/motionCues';

describe('sfx files', () => {
  it('has every file and panned copy named in the manifest', () => {
    const missing = [...allSfx(), ...allPitchedSfx()]
      .flatMap((s) => [s.file, ...s.pan.map((p) => cueFile(s, p))])
      .filter((file) => !existsSync(path.join('public', file)));
    expect(missing).toEqual([]);
  });

  it('has a complete ascending note set for each pitched family', () => {
    for (const family of PITCHED_FAMILIES) {
      const midi = Array.from({length: PITCHED_NOTES}, (_, i) => pitchedInfo(family, i).midi);
      expect(midi.every((m, i) => i === 0 || m > midi[i - 1])).toBe(true);
      // D major pentatonic pitch classes
      expect(midi.every((m) => [2, 4, 6, 9, 11].includes(m % 12))).toBe(true);
    }
    expect(allPitchedSfx()).toHaveLength(PITCHED_FAMILIES.length * PITCHED_NOTES);
  });
});

describe('pitched cues', () => {
  it('maps values to notes and clamps outside the range', () => {
    expect([0, 100, -5, 500].map((v) => noteForValue(v, 0, 100))).toEqual([0, 11, 0, 11]);
    expect(noteForValue(3, 3, 3)).toBe(0);
    expect(() => noteForValue(Number.NaN, 0, 1)).toThrow(RangeError);
    expect(() => noteForValue(1, 2, 0)).toThrow(RangeError);
  });

  it('plays the pitched file, honouring pan and clamping the note', () => {
    const {cues} = resolveCues([cue('tick', 1, {note: 4, pan: -1, variant: 2}), cue('pop', 2, {note: 99})]);
    expect(cues.map((c) => [c.file, c.variant, c.note])).toEqual([
      ['kit/sfx/pitched/tick-n04@L.wav', 0, 4],
      ['kit/sfx/pitched/pop-n11.wav', 0, 11],
    ]);
    expect(formatCueTable({cues, dropped: []}, 60)).toContain('tick-n04');
  });

  it('drops a note on an unpitched family and a non-numeric note', () => {
    const {cues, dropped} = resolveCues([cue('tap', 1, {note: 2}), cue('pop', 2, {note: Number.NaN})]);
    expect(cues).toEqual([]);
    expect(dropped.map((d) => d.reason)).toEqual(['unknown-note', 'unknown-note']);
  });

  it('blocks only the same note inside the repeat window', () => {
    const {cues, dropped} = resolveCues([cue('tick', 1, {note: 3}), cue('tick', 1.05, {note: 3}), cue('tick', 1.06, {note: 4})]);
    expect(cues.map((c) => c.note)).toEqual([3, 4]);
    expect(dropped.map((d) => d.reason)).toEqual(['duplicate']);
  });

  it('does not change which variants unpitched cues get', () => {
    const plain = [cue('tick', 1), cue('tick', 2), cue('tick', 3)];
    const mixed = [cue('tick', 0.5, {note: 1}), ...plain, cue('tick', 2.5, {note: 2})];
    const variants = (list: typeof plain) => resolveCues(list, {seed: 9}).cues.filter((c) => c.note === undefined).map((c) => c.variant);
    expect(variants(mixed)).toEqual(variants(plain));
  });

  it('lets a motion rule compute a note per event', () => {
    const cues = cuesFromMotion(numberRollEvents({start: 1, ticksPerDigit: 4}), [{on: 'number-tick', play: 'number-tick', note: (e) => e.index}]);
    expect(cues.map((c) => c.note)).toEqual([0, 1, 2, 3]);
  });
});
