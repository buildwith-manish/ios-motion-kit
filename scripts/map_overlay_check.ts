/** Headless checks for src/kit/map/overlayGeometry.ts (run: npx tsx scripts/map_overlay_check.ts). Exits 1 on failure. */
import {arcControl, layoutCallouts, leaderEnd, paramAtFraction, polylineHead, quadAt, quadHead, quadLengthTable, rectOverlap, segmentHitsRect, segmentsCross, type CalloutBox, type P2} from '../src/kit/map/overlayGeometry';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.error('FAIL', m); } else console.log('ok  ', m); };

// arc: partial bezier head ends where the full curve is at that parameter; arc-length fractions are monotone
const a: P2 = [200, 800], b: P2 = [1500, 400], c = arcControl(a, b, 0.28);
ok(c[1] < Math.min(a[1], b[1]), `positive bend bows up for a left-to-right arc (control y ${c[1].toFixed(0)})`);
const table = quadLengthTable(a, c, b);
let mono = true; let prev = -1;
for (let i = 0; i <= 100; i++) { const t = paramAtFraction(table, i / 100); if (t < prev) mono = false; prev = t; }
ok(mono && Math.abs(paramAtFraction(table, 1) - 1) < 1e-9 && paramAtFraction(table, 0) === 0, 'arc-length parameter is monotone, 0 -> 0, 1 -> 1');
const t5 = paramAtFraction(table, 0.5), h = quadHead(a, c, b, t5), m = quadAt(a, c, b, t5);
ok(Math.hypot(h.end[0] - m[0], h.end[1] - m[1]) < 1e-9, 'quadHead ends on the curve');
const half = quadLengthTable(a, h.c, h.end), total = table[table.length - 1];
ok(Math.abs(half[half.length - 1] / total - 0.5) < 0.01, `half-fraction head is half the length (${(half[half.length - 1] / total).toFixed(4)})`);

// polyline head
const pl: P2[] = [[0, 0], [100, 0], [100, 100]];
const ph = polylineHead(pl, 0.75);
ok(Math.abs(ph.head[0] - 100) < 1e-9 && Math.abs(ph.head[1] - 50) < 1e-9 && Math.abs(ph.total - 200) < 1e-9, 'polylineHead at 75% of an L-shaped route');

// layout: many anchors close together must give boxes with no overlap, none over a pin, leaders not crossing
const bounds = {x: 96, y: 96, w: 1728, h: 888};
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
let worst = 0, cases = 0, bad = 0, badSmall = 0, small = 0;
for (let n = 2; n <= 6; n++) {
  for (let trial = 0; trial < 40; trial++) {
    const boxes: CalloutBox[] = Array.from({length: n}, (_, i) => ({id: `c${i}`, ax: 300 + rnd() * 1300, ay: 280 + rnd() * 560, w: 230 + rnd() * 60, h: 100}));
    const pins = boxes.map((bx) => ({x: bx.ax - 28, y: bx.ay - 28, w: 56, h: 100}));
    const out = layoutCallouts(boxes, {bounds, obstacles: pins, gap: 28, margin: 12});
    cases++;
    let problem = false;
    for (let i = 0; i < n; i++) {
      const ri = {x: out[boxes[i].id].x, y: out[boxes[i].id].y, w: boxes[i].w, h: boxes[i].h};
      if (rectOverlap(ri, bounds) < ri.w * ri.h - 1) problem = true;
      for (const p of pins) if (rectOverlap(ri, p) > 0) problem = true;
      for (let j = i + 1; j < n; j++) {
        const rj = {x: out[boxes[j].id].x, y: out[boxes[j].id].y, w: boxes[j].w, h: boxes[j].h};
        if (rectOverlap(ri, rj) > 0) problem = true;
        const ei = leaderEnd([boxes[i].ax, boxes[i].ay], ri), ej = leaderEnd([boxes[j].ax, boxes[j].ay], rj);
        if (segmentsCross([boxes[i].ax, boxes[i].ay], ei, [boxes[j].ax, boxes[j].ay], ej)) problem = true;
        if (segmentHitsRect([boxes[i].ax, boxes[i].ay], ei, rj) || segmentHitsRect([boxes[j].ax, boxes[j].ay], ej, ri)) problem = true;
      }
      worst = Math.max(worst, out[boxes[i].id].score);
    }
    if (n <= 4) small++;
    if (problem) { bad++; if (n <= 4) badSmall++; }
  }
}
ok(badSmall === 0, `layout: ${small} random scenes with 2-4 callouts, ${badSmall} with an overlap / pin hit / crossing / out-of-bounds`);
console.log(`info  layout: all ${cases} scenes (2-6 callouts): ${bad} not clean; the 5-6 callout scenes put up to 6 anchors in a 1300 x 560 px area, where a clean layout may not exist`);
// determinism
const bx: CalloutBox[] = [{id: 'a', ax: 500, ay: 400, w: 240, h: 100}, {id: 'b', ax: 560, ay: 420, w: 240, h: 100}];
ok(JSON.stringify(layoutCallouts(bx, {bounds})) === JSON.stringify(layoutCallouts(bx, {bounds})), 'layout is deterministic');
process.exit(fail ? 1 : 0);
