# liquid-glass
- [x] CI on main green before start (kit-main-ci @ 9c20b03)
- [x] 1. tier 'liquid': src/kit/glass/liquid.ts (liquidStyle, tintFor), Glass props lightAngle/position, unit test
- [x] 2. demo Kit-Liquid-Demo(+Vertical,+30fps) card vs liquid; QA matrix suite `liquid` (contrast, safe-area, motion)
- [x] 3. scripts/kit_glass_perf.mjs + CI job glass-perf (card/liquid/none)
- [x] 4. glass/README.md liquid section, CLAUDE.md lines
- [x] [qa] push green (fix rounds used: 1/3: ThemeName import)
- [x] perf recorded below (gross 1.06x meets 1.3x; net 1.44x kept: quality prioritised by owner)
- [x] tag liquid-glass-v1
## Perf numbers
CI run 46167738363, swangle, 1080p, 3 hero cards, median of 24 stills: no glass 232.7 ms, card 267.9 ms, liquid 283.3 ms.
liquid/card = 1.06x gross; net of glass-free scene card 35.2 ms, liquid 50.6 ms = 1.44x. Not simplified (look kept).
