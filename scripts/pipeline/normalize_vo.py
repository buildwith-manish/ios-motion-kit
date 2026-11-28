#!/usr/bin/env python3
"""
Level every voice-over clip to the same loudness so no line is louder or quieter than its neighbours.

    python3 scripts/pipeline/normalize_vo.py [--root <repo>] [--config <file>] [--check]   # rewrites config.clipsDir/*.wav in place

Target config.normalize.vo: lufs (integrated, per clip), ceilingDb (true peak held by a limiter), maxGain. Length and sample
format are unchanged, so the layout timings stay valid. Needs ffmpeg. Safe to re-run (it converges on the target).
"""
import glob, os, re, shutil, subprocess, sys, tempfile
from lib import parse


def lufs(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', r[r.rfind('Summary'):]).group(1))


def main(argv=None):
    a, root, cfg = parse(__doc__.split('\n')[1], lambda p: p.add_argument('--check', action='store_true', help='only print the levels'), argv)
    v = cfg['normalize']['vo']
    TARGET, CEIL, MAX_GAIN = v['lufs'], 10 ** (v['ceilingDb'] / 20), v['maxGain']
    for p in sorted(glob.glob(os.path.join(root, cfg['clipsDir'], '*.wav'))):
        before = lufs(p)
        if a.check:
            print(f'{os.path.basename(p):32s} {before:6.1f} LUFS'); continue
        gain, cur = 0.0, before
        for i in range(4):  # the limiter eats some loudness on peaky clips, so close the gap in a few passes
            gain = min(MAX_GAIN, gain + (TARGET - cur))
            tmp = tempfile.mktemp(suffix='.wav')
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', p, '-af', f'volume={gain}dB,alimiter=limit={CEIL:.4f}:attack=3:release=60:level=disabled', '-c:a', 'pcm_s16le', tmp], check=True)
            cur = lufs(tmp)
            if abs(cur - TARGET) < 0.4 or gain >= MAX_GAIN: break
            if i < 3: os.remove(tmp)
        shutil.move(tmp, p)
        print(f'{os.path.basename(p):32s} {before:6.1f} -> {cur:6.1f} LUFS  (+{gain:.1f} dB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
