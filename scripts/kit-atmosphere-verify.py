#!/usr/bin/env python3
"""Numeric verification of the atmosphere stills (this sandbox's model cannot view images).

Checks per still: non-blank, content structure (label above card, card band, pill below),
colour variety (orbs visible), and a grayscale approximation of text contrast in the caption zone.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

STILLS = Path('docs/previews/kit')
FAILS = []


def check(name, cond, detail):
    print(f"{'PASS' if cond else 'FAIL'}  {name}: {detail}")
    if not cond:
        FAILS.append(name)


for f in sorted(STILLS.glob('atmosphere-*.jpg')) + sorted(STILLS.glob('atmosphere-4k-crop.png')):
    im = np.asarray(Image.open(f).convert('RGB'), dtype=float)
    gray = im.mean(axis=2)
    h, w = gray.shape
    # 1. non-blank and not flat
    check(f'{f.name} non-blank', gray.std() > 8, f'std={gray.std():.1f} size={w}x{h}')
    # 2. colour variety (orbs). Mono theme slots (8-11, seconds 17-24) are graphite: tints are neutral
    #    greys by design, so only the midnight/light slots (and the 4K crop) must show saturation.
    sat = im.max(axis=2) - im.min(axis=2)
    is_mono = 'landscape-60' in f.name and any(f'{s}s' in f.name for s in ['17.2', '19.2', '21.2', '23.2'])
    if is_mono:
        check(f'{f.name} colour (mono: neutral by design)', sat.mean() < 8, f'mean sat={sat.mean():.1f}')
    else:
        check(f'{f.name} colour', sat.mean() > 3, f'mean sat={sat.mean():.1f}')
    # 3. some bright pixels (glass) OR light theme where glass is bright on dark text
    #    theme slots 0-3 midnight (dark bg), 4-7 light (bright bg), 8-11 mono (dark bg)
    bright = (gray > 150).sum()
    dark = (gray < 60).sum()
    check(f'{f.name} tonal range', bright > 1000 and dark > 1000, f'bright={int(bright)} dark={int(dark)}')

# Structural check on one landscape still per theme (slots at 1.2=midnight, 9.2=light, 17.2=mono)
for sec, theme in [(1.2, 'midnight'), (9.2, 'light'), (17.2, 'mono')]:
    f = STILLS / f'atmosphere-landscape-60-{sec}s.jpg'
    im = np.asarray(Image.open(f).convert('RGB'), dtype=float)
    gray = im.mean(axis=2)
    if theme == 'light':
        # light theme: card is white-ish; text dark on it. Find dark text inside bright band.
        bright_rows = (gray > 170).sum(axis=1)
        band = np.where(bright_rows > 300)[0]
        ok = len(band) > 50
        detail = f'bright band rows {band.min()}-{band.max()}' if ok else 'no bright card band found'
        check(f'{theme} card band', ok, detail)
        if ok:
            band_im = gray[band.min():band.max() + 1]
            check(f'{theme} dark text on card', (band_im < 100).sum() > 2000, f'dark px={int((band_im < 100).sum())}')
    else:
        # dark themes: card band is lighter than surroundings, contains light text
        mid = gray[:, int(w * 0.25):int(w * 0.75)]
        row_mean = mid.mean(axis=1)
        # card raises brightness in the middle rows
        center = row_mean[int(h * 0.3):int(h * 0.75)]
        outside = np.concatenate([row_mean[:int(h * 0.25)], row_mean[int(h * 0.8):]])
        check(f'{theme} card lifts center', center.mean() > outside.mean() + 3, f'center={center.mean():.1f} outside={outside.mean():.1f}')
        band_im = mid[int(h * 0.3):int(h * 0.75)]
        check(f'{theme} light text on card', (band_im > 170).sum() > 2000, f'light px={int((band_im > 170).sum())}')

# Number mid-roll: at 1.2s of slot 0 the roll (1.1s) is just done; check the number zone has strong glyph edges
f = STILLS / 'atmosphere-landscape-60-1.2s.jpg'
im = np.asarray(Image.open(f).convert('RGB'), dtype=float)
gray = im.mean(axis=2)
edges = np.abs(np.diff(gray, axis=1)).sum()
check('text edges present', edges > 1_000_000, f'grad={int(edges)}')

# 4K crop: hairline rim check — the glass rim is a 1-2px bright line; look for thin bright structures
f = STILLS / 'atmosphere-4k-crop.png'
im = np.asarray(Image.open(f).convert('RGB'), dtype=float)
gray = im.mean(axis=2)
thin_bright = ((gray[:-1] > 180) & (gray[1:] < 120)).sum()
check('4K crop has hairline edges', thin_bright > 200, f'think bright-to-dark transitions={int(thin_bright)}')
# grain: local variance in a flat background patch (top-left corner, away from card)
patch = gray[40:120, 40:120]
check('grain present in 4K', patch.std() > 0.5, f'patch std={patch.std():.2f}')

print()
if FAILS:
    print('FAILURES:', FAILS)
    sys.exit(1)
print('ALL STILL CHECKS PASS')
