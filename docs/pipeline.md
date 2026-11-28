# Voiceover and production pipeline

Generic, config-driven tools (`scripts/pipeline/`) for a voiceover-led video: the voice decides how long every shot is.
Every tool takes `--root <repo>` (default: current directory) and `--config <file>` (default: `<root>/video.config.json`).
`npm run kit:config-check -- --print` validates the config and prints the effective values (defaults: `scripts/pipeline/config.defaults.json`,
schema: `scripts/pipeline/video.config.schema.json`; unknown keys are errors). Pass tool options after `--`: `npm run kit:vo-layout -- --root ../my-video --check`.

## video.config.json (every key is optional; this is an example)

```json
{
  "script": "scripts/lines.csv",
  "clipsDir": "public/voiceover/clips_wav",
  "clipNamePattern": "{n:03d}_{id}.wav",
  "wordsFile": "scripts/vo-words.json",
  "dataFile": "src/data.json",
  "fps": 30,
  "canvas": {"width": 1920, "height": 1080, "fps": 60},
  "shot": {"onset": 0.1, "tail": 0.3, "maxShot": 20},
  "silenceLimit": 0.6,
  "sections": [
    {"id": "coldOpen", "idPrefixes": ["s01"]},
    {"id": "method", "idPrefixes": ["s02"]},
    {"id": "outro", "idPrefixes": ["s03"], "default": true}
  ],
  "intro": {"seconds": 3.5, "after": "coldOpen"},
  "chapters": [{"section": "method", "title": "The method"}, {"section": "outro", "title": "Wrap up"}],
  "chapterCardSeconds": 2.5,
  "endScreenSeconds": 6,
  "paceLimit": 4.5,
  "normalize": {"vo": {"lufs": -15, "ceilingDb": -1.5}, "final": {"lufs": -14, "truePeak": -1}},
  "figures": {"entities": "cities", "nameField": "name", "allowList": "scripts/figures-allow.json"},
  "render": {"entry": "src/index.ts", "composition": "Main"},
  "stills": {"scenes": [{"id": "open", "shot": "s01a", "moments": [{"name": "start"}, {"name": "rent", "word": "rent", "offsetSeconds": 0.5}]}]},
  "cues": {"module": "src/sfx.ts", "export": "CUES", "atField": "at", "atUnit": "frames"},
  "output": {"manifest": "src/audio/voiceover-manifest.json", "layout": "src/audio/vo-layout.json", "envelope": "src/audio/vo-envelope.json", "chaptersTxt": "docs/youtube-chapters.txt"}
}
```

`script` is a CSV with `id,text` (or a JSON array of `{id, text}`, or plain text with one line per spoken line). Clip files are named by
`clipNamePattern` (`n` = 1-based line number). A line belongs to the first section whose `idPrefixes` matches its id, else the `default` section.
`shot.onset + shot.tail` is the padding around speech (shot = voice + 0.4 s). `chapters` entries get a silent card of `chapterCardSeconds`
before their section (`"card": false` for none); the cards are layout sections `chapter1..N`.

## The 8-step flow

| # | Step | Command | Result |
|---|------|---------|--------|
| 1 | Script | write `script`; `npm run kit:tts-prep` spells numbers/dollars/months out for a TTS voice (needs `num2words`) | `output.ttsDir` |
| 2 | VO | record or generate clips into `clipsDir`; `npm run kit:vo-normalize` levels each to `normalize.vo.lufs` (ffmpeg) | clips |
| 3 | Words | `npm run kit:vo-words` (needs `pocketsphinx`, ffmpeg) | `wordsFile` (optional, for word-cued beats) |
| 4 | Layout | `npm run kit:vo-layout` (`-- --check` reports only) | `output.manifest`, `output.layout` |
| 5 | Envelope | `npm run kit:vo-envelope` (ducking curve 0..100 per frame) | `output.envelope` |
| 6 | Scenes | build scenes from `vo-layout.json` (shot starts, `speechStart`, word times); `kit:pace-audit`, `kit:scene-stills`, `kit:contact-sheet` for review | stills, sheets |
| 7 | Checks | `kit:figures-check`, `kit:chapters` + `kit:chapters-check`, `kit:dump-cues` then `kit:mix-check` | reports, chapters txt |
| 8 | Normalize | render, then `npm run kit:normalize -- out/video.mp4` (loudnorm to -14 LUFS, -1 dBTP) | `out/video-final.mp4` |

## Tools

- **vo_layout**: fails (exit 1) on a missing, silent or truncated clip, an overlap, a shot over `shot.maxShot`, or silence over `silenceLimit` between lines
  (the intro and chapter cards are exempt). Shots are whole frames of `fps`.
- **vo_envelope**: `envelope.source` `"clips"` places the clips by the manifest; `"file"` reads one continuous file (or pass it as an argument).
  Gate, hold, look-ahead and smoothing are the `envelope.*` keys.
- **pace_audit**: lists shots whose speech is over `paceLimit` seconds and the longest silent gap between word cues (exit 0).
- **figures-check**: spoken figures (words or digits) vs numeric fields of `dataFile`. Exit 0 all matched, 1 mismatch (figure only matches another
  entity's field), 2 unmatched. Narrative counts ("one of the cities") go in the allow-list `[{"clip": "s03b", "value": 1, "note": "why"}]`.
- **chapters / chapters-check**: `m:ss title` lines from the layout; fail when the first is not 0:00, a chapter is under 10 s, or starts do not ascend; fewer than 3 is a warning.
- **mix-check**: places clips and the cue list from `dump-cues` like the composition does and reports mix peak and SFX vs voice level (exit 1 at 0 dBFS).
- **contact-sheet / scene-stills**: Chromium via `npx remotion still` / `@remotion/renderer`; tiling needs `sharp` (installed with `--no-save` on first use).
  `--dry-run` prints the frame plan without rendering. Heavy renders belong in CI.
- **dump-cues**: bundles `cues.module` with esbuild and writes `{total, shots, cues: [{sfx, t, gain, hero, tag}]}`.

## Dependencies

Python: numpy (core tools, mix-check). Optional: `pocketsphinx` (vo-words), `num2words` (tts-prep). ffmpeg for normalize, vo-words and non-wav input.
Node: esbuild (dump-cues, already a dev dependency), sharp (on demand). Tests: `tests/kit/pipeline*.test.ts` build synthetic sine clips from `tests/fixtures/pipeline`.
