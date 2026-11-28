import assert from 'node:assert/strict';
import {findPhrase, findWord} from '../src/kit/timing/anchors';
import {parseSrt, parseTimedWordsJson, parseVtt, parseWhisperWordTimestamps} from '../src/kit/timing/parsers';
import {atTime, phrase, TimingTimeline, TimelineValidationError, word} from '../src/kit/timing/Timeline';
import {TIMING_DEMO_RESULT, TIMING_DEMO_WORDS} from '../src/kit/timing/demoData';
import type {TimedWord} from '../src/kit/text/types';

assert.equal(TIMING_DEMO_WORDS.length, 40);
assert.equal(TIMING_DEMO_RESULT.scenes.length, 3);
assert.equal(TIMING_DEMO_RESULT.cues.length, 6);

const generic = parseTimedWordsJson({
  segments: [
    {text: 'Rent rises', start: 0, end: 1},
    {text: 'Costs follow.', start: 1.2, end: 2},
  ],
});
assert.equal(generic.length, 4);
assert.equal(generic[0].text, 'Rent');
assert.equal(generic.at(-1)?.text, 'follow.');
assert.equal(parseTimedWordsJson('[{"text":"once","start":0,"end":0.2}]')[0].text, 'once');

const whisper = parseWhisperWordTimestamps({
  segments: [{words: [{word: 'monthly', start: 0.1, end: 0.4}, {word: 'rent', start: 0.5, end: 0.9}]}],
});
assert.deepEqual(whisper.map(({text}) => text), ['monthly', 'rent']);

const srt = parseSrt('1\n00:00:00,000 --> 00:00:01,000\nHello <i>world!</i>\n');
assert.deepEqual(srt.map(({text}) => text), ['Hello', 'world!']);
assert.equal(srt[1].end, 1);

const vtt = parseVtt('WEBVTT\n\ncue-1\n00:00.000 --> 00:01.000 align:start\n<v narr>Today</v> we begin.\n');
assert.deepEqual(vtt.map(({text}) => text), ['Today', 'we', 'begin.']);
assert.equal(vtt[0].start, 0);

assert.equal(findWord(generic, 'RENT,')?.index, 0);
assert.equal(findWord(generic, 'rent', 2), undefined);
assert.deepEqual(findPhrase(generic, 'costs follow')?.map(({text}) => text), ['Costs', 'follow.']);

const demoTimeline = new TimingTimeline(generic);
demoTimeline.scene('rent').startsAt(word('rent')).lasts(0.5);
demoTimeline.scene('costs').startsAt(phrase('costs follow')).lasts(0.5);
demoTimeline.cueAt(word('rent'), 'pop');
demoTimeline.cueAt(atTime(1.2), 'tap');
const result = demoTimeline.build();
assert.equal(result.scenes.length, 2);
assert.deepEqual(result.cues.map(({name}) => name), ['pop', 'tap']);

const missingTimeline = new TimingTimeline(generic);
missingTimeline.scene('missing').startsAt(phrase('not present'));
assert.match(missingTimeline.build().warnings[0], /phrase "not present" was not found/u);

const overlapping = new TimingTimeline(generic);
overlapping.scene('first').startsAt(atTime(0.5)).lasts(2);
overlapping.scene('second').startsAt(atTime(1));
assert.throws(() => overlapping.build(), TimelineValidationError);

const unordered = new TimingTimeline(generic);
unordered.cueAt(atTime(1.5), 'tap');
unordered.cueAt(atTime(1), 'pop');
assert.throws(() => unordered.build(), TimelineValidationError);

const invalidWords: TimedWord[] = [{text: 'not valid', start: 1, end: 0}];
const invalid = new TimingTimeline(invalidWords);
assert.throws(() => invalid.build(), TimelineValidationError);

assert.throws(() => parseSrt('1\n00:00:02,000 --> 00:00:01,000\ninvalid\n'), /ends before it starts/u);
console.log('timing audit passed: JSON, Whisper, SRT, VTT, anchors, warnings, and timeline validation');
