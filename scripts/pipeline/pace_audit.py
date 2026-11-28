#!/usr/bin/env python3
"""Pacing audit: reads the layout (config.output.layout) and flags shots that run long without a visual beat.

    python3 scripts/pipeline/pace_audit.py [--root <repo>] [--config <file>] [--limit 4.5]

Lists, per scene (shot ids like "s02_01" group as "s02"), the shots whose speech is longer than the limit (config.paceLimit)
and the longest gap between word cues inside them, so you know where to add a beat (a new element, a count, a punch-in).
Always exits 0: it is an audit, not a gate.
"""
import json, os, re, sys
from lib import parse


def main(argv=None):
    a, root, cfg = parse(__doc__.split('\n')[1], lambda p: p.add_argument('--limit', type=float, default=None), argv)
    LIMIT = a.limit if a.limit is not None else cfg['paceLimit']
    shots = json.load(open(os.path.join(root, cfg['output']['layout'])))['shots']
    scenes = {}
    for s in shots:
        key = re.match(r'([A-Za-z]+\d+)_', s['id'])
        scenes.setdefault(key.group(1) if key else s['id'], []).append(s)
    total = 0
    for name, lst in scenes.items():
        flagged = [s for s in lst if (s['speechEnd'] - s['speechStart']) > LIMIT]
        dur = lst[-1]['start'] + lst[-1]['seconds'] - lst[0]['start']
        print(f"{name:6s} {dur:6.1f}s  {len(lst):2d} shots  {len(flagged)} longer than {LIMIT}s")
        for s in flagged:
            words = s.get('words') or []
            times = [0.0] + [w[1] for w in words] + [s['speechEnd'] - s['speechStart']]
            gap = max((y - x) for x, y in zip(times, times[1:]))
            print(f"    {s['id']:12s} speech {s['speechEnd'] - s['speechStart']:5.1f}s  longest silent gap {gap:4.1f}s  | {s['text'][:70]}")
        total += len(flagged)
    print(f"\n{total} shots longer than {LIMIT}s. Check each for a visual beat (new element, count, punch-in) about every 2.5 s.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
