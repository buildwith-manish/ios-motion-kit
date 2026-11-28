# kit/timing

Parse narration/subtitle timings once, then use the same word table for text reveal, motion-linked audio, and scene
starts. All times are seconds from the composition start; no parser or builder reads the Remotion clock.

```tsx
import {
  CueTrack,
  RevealText,
  TimingTimeline,
  numberRollEvents,
  parseWhisperWordTimestamps,
  word,
} from '../kit';

const words = parseWhisperWordTimestamps(whisperJson);
const timeline = new TimingTimeline(words);
timeline.scene('rent').startsAt(word('rent'), {lead: -0.15}).lasts(2.4);
timeline.motionCuesAt(
  word('total'),
  numberRollEvents({start: 0, digits: 4}),
  [{on: 'number-roll-start', play: 'rise'}, {on: 'number-tick', play: 'number-tick', every: 2}],
);
const result = timeline.build();

// Use result.words for RevealText, result.cues for CueTrack, and result.scenes for scene starts.
<RevealText timings={result.words} frame={frame} highlightActive />;
<CueTrack cues={result.cues} fps={60} />;
```

`parseTimedWordsJson` accepts a word array or `{words}`, `{timings}`, and `{segments}` containers with `{text|word,
start, end}` records. Multi-word spans are split proportionally by character count. `parseWhisperWordTimestamps` accepts
Whisper/WhisperX `segments[].words[]` as well as root word arrays. `parseSrt` and `parseVtt` split each subtitle cue
span across its words and remove common inline markup.

`findWord(words, query, occurrence?)` returns the matching `{index, word}`; `findPhrase(words, query, occurrence?)`
returns the contiguous timed words. Both are case- and punctuation-insensitive and use 1-based occurrences.
`word(query)`, `phrase(query)`, and `atTime(seconds)` create anchors for the builder. Missing anchors become warnings and
the corresponding cue/scene is skipped. `build()` throws `TimelineValidationError` for unordered cues/scenes, overlaps,
invalid durations, or invalid word timings.

The resulting scene entries are intentionally framework-neutral `{id, start, end?}` records. A future
`SceneSequence` can consume these directly without coupling the timing package to the scene kit.

## Demo and audit

`src/kit/timing/TimingDemo.tsx` shows a deterministic 40-word sample with word-synced reveal, a number roll, generated
audio cues, and scene starts. `docs/kit-timing-table.txt` is generated with:

```sh
npx tsx scripts/kit-timing-table.ts
```

Run the parser and builder checks with:

```sh
npx tsx scripts/kit-timing-audit.ts
```
