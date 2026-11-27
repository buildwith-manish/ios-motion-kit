// Numeric checks for src/kit/camera pure functions: npx tsx scripts/kit-camera-audit.ts
import {sampleCamera, cameraScreenDelta, cameraAt, cameraMotionDelta, lookAt, resolveEase, handheld, HANDHELD_MAX_PX, HANDHELD_MAX_DEG, rackSharpness, rackBlur, RACK_BLUR_CAP, cameraBlurLength, CAMERA_BLUR_CAP, depthTransform, tiltAngles, valueNoise1D} from '../src/kit/camera/index';
import {tiltStyle} from '../src/kit/camera/Tilt3D';
import {iosSpring, SPRING_PRESETS} from '../src/kit/motion';
import {directionalBlurVector, motionBlurLength} from '../src/kit/transitions/MotionBlur';

let failed = 0;
const ok = (name: string, cond: boolean, info = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
};
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;

// underdamped motion
ok('bounce 0 exactly preserves the critically-damped spring', iosSpring(0.37, 0.8, {bounce: 0}) === iosSpring(0.37, 0.8));
ok('hero spring overshoots and settles within 1%', iosSpring(SPRING_PRESETS.hero.response, SPRING_PRESETS.hero.response, SPRING_PRESETS.hero) > 1
  && Math.abs(iosSpring(SPRING_PRESETS.hero.response * 4, SPRING_PRESETS.hero.response, SPRING_PRESETS.hero) - 1) < 0.01);
let bounceThrew = false;
try { iosSpring(0.2, 0.8, {bounce: 0.41}); } catch { bounceThrew = true; }
ok('bounce above 0.4 throws', bounceThrew);

// keyframes
const kf = [{t: 0, x: 0, scale: 1}, {t: 2, x: 300, scale: 2, rotate: 4, ease: 'spring' as const}, {t: 3, x: 300}];
for (const [tt, ex] of [[0, 0], [2, 300], [3, 300]] as const) ok(`lands on keyframe t=${tt}`, near(sampleCamera(kf, tt).x, ex));
ok('holds before first / after last', near(sampleCamera(kf, -5).x, 0) && near(sampleCamera(kf, 9).scale, 2));
ok('scale interpolates in log space (midpoint of 1->2 is sqrt2 with linear ease)', near(sampleCamera([{t: 0, scale: 1, ease: 'linear'}, {t: 1, scale: 2}], 0.5).scale, Math.SQRT2));
ok('omitted fields carry over', sampleCamera([{t: 0, x: 50, y: 7}, {t: 1, scale: 2}], 1).x === 50);
ok('unsorted keyframes are sorted', near(sampleCamera([{t: 2, x: 100}, {t: 0, x: 0}], 2).x, 100));
for (const e of ['ios', 'spring', 'linear', [0.4, 0, 0.2, 1] as const]) {
  const f = resolveEase(e as never, 1.7);
  ok(`ease ${JSON.stringify(e)}: f(0)=0, f(1)=1`, near(f(0), 0, 1e-6) && near(f(1), 1, 1e-6), `f(0.5)=${f(0.5).toFixed(3)}`);
}
const springBounce = resolveEase('spring', 1.2, 0.8, 0.15);
ok('underdamped keyframe ease overshoots then lands at 1', springBounce(0.5) > 1 && near(springBounce(0), 0) && near(springBounce(1), 1));
let threw = false;
try { sampleCamera([{t: 0, scale: 0}], 0); } catch { threw = true; }
ok('scale <= 0 throws', threw);

// fps independence + determinism: the pose at a given time is the same from any frame index/fps
const k2 = [{t: 0, x: 0}, {t: 4, x: 800, scale: 1.5}];
const c60 = cameraAt(120, k2, {fps: 60, width: 1920, height: 1080});
const c30 = cameraAt(60, k2, {fps: 30, width: 1080, height: 1920});
ok('same time -> same pose at 60 and 30 fps / any canvas', near(c60.state.x, c30.state.x) && near(c60.state.scale, c30.state.scale));
ok('same frame twice -> identical', JSON.stringify(cameraAt(77, k2, {fps: 60, width: 1920, height: 1080}, {handheld: true})) === JSON.stringify(cameraAt(77, k2, {fps: 60, width: 1920, height: 1080}, {handheld: true})));

