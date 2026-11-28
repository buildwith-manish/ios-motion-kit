import {numberRollEvents} from '../audio/motionCues';
import voiceover from './demo/voiceover.json';
import {findWord} from './anchors';
import {parseTimedWordsJson} from './parsers';
import {TimingTimeline, word} from './Timeline';

export const TIMING_DEMO_WORDS = parseTimedWordsJson(voiceover);
export const TIMING_DEMO_TIMELINE = new TimingTimeline(TIMING_DEMO_WORDS);

TIMING_DEMO_TIMELINE.scene('rent').startsAt(word('rent'), {lead: -0.15}).lasts(1.4);
TIMING_DEMO_TIMELINE.scene('total').startsAt(word('total'), {lead: -0.15}).lasts(1.5);
TIMING_DEMO_TIMELINE.scene('take-home pay').startsAt(word('pay'), {lead: -0.15}).lasts(1.2);
TIMING_DEMO_TIMELINE.cueAt(word('rent'), 'pop');
TIMING_DEMO_TIMELINE.motionCuesAt(
  word('total'),
  numberRollEvents({start: 0, digits: 4, staggerSeconds: 0.1, rollSeconds: 0.65, ticksPerDigit: 2}),
  [
    {on: 'number-roll-start', play: 'rise'},
    {on: 'number-tick', play: 'number-tick', every: 2},
  ],
);

export const TIMING_DEMO_RESULT = TIMING_DEMO_TIMELINE.build();

export const timingDemoWordStart = (query: string): number => {
  const match = findWord(TIMING_DEMO_WORDS, query);
  if (!match) throw new Error(`Timing demo is missing the word "${query}"`);
  return match.word.start;
};
