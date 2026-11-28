#!/usr/bin/env python3
"""
Layout: the voiceover decides how long everything is. One shot per clip; shot length = onset + its speech + tail (about voice + 0.4 s).

    python3 scripts/pipeline/vo_layout.py [--root <repo>] [--config <file>] [--check]

Rules (all numbers come from video.config.json: shot.onset, shot.tail, shot.maxShot, silenceLimit, fps, intro, chapters,
chapterCardSeconds, endScreenSeconds):
  * A shot = ONSET + the clip's speech + TAIL, so the gap between two spoken lines is onset + tail, never over silenceLimit.
  * Shot lengths are whole design frames (1/fps), so every cut lands on a frame.
  * Clips never overlap: each starts after the previous shot ends.
  * An optional silent intro (config.intro: seconds, after: section id) sits after that section.
  * A silent chapter card (chapterCardSeconds) sits before the first clip of every section listed in config.chapters; ids chapter1..N.
  * The last shot gets endScreenSeconds of picture with no voice, for the end card.
Outputs (config.output): manifest [{id, file, startFrame, duration}] and layout {totalSeconds, sections, shots}.
Exit 1 when a clip is missing/truncated/overlaps, a shot is too long, or silence exceeds the limit.
"""
import json, math, os, sys
import numpy as np
from lib import parse, read_wav, read_lines