// screen delta
const d = cameraScreenDelta({x: 0, y: 0, scale: 1, rotate: 0}, {x: 10, y: 4, scale: 1, rotate: 0});
ok('pan right 10 / down 4 moves picture (-10,-4)', near(d.dx, -10) && near(d.dy, -4));
ok('zoom 2 doubles screen speed', near(cameraScreenDelta({x: 0, y: 0, scale: 2, rotate: 0}, {x: 10, y: 0, scale: 2, rotate: 0}).dx, -20));
ok('no motion -> exactly 0 delta', cameraAt(10, [{t: 0, x: 5}], {fps: 60, width: 1920, height: 1080}).speed === 0);
const canvas = {fps: 60, width: 1920, height: 1080};
const zoomMove = cameraAt(60, [{t: 0, scale: 1, ease: 'linear'}, {t: 2, scale: 1.5}], canvas);
const rollMove = cameraAt(60, [{t: 0, rotate: 0, ease: 'linear'}, {t: 2, rotate: 20}], canvas);
ok('camera blur vector includes zoom velocity', zoomMove.motionSpeed > 1);
ok('camera blur vector includes roll velocity', rollMove.motionSpeed > 1);
ok('zero pose change has no apparent camera motion', JSON.stringify(cameraMotionDelta(zoomMove.base, zoomMove.base, canvas)) === JSON.stringify({dx: 0, dy: 0}));
const looked = lookAt({x: 900, y: 500, width: 120, height: 80}, {canvas, padding: 100});
ok('lookAt centres and fits a canvas rectangle', near(looked.x, 0) && near(looked.y, 0) && near(looked.scale, 11));
const idLook = lookAt('card', {canvas, zoom: 1.4, elementRects: {card: {x: 1100, y: 500, width: 200, height: 100}}});
ok('lookAt resolves a deterministic element id', near(idLook.x, 240) && near(idLook.y, 10) && idLook.scale === 1.4);
let missingIdThrew = false;
try { lookAt('missing', {canvas}); } catch { missingIdThrew = true; }
ok('lookAt rejects an unresolved element id', missingIdThrew);

// handheld
let maxX = 0, maxR = 0, nonzero = 0;
for (let i = 0; i < 200000; i++) {
  const s = handheld(i / 60, {seed: i % 9, amplitude: 50, rotation: 9});
  maxX = Math.max(maxX, Math.abs(s.x), Math.abs(s.y));
  maxR = Math.max(maxR, Math.abs(s.rotate));
  if (Math.abs(s.x) > 0.01) nonzero++;
}
ok(`handheld clamps even when asked for 50px / 9deg`, maxX <= HANDHELD_MAX_PX + 1e-12 && maxR <= HANDHELD_MAX_DEG + 1e-12, `max ${maxX.toFixed(3)}px ${maxR.toFixed(4)}deg`);
ok('handheld is moving (not constant 0)', nonzero > 100000);
ok('handheld deterministic', JSON.stringify(handheld(3.3, {seed: 5})) === JSON.stringify(handheld(3.3, {seed: 5})) && handheld(3.3, {seed: 5}).x !== handheld(3.3, {seed: 6}).x);
let maxStep = 0;
for (let i = 1; i < 6000; i++) maxStep = Math.max(maxStep, Math.abs(handheld(i / 60, {amplitude: 2}).x - handheld((i - 1) / 60, {amplitude: 2}).x));
ok('handheld is smooth frame to frame at 60 fps', maxStep < 0.2, `max step ${maxStep.toFixed(3)}px`);
ok('noise within [-1,1]', Array.from({length: 5000}, (_, i) => Math.abs(valueNoise1D(i * 0.173 - 400, 3))).every((v) => v <= 1));

