import {
  SPRING,
  cue,
  cuesFromMotion,
  enterEvents,
  numberRollEvents,
  transitionEvents,
  type Cue,
  type VoEnvelope,
} from '..';
import envelopeJson from './fake-vo.envelope.json';

/** Length of the audio demo in seconds. */
export const AUDIO_DEMO_SECONDS = 10;

/** Fake voice-over envelope (synthetic, from public/kit/demo/fake-vo.wav via scripts/kit_vo_envelope.py --demo). */
export const FAKE_VO: VoEnvelope = envelopeJson as VoEnvelope;

/** Spoken stretches of the fake voice-over (seconds), for drawing only. */
export const FAKE_VO_SEGMENTS: [number, number][] = [
  [1.2, 3.6],
  [4.4, 6.2],
  [7.0, 9.0],
];

/**
 * The 10 s demo timeline: every cue family, mostly derived from motion events (transition at 0.3 s, an enter at 1.7 s, a
 * 3-digit number roll at 2.5 s), plus hand-placed cues, a same-family burst at ~4.2 s that exercises the variant rule,
 * and a pile-up at 9.0 s that exercises the 3-simultaneous limit.
 * @example const cues = audioDemoCues();
 */
export const audioDemoCues = (): Cue[] => [
  ...cuesFromMotion(transitionEvents(0.3, 0.8), [
    {on: 'transition-start', play: 'swipe'},
    {on: 'transition-mid', play: 'whoosh-soft', anchor: 'peak'},
    {on: 'transition-settle', play: 'tap'},
  ]),
  ...cuesFromMotion(enterEvents(1.7, SPRING.SNAPPY), [
    {on: 'enter-start', play: 'pop', offset: -0.02},
    {on: 'peak-velocity', play: 'whoosh-fast', anchor: 'peak'},
    {on: 'spring-settle', play: 'tick'},
  ]),
  ...cuesFromMotion(numberRollEvents({start: 2.5, digits: 3, ticksPerDigit: 4}), [
    {on: 'number-roll-start', play: 'rise'},
    {on: 'number-tick', play: 'number-tick'},
  ]),
  cue('slide', 3.9, {pan: -0.8}),
  cue('tap', 4.2, {pan: 0.8}),
  cue('tap', 4.26),
  cue('tap', 4.31),
  cue('fall', 5.0),
  cue('soft-warn', 5.7),
  cue('chime-success', 6.6, {pan: 0.3}),
  cue('impact-soft', 8.0, {anchor: 'peak'}),
  // pile-up: five overlapping sounds in 80 ms -> the limit keeps three
  cue('swipe', 9.0),
  cue('slide', 9.02),
  cue('whoosh-fast', 9.04),
  cue('whoosh-soft', 9.06),
  cue('pop', 9.08),
];
