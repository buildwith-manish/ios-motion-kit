#!/usr/bin/env python3
"""
Word-level timing for every voice-over clip, so scenes can be cued to the exact word instead of to the clip start.

    pip install pocketsphinx numpy      (offline recogniser, no model download; needs ffmpeg)
    python3 scripts/pipeline/vo_words.py [--root <repo>] [--config <file>]    # writes config.wordsFile: {clip stem: [[word, seconds_from_clip_start], ...]}

Accuracy is a few hundredths to ~0.2 s, enough to cue a visual beat. Misheard words are fine. Re-run after replacing any clip.
"""
import json, os, subprocess, sys, tempfile
from lib import parse


def main(argv=None):
    a, root, cfg = parse(__doc__.split('\n')[1], argv=argv)
    try:
        from pocketsphinx import Decoder
    except ImportError:
        sys.exit('pocketsphinx is not installed: pip install pocketsphinx')
    clips = os.path.join(root, cfg['clipsDir'])
    out, tmp = {}, os.path.join(tempfile.gettempdir(), 'vo_words_16k.wav')
    for f in sorted(os.listdir(clips)):
        if not f.endswith('.wav'): continue
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(clips, f), '-ar', '16000', '-ac', '1', '-sample_fmt', 's16', tmp], check=True)
        d = Decoder(samprate=16000)
        d.start_utt(); d.process_raw(open(tmp, 'rb').read()[44:], False, True); d.end_utt()
        out[f[:-4]] = [[s.word.split('(')[0], round(s.start_frame / 100, 2)] for s in d.seg() if not s.word.startswith(('<', '[', '+'))]
        print(f, len(out[f[:-4]]), 'words')
    dest = os.path.join(root, cfg['wordsFile']); os.makedirs(os.path.dirname(dest), exist_ok=True)
    json.dump(out, open(dest, 'w'), indent=0)
    return 0


if __name__ == '__main__':
    sys.exit(main())