def main(argv=None):
    a, root, cfg = parse(__doc__.split('\n')[1], lambda p: p.add_argument('--check', action='store_true', help='report only, write nothing'), argv)
    FPS, ONSET, TAIL, MAX_SHOT, MAX_GAP = cfg['fps'], cfg['shot']['onset'], cfg['shot']['tail'], cfg['shot']['maxShot'], cfg['silenceLimit']
    CARD, END = cfg['chapterCardSeconds'], cfg['endScreenSeconds']
    intro = cfg['intro']
    chapters = {c['section']: i + 1 for i, c in enumerate(cfg['chapters']) if c.get('card', True)}
    secs_cfg = cfg['sections'] or [dict(id='main', idPrefixes=[], default=True)]
    default_sec = next((s['id'] for s in secs_cfg if s.get('default')), secs_cfg[-1]['id'])

    def section_of(cid):
        for s in secs_cfg:
            if any(cid.startswith(p) for p in s.get('idPrefixes', [])): return s['id']
        return default_sec

    frames = lambda s: math.ceil(s * FPS - 1e-9) / FPS
    rows = read_lines(os.path.join(root, cfg['script']))
    wpath = os.path.join(root, cfg['wordsFile'])
    words = json.load(open(wpath)) if os.path.exists(wpath) else {}
    tr = cfg['truncation']
    problems, clips = [], []
    for n, r in enumerate(rows, 1):
        f = cfg['clipNamePattern'].format(n=n, id=r['id'])
        p = os.path.join(root, cfg['clipsDir'], f)
        if not os.path.exists(p):
            problems.append(f'missing clip {f}'); continue
        d, sr = read_wav(p)
        win = max(1, int(sr * 0.01))
        env = np.sqrt(np.convolve(d ** 2, np.ones(win) / win, 'same'))
        idx = np.where(env > 0.02 * max(1e-9, np.abs(d).max()))[0]
        if not len(idx):
            problems.append(f"{r['id']}: clip is silent"); continue
        lead, end = idx[0] / sr, idx[-1] / sr
        wc = len(r['text'].split())
        wps = wc / max(1e-6, end - lead)
        # a very short line is naturally fast, so only flag longer lines or extreme rates
        if (wc >= tr['minWords'] and wps > tr['maxWps']) or wps > tr['absMaxWps']: problems.append(f"{r['id']}: {wps:.1f} words/s, probably truncated")
        clips.append(dict(n=n, id=r['id'], text=r['text'], file=(cfg['clipsDir'][7:] if cfg['clipsDir'].startswith('public/') else cfg['clipsDir']) + '/' + f,
                          dur=len(d) / sr, lead=lead, speech=end - lead, sec=section_of(r['id'])))
    if not clips:
        print('PROBLEMS:\n  ' + '\n  '.join(problems or ['no clips'])); return 1

    t, sections, prev_sec = 0.0, {}, None
    for c in clips:
        if intro and prev_sec == intro['after'] and c['sec'] != prev_sec:
            sections['intro'] = dict(id='intro', start=t, seconds=intro['seconds']); t += intro['seconds']
        if c['sec'] != prev_sec and c['sec'] in chapters:
            cid = f"chapter{chapters[c['sec']]}"
            sections[cid] = dict(id=cid, start=t, seconds=CARD); t += CARD
        seconds = frames(ONSET + c['speech'] + TAIL)
        if c is clips[-1]: seconds = frames(seconds + END)
        c.update(start=t, seconds=seconds, file_start=t + ONSET - c['lead'])
        if c['file_start'] < 0: problems.append(f"{c['id']}: {c['lead']:.2f}s of leading silence is longer than the shot allows")
        if seconds > MAX_SHOT and c is not clips[-1]: problems.append(f"{c['id']}: shot is {seconds:.1f}s, over {MAX_SHOT:g}s")
        s = sections.setdefault(c['sec'], dict(id=c['sec'], start=t, seconds=0.0))
        s['seconds'] = round(t + seconds - s['start'], 4)
        t += seconds
        prev_sec = c['sec']
    total = frames(t)
    secs = sorted(sections.values(), key=lambda s: s['start'])
    for s in secs: s['seconds'] = round(s['seconds'], 4)

    for x, y in zip(clips, clips[1:]):
        gap = (y['start'] + ONSET) - (x['start'] + ONSET + x['speech'])
        exempt = x['sec'] != y['sec'] and ((intro and x['sec'] == intro['after']) or y['sec'] in chapters)
        if gap > MAX_GAP and not exempt: problems.append(f"{x['id']} -> {y['id']}: {gap:.2f}s of silence")
        if y['start'] < x['start'] + x['seconds'] - 1e-6: problems.append(f"{x['id']} overlaps {y['id']}")

    mm = lambda x: f'{int(x // 60)}:{x % 60:04.1f}'
    print(f"{len(clips)} clips, {len(rows)} lines. total {mm(total)} ({total:.1f} s) = {math.ceil(total * cfg['canvas']['fps'])} frames at {cfg['canvas']['fps']} fps")
    for s in secs: print(f"  {s['id']:10} starts {mm(s['start']):>7}  {s['seconds']:7.1f} s")
    sh = [c['seconds'] for c in clips]
    body = sh[:-1] or sh
    print(f"shot length: shortest {min(sh):.2f}s ({clips[sh.index(min(sh))]['id']}), longest {max(body):.2f}s ({clips[sh.index(max(body))]['id']}), average {sum(sh) / len(sh):.2f}s")
    print('PROBLEMS:\n  ' + '\n  '.join(problems) if problems else f'No overlaps, no silence over {MAX_GAP:g} s between lines, no shot over {MAX_SHOT:g} s, no truncated clip.')
    if problems: return 1
    if a.check: return 0

    man = [dict(id=c['id'], file=c['file'], startFrame=round(c['file_start'] * FPS, 2), duration=round(c['dur'], 3)) for c in clips]
    lay = dict(totalSeconds=round(total, 4), introSeconds=intro['seconds'] if intro else 0, endScreenSeconds=END, onsetSeconds=ONSET, fps=FPS,
               sections=[dict(id=s['id'], start=round(s['start'], 4), seconds=s['seconds']) for s in secs],
               shots=[dict(id=c['id'], section=c['sec'], start=round(c['start'], 4), seconds=round(c['seconds'], 4),
                           speechStart=round(c['start'] + ONSET, 4), speechEnd=round(c['start'] + ONSET + c['speech'], 4), text=c['text'],
                           words=[[w, round(tw - c['lead'], 3)] for w, tw in words.get(c['id'], words.get(f"{c['n']:03d}_{c['id']}", []))]) for c in clips])
    for key, obj, ind in (('manifest', man, 2), ('layout', lay, 1)):
        out = os.path.join(root, cfg['output'][key]); os.makedirs(os.path.dirname(out), exist_ok=True)
        json.dump(obj, open(out, 'w'), indent=ind)
    print('wrote', cfg['output']['manifest'], 'and', cfg['output']['layout'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
