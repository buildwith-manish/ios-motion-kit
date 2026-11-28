# kit/audio — iOS-style sound design

Original, synthesized UI sounds (soft, short, clean), a typed cue system, motion-linked cue times, voice-over ducking and an
ambient music bed. Nothing is sampled or copied from video 2/3 and nothing imitates a real product sound.
Video-agnostic: no imports from `src/video*`; time is in **seconds**, fps comes from the caller.

## 10-line example

```tsx
import {CueTrack, MusicBed, cue, cuesFromMotion, enterEvents, numberRollEvents, type VoEnvelope} from '../kit';
import env from './vo-envelope.json'; // from scripts/kit_vo_envelope.py

const cues = [
  ...cuesFromMotion(enterEvents(1.2), [{on: 'enter-start', play: 'pop'}, {on: 'peak-velocity', play: 'whoosh-fast', anchor: 'peak'}]),
  ...cuesFromMotion(numberRollEvents({start: 2, digits: 3}), [{on: 'number-tick', play: 'number-tick'}]),
  cue('chime-success', 4.5, {pan: 0.3}),
];
export const Audio = () => (<><MusicBed src="kit/music/pad-loop.wav" fps={60} voice={env as VoEnvelope} totalSeconds={20} />
  <CueTrack cues={cues} fps={60} seed={1} mix={{voice: env as VoEnvelope}} /></>);
```

## Generate the assets

```
python3 scripts/kit_make_sfx.py        # public/kit/sfx/*.wav + manifest.json (+ src/kit/audio/sfx-manifest.json)
python3 scripts/kit_make_music.py      # public/kit/music/pad-loop.wav (64 s seamless loop, ~-28 LUFS)
python3 scripts/kit_vo_envelope.py vo.wav -o src/vo-envelope.json   # RMS per 1/30 s
node scripts/kit-audio-check.mjs       # rule checks (determinism, limits, ducking timing, ceiling, motion events)
node scripts/kit-audio-table.mjs       # docs/kit-audio-cues.txt for the demo timeline
```

## SFX report and listening page

```
pip install -r scripts/sfx_report_requirements.txt   # numpy, scipy, matplotlib
python3 scripts/sfx_report.py          # dist/sfx-report/: report.json, report.md, spectrograms/, contact-sheet.png
python3 scripts/sfx_build_page.py      # dist/sfx-report/index.html + audio/ (open it in a browser)
npm run kit:sfx-report                 # both
```

The report reads the mono WAVs (not the `@L` / `@R` copies) and flags measurable issues: `too-harsh`, `too-thin`,
`too-long`, `too-quiet`, `too-loud`, `inconsistent`. A flag is not a verdict, and an unflagged sound is not approved: judge
by ear. `--strict` exits 1 when anything is flagged.

**Editing thresholds:** `scripts/sfx_report_thresholds.json`. `defaults` applies to every family; an entry under `families`
overrides it key by key; `null` switches a test off; the `_help` lines define each test. `rms_target_db` is the median of
the set committed when the file was written, so after an intended level change, update it. Attack is the 10-90% rise to the
highest point of the envelope, so for multi-note or swelling sounds it measures the time to the loudest part.

**CI** (`.github/workflows/sfx-report.yml`) runs when the generator, report scripts or sounds change: it checks that the
generator reproduces the committed files, uploads the report as an artifact, comments on pull requests, and on `main`
deploys the page to GitHub Pages (needs Settings > Pages > Source: GitHub Actions). Run it manually with `strict` to fail
on flags.

## Sounds (13 families x 3 variants, 48 kHz / 24-bit, peak -3 dBFS, 6 ms in / 10 ms out)

`tap`, `tick`, `pop`, `whoosh-soft`, `whoosh-fast`, `swipe`, `slide`, `rise`, `fall`, `chime-success`, `soft-warn`,
`number-tick`, `impact-soft`. Every file is peak-normalised, so each family has a default level in `FAMILY_DEFAULTS`
(e.g. `number-tick` -22 dB, `impact-soft` -8 dB). `manifest.json` lists duration, peak time, active RMS and a LUFS estimate.

## API

| Export | What it does |
| --- | --- |
| `cue(name, atSeconds, {gain, pan, variant, anchor})` | Build a cue. `gain` is a linear multiplier on the family default; `pan` -1..1 (L / centre / R files); `anchor: 'peak'` lands the loudest moment on `atSeconds`. |
| `resolveCues(cues, {seed, limits})` | Seeded variant choice + limits. Returns `{cues, dropped}`. Pure. |
| `<CueTrack cues fps seed limits mix/>` | One `<Sequence><Audio/></Sequence>` per resolved cue, volume per frame (duck + voice ceiling). |
| `enterEvents`, `transitionEvents`, `numberRollEvents` | Motion events (start, peak velocity, settle, mid, ticks) from the kit springs/ease. |
| `cuesFromMotion(events, rules)` | Bind sounds to events (`offset`, `anchor`, `every`). |
| `createDuck(env, opts)` / `getDuck` / `duckGainPerFrame` | Duck curve from a VO envelope: depth 6-9 dB (default 7.5), attack 80 ms, release 400 ms, hold 150 ms, optional lookahead. |
| `sfxGainAt(cue, seconds, mix)` | Gain for one SFX: cue gain x SFX duck (6 dB) x ceiling so SFX RMS <= voice RMS - 3 dB. |
| `<MusicBed src fps voice duck totalSeconds/>` | Looping bed with fades and ducking. |
| `formatCueTable(result, fps)` | Text table of kept/dropped cues. |

## Rules enforced

- **Max 3 simultaneous** sounds; the lowest-priority one of the overlapping set is dropped (ties: the newest).
- **No identical SFX within 120 ms**: "identical" is the same *file* (family + variant). A different variant of the same family is
  allowed; if all three variants started within 120 ms the cue is dropped. (So 3+ number ticks inside 120 ms thin out.)
- **SFX never louder than the voice-over**: while the voice is above -50 dBFS RMS, SFX RMS is held at least 3 dB under it.
- **Deterministic**: variants come from `seed:name:nth` hashing (mulberry32), no `Math.random`.

## Caveats

- Sequences start on whole frames: a cue lands within half a frame of its time (8 ms @ 60, 17 ms @ 30).
- Remotion's `<Audio>` has no pan prop, so pan uses pre-rendered `@L` / `@R` files (equal-power +-0.75); pan is 3 positions.
- The ducking envelope is 30 Hz, but the smoothing runs on a 500 Hz grid, so attack/release are exact at any fps.
