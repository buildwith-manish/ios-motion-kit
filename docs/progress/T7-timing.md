# T7 — Word timing and timeline builder

## Built

- `src/kit/timing/` parses generic timed JSON, Whisper/WhisperX word timestamps, SRT, and WebVTT into validated `TimedWord` arrays.
- `findWord` and `findPhrase` create punctuation-insensitive transcript matches; `TimingTimeline` resolves those anchors into ordered audio cues and non-overlapping scene starts.
- Motion-linked cues are generated with the existing audio-kit event helpers. Timeline output can be supplied directly to `RevealText` and `CueTrack`; scene outputs stay independent of the later SceneSequence API.
- Added the 40-word deterministic demo, API README, parser/builder audit, still-render script, and timing table generator.

## Verification

- `npx tsx scripts/kit-timing-audit.ts` — passed.
- `npx tsx scripts/kit-timing-table.ts` — generated `docs/kit-timing-table.txt` (40 word rows, 3 scene starts, 6 cues).
- `KIT_CHROME=/usr/bin/google-chrome node scripts/kit-timing-stills.mjs` — rendered `docs/previews/kit/timing-landscape-1080p.jpg` and `docs/previews/kit/timing-landscape-4k.jpg`; both inspected.
- `npx tsc --noEmit` — passed.
- GitHub Actions QA: pending.

## NOT DONE

- Contrast, safe-area, and motion checks will be recorded from the `kit-qa` Actions run.
