#!/usr/bin/env python3
"""Turns the script lines (config.script) into text a text-to-speech voice reads correctly: numbers, dollars, percentages and
months are spelled out ("$1,620" -> "one thousand six hundred twenty dollars", "Jun 5" -> "June fifth").

    pip install num2words
    python3 scripts/pipeline/tts_prep.py [--root <repo>] [--config <file>]

Writes config.output.ttsDir/ALL.csv (id,section,chars,text) and one text file per section. It only prepares text: it calls no
speech API, so use any voice you like and save the clips as config.clipsDir/<clipNamePattern>.
"""
import csv, os, re, sys
from lib import parse, read_lines

MON = {"Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July", "Aug": "August", "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December"}


def make_speak():
    from num2words import num2words
    words = lambda n: num2words(n).replace(' and ', ' ').replace(',', '')

    def money(m):
        s = m.group(1).replace(',', '')
        if '.' in s:
            d, c = s.split('.')
            return f'{words(int(d))} dollars and {words(int(c))} cents' if int(c) else f'{words(int(d))} dollars'
        return f"{words(int(s))} dollar{'s' if int(s) != 1 else ''}"

    dec = lambda m: f'{words(int(m.group(1)))} point ' + ' '.join(words(int(x)) for x in m.group(2))

    def speak(t):
        t = re.sub(r'\$(\d[\d,]*(?:\.\d+)?)', money, t)
        t = re.sub(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\b', lambda m: f"{MON[m.group(1)]} {num2words(int(m.group(2)), to='ordinal')}", t)
        t = re.sub(r'\b(\d+)\.(\d+)\b', dec, t)
        t = re.sub(r'\b(\d{1,3}(?:,\d{3})+|\d+)\b', lambda m: words(int(m.group(1).replace(',', ''))), t)
        return t.replace('%', ' percent').replace('  ', ' ')
    return speak


def main(argv=None):
    a, root, cfg = parse(__doc__.split('\n')[1], argv=argv)
    try: speak = make_speak()
    except ImportError: sys.exit('num2words is not installed: pip install num2words')
    secs = cfg['sections'] or [dict(id='main', idPrefixes=[], default=True)]
    dflt = next((s['id'] for s in secs if s.get('default')), secs[-1]['id'])
    sec_of = lambda i: next((s['id'] for s in secs if any(i.startswith(p) for p in s.get('idPrefixes', []))), dflt)
    rows = [(r['id'], sec_of(r['id']), speak(r['text'])) for r in read_lines(os.path.join(root, cfg['script']))]
    out = os.path.join(root, cfg['output']['ttsDir']); os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'ALL.csv'), 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh); w.writerow(['id', 'section', 'chars', 'text'])
        for i, s, t in rows: w.writerow([i, s, len(t), t])
    by = {}
    for i, s, t in rows: by.setdefault(s, []).append(t)
    for k, (s, v) in enumerate(by.items(), 1): open(os.path.join(out, f'{k:02d}_{s}.txt'), 'w', encoding='utf-8').write('\n\n'.join(v) + '\n')
    print(len(rows), 'lines,', len(by), 'files,', sum(len(t) for _, _, t in rows), 'characters')
    return 0


if __name__ == '__main__':
    sys.exit(main())
