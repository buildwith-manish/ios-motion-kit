#!/usr/bin/env python3
"""Build step for kit/text: extract per-character advance widths from a font file into a JSON width table.

  python3 scripts/kit-font-metrics.py <font.otf|ttf> <out.json> --name inter-semibold --weight 600

The table stores advances in em (advance / unitsPerEm) for printable ASCII, Latin-1, common typographic punctuation,
currency and Hebrew/Arabic base letters if the font has them. Kerning and shaping (GPOS/GSUB) are NOT applied, so
measured widths are a close estimate (typically within 1-2 % for Latin), not exact; the layout engine adds slack.
"""
import argparse, json
from fontTools.ttLib import TTFont

RANGES = [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2015), (0x2018, 0x201F), (0x2022, 0x2026), (0x2030, 0x2030),
          (0x20A0, 0x20BF), (0x2212, 0x2212), (0x00D7, 0x00D7), (0x0590, 0x05FF), (0x0600, 0x06FF)]

ap = argparse.ArgumentParser()
ap.add_argument('font'); ap.add_argument('out')
ap.add_argument('--name', required=True); ap.add_argument('--weight', type=int, default=400)
a = ap.parse_args()

f = TTFont(a.font)
upm = f['head'].unitsPerEm
cmap = f.getBestCmap()
hmtx = f['hmtx']
adv = {}
for lo, hi in RANGES:
    for cp in range(lo, hi + 1):
        g = cmap.get(cp)
        if g is not None:
            adv[chr(cp)] = round(hmtx[g][0] / upm, 4)
zero = adv.get('0', 0.6)
space = adv.get(' ', 0.28)
out = {'name': a.name, 'weight': a.weight, 'source': a.font.split('/')[-1], 'unitsPerEm': upm,
       'space': space, 'digit': zero, 'fallback': round(sum(adv[c] for c in 'abcdefghijklmnopqrstuvwxyz') / 26, 4),
       'advances': adv}
json.dump(out, open(a.out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(a.out, len(adv), 'glyphs, digit', zero, 'space', space)
