#!/usr/bin/env python3
"""Final loudness: measure the rendered file, then normalise it with ffmpeg loudnorm (two passes, linear, video stream copied).

    python3 scripts/pipeline/normalize_final.py [--root <repo>] [--config <file>] in.mp4 [out.mp4]      (default out: <in>-final.<ext>)

Target config.normalize.final: lufs (-14, the level YouTube plays at), truePeak (-1 dBTP), lra, audioBitrate. Prints the measured
levels first; when the integrated loudness is already within 1 LU of the target the file is fine as rendered (still written).
"""
import json, os, re, subprocess, sys
from lib import parse


def measure(src, t):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-vn', '-af', f"loudnorm=I={t['lufs']}:TP={t['truePeak']}:LRA={t['lra']}:print_format=json", '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', err, re.S)
    if not m: sys.exit('ffmpeg loudnorm gave no measurement:\n' + err[-600:])
    return json.loads(m.group(0))


def main(argv=None):
    def extra(p):
        p.add_argument('input'); p.add_argument('output', nargs='?')
    a, root, cfg = parse(__doc__.split('\n')[0], extra, argv)
    t = cfg['normalize']['final']
    src = os.path.abspath(a.input)
    dst = os.path.abspath(a.output) if a.output else '{}-final{}'.format(*os.path.splitext(src))
    s = measure(src, t)
    print(f"measured: integrated {s['input_i']} LUFS, true peak {s['input_tp']} dBTP, range {s['input_lra']} LU")
    if abs(float(s['input_i']) - t['lufs']) <= 1: print('within 1 LU of the target already')
    af = (f"loudnorm=I={t['lufs']}:TP={t['truePeak']}:LRA={t['lra']}:measured_I={s['input_i']}:measured_TP={s['input_tp']}:measured_LRA={s['input_lra']}"
          f":measured_thresh={s['input_thresh']}:offset={s['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-map', '0:v?', '-map', '0:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', t['audioBitrate'], '-af', af, dst], check=True)
    print('wrote', dst)
    return 0


if __name__ == '__main__':
    sys.exit(main())
