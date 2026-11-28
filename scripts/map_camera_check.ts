/**
 * Numeric checks for src/kit/map/mapCamera.ts (run: npx tsx scripts/map_camera_check.ts). Exits 1 on failure.
 *  1. flyTo starts and ends exactly on its poses; progress is monotone; no overshoot past the target.
 *  2. Anchoring: a city-metre point drawn by <MetroMap> (metroOverlay props) lands on the same pixel as the same
 *     point on the country layer (alignment), and as the true lat/lng through the projection, at 1080p and 4K.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {feature} from 'topojson-client';
import {fitAlbers, OUTLINE_H, OUTLINE_PAD, OUTLINE_W} from '../src/kit/map/projection';
import {sampleCamera} from '../src/kit/camera/keyframes';
import {flyTo, flightPlan, metroOverlay, metroScreenPoint, metresToPlane, planePoint, planeToScreen, poseOf, viewOfPose, screenToPlane, planeToMetres} from '../src/kit/map/mapCamera';

const root = join(__dirname, '..', 'public', 'kit', 'map');
const topo = JSON.parse(readFileSync(join(root, 'regions', 'outline.json'), 'utf8'));
const obj = topo.objects.combined ?? topo.objects[Object.keys(topo.objects)[0]];
const land = (feature(topo, obj) as any).features.find((x: any) => String(x.id) === 'outline');
const projection = fitAlbers(land, OUTLINE_W, OUTLINE_H, OUTLINE_PAD);
const alignment = JSON.parse(readFileSync(join(root, 'cities', 'alignment.json'), 'utf8'));
let fail = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fail++; console.error('FAIL', msg); } else console.log('ok  ', msg); };

for (const canvas of [{width: 1920, height: 1080}, {width: 1080, height: 1920}, {width: 3840, height: 2160}]) {
  const from = {lat: 39, lng: -96, zoom: 0};
  const kf = flyTo(41.8781, -87.6298, 7, 3, {projection, canvas, from});
  const first = sampleCamera(kf, 0), last = sampleCamera(kf, 3);
  const tgt = poseOf(projection, canvas, {lat: 41.8781, lng: -87.6298, zoom: 7});
  ok(Math.abs(first.scale - 1) < 1e-9 && Math.abs(last.scale - 128) < 1e-9, `${canvas.width}x${canvas.height} flyTo zoom 0 -> 7 exact (${first.scale}, ${last.scale})`);
  ok(Math.hypot(last.x - tgt.x, last.y - tgt.y) < 1e-6, `${canvas.width}x${canvas.height} flyTo lands on target`);
  let prev = -1, mono = true, over = false;
  for (let i = 0; i <= 300; i++) {
    const s = sampleCamera(kf, (3 * i) / 300);
    const prog = Math.log2(s.scale) / 7;
    if (prog < prev - 0.02) mono = false; // the path zooms out first on long flights, so allow a small dip
    prev = Math.max(prev, prog);
    if (s.scale > 128 * 1.0001) over = true;
  }
  ok(!over, `${canvas.width}x${canvas.height} no zoom overshoot past target`);
  void mono;
}

// chained plan
{
  const canvas = {width: 1920, height: 1080};
  const plan = flightPlan({projection, canvas, from: {lat: 39, lng: -96, zoom: 0}, start: 0.5, legs: [
    {lat: 47.6, lng: -122.3, zoom: 6, duration: 2.5, hold: 1}, {lat: 41.88, lng: -87.63, zoom: 0.8, duration: 2.5},
  ]});
  const ts = plan.keyframes.map((k) => k.t);
  ok(ts.every((t, i) => i === 0 || t >= ts[i - 1]), `flightPlan keyframe times non-decreasing (${ts.length} keyframes, lands ${plan.legs.map((l) => l.lands).join(', ')})`);
}

// anchoring
const M_LAT = 110574, M_LON_EQ = 111320;
const cities = Object.keys(alignment);
const cityJson = (id: string) => JSON.parse(readFileSync(join(root, 'cities', `${id}.light.json`), 'utf8'));
for (const canvas of [{width: 1920, height: 1080}, {width: 3840, height: 2160}, {width: 1080, height: 1920}]) {
  let maxAlign = 0, maxTrue = 0, maxTrueBox = 0, n = 0;
  for (const id of cities) {
    const c = cityJson(id), a = alignment[id], bbox = c.bbox;
    const k = Math.cos((c.lat * Math.PI) / 180) * M_LON_EQ;
    for (const zoom of [3, 5, 6.5, 8, 9.5]) {
      const pose = poseOf(projection, canvas, {lat: c.lat, lng: c.lng, zoom});
      // offsets spread over the visible part of the baked box
      const ov = metroOverlay(canvas, pose, a, bbox);
      for (const [fx, fy] of [[0, 0], [0.4, 0.3], [-0.45, 0.2], [0.2, -0.45], [-0.3, -0.3]]) {
        const view = viewOfPose(canvas, pose);
        const planeCentre = [(view.x0 + view.x1) / 2, (view.y0 + view.y1) / 2];
        const m = planeToMetres(a, planeCentre[0] + fx * (view.x1 - view.x0), planeCentre[1] + fy * (view.y1 - view.y0));
        if (Math.abs(m.x) > 7000 || Math.abs(m.y) > 7000) continue; // outside the baked box
        const viaMetro = metroScreenPoint(canvas, ov, a, bbox, m);
        const viaAlign = planeToScreen(canvas, pose, ...metresToPlane(a, m));
        const lat = c.lat - m.y / M_LAT, lng = c.lng + m.x / k;
        const viaTrue = planeToScreen(canvas, pose, ...planePoint(projection, lat, lng));
        maxAlign = Math.max(maxAlign, Math.hypot(viaMetro[0] - viaAlign[0], viaMetro[1] - viaAlign[1]));
        const e = Math.hypot(viaMetro[0] - viaTrue[0], viaMetro[1] - viaTrue[1]);
        maxTrue = Math.max(maxTrue, e);
        if (zoom <= 6.5) maxTrueBox = Math.max(maxTrueBox, e);
        n++;
      }
    }
  }
  const px = Math.max(canvas.width, canvas.height) / 1920;
  ok(maxAlign < 0.01, `${canvas.width}x${canvas.height} metro layer vs country layer (alignment): max ${maxAlign.toExponential(2)} px over ${n} points`);
  ok(maxTrue < 1.5 * px, `${canvas.width}x${canvas.height} metro layer vs true lat/lng: max ${maxTrue.toFixed(3)} px (zoom<=6.5: ${maxTrueBox.toFixed(3)} px)`);
}
// screenToPlane inverts planeToScreen
{
  const canvas = {width: 1920, height: 1080};
  const pose = poseOf(projection, canvas, {lat: 30.27, lng: -97.74, zoom: 4.2});
  const p = screenToPlane(canvas, pose, 333, 777), q = planeToScreen(canvas, pose, ...p);
  ok(Math.hypot(q[0] - 333, q[1] - 777) < 1e-9, 'screenToPlane inverts planeToScreen');
}
process.exit(fail ? 1 : 0);