// motion blur
ok('blur 0 at/below threshold', cameraBlurLength(3, {threshold: 3}) === 0 && cameraBlurLength(0.5) === 0);
ok('blur threshold never below 1 px/frame', cameraBlurLength(1, {threshold: 0}) === 0 && cameraBlurLength(1.5, {threshold: 0}) > 0);
ok('blur continuous at threshold', cameraBlurLength(3.0001, {threshold: 3}) < 0.001);
ok('blur capped at 20 even if asked for 99', cameraBlurLength(1e6, {cap: 99}) === CAMERA_BLUR_CAP);
const diagonalBlur = directionalBlurVector(3, 4, 0.5, 20, 1);
ok('directional blur follows the full diagonal vector', near(diagonalBlur.dx, 1.5) && near(diagonalBlur.dy, 2) && near(diagonalBlur.length, 2.5));
ok('directional blur gates low speeds and caps length', directionalBlurVector(0.5, 0.5).length === 0 && directionalBlurVector(1e6, 0, 1, 99).length === 20);
ok('legacy blur-length helper also honours the 20px hard cap', motionBlurLength(1e6, 1, 99) === 20);

// rack focus
const sched = [{t: 0, layer: 'a'}, {t: 4, layer: 'b'}];
ok('start: a sharp, b max blurred', rackBlur(0, sched, 'a') === 0 && near(rackBlur(0, sched, 'b'), 10));
ok('settled after pull: b ~sharp, a ~max', rackBlur(6, sched, 'b') < 0.05 && rackBlur(6, sched, 'a') > 9.95);
ok('blur monotonic during pull', Array.from({length: 120}, (_, i) => rackBlur(4 + i / 60, sched, 'a')).every((v, i, a) => i === 0 || v >= a[i - 1] - 1e-12));
ok('blur capped at 20 even if asked for 99', rackBlur(0, sched, 'b', {maxBlur: 99}) === RACK_BLUR_CAP);
const inter = [{t: 0, layer: 'a'}, {t: 2, layer: 'b'}, {t: 2.3, layer: 'a'}];
let maxJump = 0;
for (let i = 1; i < 600; i++) maxJump = Math.max(maxJump, Math.abs(rackSharpness(i / 120, inter, 'a') - rackSharpness((i - 1) / 120, inter, 'a')));
ok('interrupted pull has no jump', maxJump < 0.05, `max step ${maxJump.toFixed(4)}`);

// depth + tilt
const id = depthTransform(0.9, undefined, 5);
ok('no camera, no idle -> identity', id.x === 0 && id.y === 0 && id.scale === 1);
const cam = {x: 200, y: 0, scale: 1.4, rotate: 0};
const far = depthTransform(0, cam, 0), mid = depthTransform(0.5, cam, 0), near1 = depthTransform(1, cam, 0);
ok('focus plane moves with the rig (identity)', near(mid.x, 0) && near(mid.scale, 1));
ok('near layer moves more than far (extra -x vs +x), and near zooms more', near1.x < 0 && far.x > 0 && near1.scale > 1 && far.scale < 1);
const tl = tiltAngles(0, 20, -20, undefined);
ok('tilt clamped to +-6 by default', tl.rotateX === 6 && tl.rotateY === -6);
ok('tilt sets perspective + origin', /perspective\(1400px\)/.test(String(tiltStyle(1, 2).transform)) && tiltStyle(1, 2, 900, '0% 0%').transformOrigin === '0% 0%');
const sw = Array.from({length: 2000}, (_, i) => tiltAngles(i / 60, 5.5, 5.5, {amplitudeX: 3, amplitudeY: 3}));
ok('tilt with sway still within 6', sw.every((a) => Math.abs(a.rotateX) <= 6 && Math.abs(a.rotateY) <= 6));

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
