#!/usr/bin/env python3
"""Offline mix check: places the voice clips and the SFX cue list the way the composition does and reports levels. Renders no video.

    node scripts/pipeline/dump_cues.mjs                 # writes config.cues.out from your cue module
    python3 scripts/pipeline/mix_check.py [--root <repo>] [--config <file>] [--write out/mix_check.wav]

Config (config.mix): voLevel, sfxLevel, sfxDuck, heroDuck (duck depth against the envelope, config.output.envelope), cues (json from
dump_cues: {cues: [{sfx, t (seconds), gain, hero}]}), sfxDir (<sfx>.wav files), sfxManifest ({name: {peak|peakTime}} or [{name, peakTime}]:
seconds from the file start to its loudest point; a cue starts early by it so the impact lands on t).
Reports: mix peak (exit 1 at or above 0 dBFS), voice vs SFX level while the voice speaks, and the loudest SFX moments.
"""
import json, os, sys, wave
import numpy as np
from lib import parse, decode


def main(argv=None):
    a, root, cfg = parse(__doc__.split('\n')[0], lambda p: p.add_argument('--write', default=None), argv)
    m, FPS, SR = cfg['mix'], cfg['fps'], cfg['mix']['sampleRate']
    layout = json.load(open(os.path.join(root, cfg['output']['layout'])))
    n = int((layout['totalSeconds'] + 4) * SR)
    voice = np.zeros(n, dtype=np.float32)
    for c in json.load(open(os.path.join(root, cfg['output']['manifest']))):
        f = os.path.join(root, 'public', c['file'])
        y = decode(f if os.path.exists(f) else os.path.join(root, c['file']), SR) * m['voLevel']
        s = max(0, int(round(c['startFrame'] / FPS * SR)))
        b = min(n, s + len(y))
        voice[s:b] += y[: b - s]
    env = np.array(json.load(open(os.path.join(root, cfg['output']['envelope'])))['frames']) / 100.0
    man = json.load(open(os.path.join(root, m['sfxManifest'])))
    if isinstance(man, list): man = {e.get('name') or e.get('id'): e for e in man}
    peak_of = lambda k: float(man[k].get('peak', man[k].get('peakTime', 0.0)))
    cues = json.load(open(os.path.join(root, m['cues'])))['cues']
    sfx, cache = np.zeros(n, dtype=np.float32), {}
    t_idx = np.arange(n) / SR * FPS
    e_at = np.interp(t_idx, np.arange(len(env)), env)
    duck_full, duck_hero = 1 - m['sfxDuck'] * e_at, 1 - m['heroDuck'] * e_at
    for c in cues:
        if c['sfx'] not in cache: cache[c['sfx']] = decode(os.path.join(root, m['sfxDir'], c['sfx'] + '.wav'), SR)
        y = cache[c['sfx']]
        start = int(round((c['t'] - peak_of(c['sfx'])) * SR))
        a0, b0 = max(0, start), min(n, start + len(y))
        if b0 <= a0: continue
        seg = y[a0 - start: b0 - start] * min(1.0, c.get('gain', 1.0) * m['sfxLevel'])
        sfx[a0:b0] += (seg * (duck_hero if c.get('hero') else duck_full)[a0:b0]).astype(np.float32)
    mix = voice + sfx
    db = lambda x: 20 * np.log10(max(float(x), 1e-9))
    peak = db(np.abs(mix).max())
    print(f'mix peak {peak:.1f} dBFS   voice peak {db(np.abs(voice).max()):.1f}   sfx peak {db(np.abs(sfx).max()):.1f}')
    win = SR // 2
    k = len(mix) // win
    rms = lambda x: np.sqrt((x[: k * win].reshape(k, win) ** 2).mean(axis=1) + 1e-12)
    rv, rs = rms(voice), rms(sfx)
    speaking, sfx_on = rv > 10 ** (-40 / 20), rs > 10 ** (-60 / 20)
    both = speaking & sfx_on
    print(f'voice speaking {100 * speaking.mean():.0f}% of the time; SFX audible in {100 * sfx_on.mean():.0f}% of it')
    if both.any():
        gap = 20 * np.log10(rs[both] / rv[both])
        print(f'SFX vs voice while both play (0.5 s windows): median {np.median(gap):.1f} dB, loudest {gap.max():.1f} dB (want < -6 dB for non-hero cues)')
    ratio = np.where(speaking, rs / np.maximum(rv, 1e-6), 0)
    loud = [i for i in np.argsort(-ratio)[:8] if ratio[i] > 0]
    print('closest to the voice while the voice speaks (window start, SFX level, voice level, gap):')
    for i in sorted(loud): print(f'  {i * 0.5:6.1f}s  sfx {db(rs[i]):6.1f} dB  voice {db(rv[i]):6.1f} dB  gap {db(ratio[i]):5.1f} dB')
    if a.write:
        with wave.open(a.write, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
        print('wrote', a.write)
    if peak >= 0:
        print('FAIL mix peak is at or above 0 dBFS'); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
