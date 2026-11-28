#!/usr/bin/env python3
"""
Measure the voice-over once so the music and SFX can duck against it (the sidechain).

    python3 scripts/pipeline/vo_envelope.py [--root <repo>] [--config <file>] [audio file]     # writes config.output.envelope

Per design frame (config.fps) it writes a number 0..100: how much the voice is "speaking" at that moment.
  1. loudness per frame (RMS in dB)
  2. a speech gate that adapts to this recording (gateBelowPeakDb under its 95th percentile, never below floorDb), with
     hysteresisDb and a holdFrames hold, so the gaps between words do not make the music pump
  3. look-ahead: shifted lookAheadFrames early, so the music is already down when the first word starts
  4. attack / release smoothing (attackFrames / releaseFrames): fast down, slow back up
envelope.source "clips": the clips placed where the layout places them (output.manifest + output.layout totalSeconds);
"file": one continuous voice-over file (envelope.file, or the positional argument). Needs numpy (+ ffmpeg for non-wav files).
"""
import json, os, sys
import numpy as np
from lib import parse, decode


def build_frames(x, SR, FPS, e):
    hop = SR // FPS
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    ref = np.percentile(db, 95)
    open_db = max(ref - e['gateBelowPeakDb'], e['floorDb'])
    close_db = open_db - e['hysteresisDb']
    gate = np.zeros(n)
    state, hold = False, 0
    for i, v in enumerate(db):
        if v > open_db: state, hold = True, e['holdFrames']
        elif state and v < close_db:
            hold -= 1
            if hold <= 0: state = False
        gate[i] = 1.0 if state else 0.0
    la = e['lookAheadFrames']
    if la:
        gate = np.roll(gate, -la); gate[-la:] = 0
    a_att, a_rel = 1 - np.exp(-1 / e['attackFrames']), 1 - np.exp(-1 / e['releaseFrames'])
    env, cur = np.zeros(n), 0.0
    for i, g in enumerate(gate):
        cur += (g - cur) * (a_att if g > cur else a_rel)
        env[i] = cur
    return [int(round(v * 100)) for v in env], n, open_db, ref, gate


def main(argv=None):
    a, root, cfg = parse(__doc__.split('\n')[1], lambda p: p.add_argument('audio', nargs='?'), argv)
    e, FPS = cfg['envelope'], cfg['fps']
    SR = e['sampleRate']
    if a.audio or e['source'] == 'file':
        src = os.path.abspath(a.audio) if a.audio else os.path.join(root, e['file'])
        x = decode(src, SR)
    else:
        src = cfg['output']['manifest']
        total = json.load(open(os.path.join(root, cfg['output']['layout'])))['totalSeconds']
        x = np.zeros(int((total + 5) * SR), dtype=np.float32)
        for c in json.load(open(os.path.join(root, cfg['output']['manifest']))):
            f = os.path.join(root, 'public', c['file'])
            y = decode(f if os.path.exists(f) else os.path.join(root, c['file']), SR)
            s = max(0, int(round(c['startFrame'] / FPS * SR)))
            b = min(len(x), s + len(y))
            x[s:b] += y[: b - s]
    frames, n, open_db, ref, gate = build_frames(x, SR, FPS, e)
    out = os.path.join(root, cfg['output']['envelope']); os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w') as f:
        json.dump({'fps': FPS, 'source': os.path.basename(src), 'gate_db': round(float(open_db), 1), 'frames': frames}, f, separators=(',', ':'))
    print(f'{n} frames ({n / FPS:.1f} s). Gate {open_db:.1f} dB (voice peaks ~{ref:.1f} dB). Speaking {100 * gate.mean():.0f}% of the time.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
