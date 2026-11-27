/**
 * Optional 3D insert: one shallow, matte extruded region (state, or any baked polygon) rising out of faint flat
 * neighbours. Premium look without HDR, bloom or reflections: top-face gradient, bright chamfer rim, one soft key light
 * plus a faint cool rim light, contact shadow and accent glow on the ground, spring rise with a tiny overshoot,
 * slow camera drift. Colours come from the kit theme tokens only.
 * Isolated: nothing else in the kit imports this file, so `three` is only bundled by entries that import it
 * (import from './map/three', not from './map'). Pure function of the frame passed in; seconds in the public API.
 */
import React, {useLayoutEffect, useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {geoAlbers} from 'd3-geo';
import * as THREE from 'three';
import {useTheme} from '../../tokens';
import {allFeatures, useBakedTopo} from '../RegionLayer';

export interface Region3DProps {
  /** Baked layer file relative to kit/map/regions/, e.g. 'states.json'. */
  file?: string;
  /** Feature id in that layer, e.g. '08'. */
  id: string;
  /** Current time in seconds. */
  t: number;
  /** Seconds the region takes to rise (spring settles around this). */
  rise?: number;
  /** Seconds of the whole insert; the camera drifts over it. */
  duration?: number;
  /** Draw the faint flat neighbours around the region (default true). */
  neighbors?: boolean;
  /** Where the region sits on screen: 'auto' = left in landscape, upper in portrait; 'center' = centred. */
  layout?: 'auto' | 'center';
  /** Ids to leave out of the neighbours (default: Alaska, Hawaii and territories, for state layers). */
  skipIds?: string[];
  /** Reports where the region's pin point (visual centre, inside the polygon) lands on screen, in composition pixels, using the render camera. */
  onAnchor?: (screenX: number, screenY: number) => void;
}

const SIZE = 6; // world units the region's longer side is fitted to
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const smoother = (x: number) => { const k = clamp01(x); return k * k * k * (k * (k * 6 - 15) + 10); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const deg = Math.PI / 180;

/** Under-damped spring 0 -> 1 with a ~3% overshoot. `response` = seconds to (nearly) settle. */
export const riseSpring = (t: number, response = 0.9, damping = 0.74): number => {
  if (t <= 0) return 0;
  const w = (2 * Math.PI) / response;
  const wd = w * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
};

const mix = (a: string | THREE.Color, b: string | THREE.Color, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
/** Scene background shared with the demo: between the deep and base background tokens (matches the reference). */
export const region3dBackground = (theme: {colors: {background: {deep: string; base: string}}}): string => '#' + mix(theme.colors.background.deep, theme.colors.background.base, 0.45).getHexString();

const inPoly = (p: THREE.Vector2, r: THREE.Vector2[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if ((r[i].y > p.y) !== (r[j].y > p.y) && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) c = !c; } return c; };
const edgeDist = (p: THREE.Vector2, r: THREE.Vector2[]) => { let m = Infinity; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; const ab = b.clone().sub(a), l2 = ab.lengthSq(); const k = l2 ? clamp01(p.clone().sub(a).dot(ab) / l2) : 0; m = Math.min(m, p.distanceTo(a.clone().add(ab.multiplyScalar(k)))); } return m; };
/** Visual centre: the point inside the polygon farthest from its edge (grid search + two refinements). */
const poleOf = (ring: THREE.Vector2[]): THREE.Vector2 => {
  const box = new THREE.Box2().setFromPoints(ring);
  let best = box.getCenter(new THREE.Vector2()), bestD = -1;
  let cx = best.x, cy = best.y, hw = (box.max.x - box.min.x) / 2, hh = (box.max.y - box.min.y) / 2;
  for (let pass = 0; pass < 3; pass++) {
    const N = 28;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const q = new THREE.Vector2(cx - hw + (2 * hw * i) / N, cy - hh + (2 * hh * j) / N);
      if (!inPoly(q, ring)) continue;
      const d = edgeDist(q, ring);
      if (d > bestD) { bestD = d; best = q; }
    }
    cx = best.x; cy = best.y; hw /= 4; hh /= 4;
  }
  return best;
};
const ringArea = (r: THREE.Vector2[]) => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; };

/** Drops points closer than eps to the last kept one: removes the thin slivers that make jagged coastal walls. */
const decimate = (pts: THREE.Vector2[], eps: number): THREE.Vector2[] => {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) if (pts[i].distanceTo(out[out.length - 1]) >= eps) out.push(pts[i]);
  while (out.length > 3 && out[out.length - 1].distanceTo(out[0]) < eps) out.pop();
  return out.length >= 3 ? out : pts;
};
/** One light Chaikin pass: rounds corners without moving straight runs. */
const chaikin = (pts: THREE.Vector2[], r = 0.18): THREE.Vector2[] => {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push(a.clone().lerp(b, r), a.clone().lerp(b, 1 - r)); }
  return out;
};

interface Built {shapes: THREE.Shape[]; w: number; h: number; cx: number; cy: number; outers: THREE.Vector2[][]}

const buildShapes = (feat: any, proj: any, o: {eps: number; minArea: number; minHole: number; smooth: boolean; shrink?: number}): Built => {
  const toV = (p: number[]) => { const q = proj(p as [number, number]); return q ? new THREE.Vector2(q[0] - SIZE / 2, SIZE / 2 - q[1]) : null; };
  const polys: number[][][][] = feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
  const clean = (ring: number[][]) => {
    const r = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
    const v = r.map(toV).filter(Boolean) as THREE.Vector2[];
    return v.length >= 3 ? v : null;
  };
  const kept: {outer: THREE.Vector2[]; holes: THREE.Vector2[][]}[] = [];
  for (const rings of polys) {
    let outer = clean(rings[0]);
    if (!outer || ringArea(outer) < o.minArea) continue;
    outer = decimate(outer, o.eps);
    if (o.smooth) outer = chaikin(chaikin(outer, 0.22), 0.22);
    const holes = rings.slice(1).map(clean).filter((h): h is THREE.Vector2[] => !!h && ringArea(h) >= o.minHole).map((h) => (o.smooth ? chaikin(chaikin(decimate(h, o.eps), 0.22), 0.22) : decimate(h, o.eps)));
    kept.push({outer, holes});
  }
  const all = kept.flatMap((k) => k.outer);
  const box = new THREE.Box2().setFromPoints(all.length ? all : [new THREE.Vector2()]);
  const c = box.getCenter(new THREE.Vector2());
  const sz = box.getSize(new THREE.Vector2());
  const sh = o.shrink ?? 1;
  const adj = (r: THREE.Vector2[], about: THREE.Vector2) => (sh === 1 ? r : r.map((p) => p.clone().sub(about).multiplyScalar(sh).add(about)));
  const shapes = kept.map(({outer, holes}) => {
    const b = new THREE.Box2().setFromPoints(outer); const ctr = b.getCenter(new THREE.Vector2());
    const s = new THREE.Shape(adj(outer, ctr));
    for (const h of holes) s.holes.push(new THREE.Path(adj(h, ctr)));
    return s;
  });
  return {shapes, w: sz.x, h: sz.y, cx: c.x, cy: c.y, outers: kept.map((k) => k.outer)};
};

/** Target slab: depth-1 extrusion (scaled in z at render). Top face: 3-stop diagonal gradient (upper-left to lower-right); walls darken toward the base and with facing; the chamfer is the bright rim. */
interface SlabColors {top0: THREE.Color; topMid: THREE.Color; top1: THREE.Color; wallLo: THREE.Color; wallHi: THREE.Color; glint: THREE.Color; rim: THREE.Color}
const slabGeometry = (shapes: THREE.Shape[], c: SlabColors, w: number, h: number, cx: number, cy: number) => {
  const STEPS = 14, BT = 0.05;
  const g = new THREE.ExtrudeGeometry(shapes, {depth: 1, steps: STEPS, bevelEnabled: true, bevelSize: 0.03, bevelOffset: -0.03, bevelThickness: BT, bevelSegments: 2, curveSegments: 3});
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (const grp of g.groups) {
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (grp.materialIndex === 0) {
        // top cap: diagonal teal (upper-left) -> mid -> deep blue (lower-right), eased
        const u = smooth(0, 1, clamp01(0.5 + ((x - cx) / w) * 0.5 - ((y - cy) / h) * 0.5));
        if (u < 0.5) tmp.copy(c.top0).lerp(c.topMid, u / 0.5); else tmp.copy(c.topMid).lerp(c.top1, (u - 0.5) / 0.5);
        if (z > 1.0005) tmp.lerp(c.rim, 0.0);
      } else if (z > 1.0005) tmp.copy(c.rim); // chamfer: the bright edge
      else {
        if (z > 1 - 1.6 / STEPS) tmp.copy(c.wallHi).lerp(c.glint, 0.9); // thin glint just under the rim
        else tmp.copy(c.wallLo).lerp(c.wallHi, smooth(0, 1, clamp01(z)));
        // walls facing the camera / key light (south and west) are lighter than the others
        const nx = nor.getX(i), ny = nor.getY(i);
        const facing = clamp01(0.55 + 0.45 * (-ny * 0.9 - nx * 0.4));
        tmp.multiplyScalar(0.72 + 0.5 * facing);
      }
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
};

/** Neighbour tile: very low, unlit, colours fade into the background with distance from the region. */
const tileGeometry = (shapes: THREE.Shape[], c: {top: THREE.Color; edge: THREE.Color; side: THREE.Color; bg: THREE.Color}, r0: number, r1: number) => {
  const g = new THREE.ExtrudeGeometry(shapes, {depth: 1, steps: 1, bevelEnabled: false, curveSegments: 1});
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (const grp of g.groups) {
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (grp.materialIndex === 0) tmp.copy(c.top); else tmp.copy(c.side).lerp(c.edge, z > 0.5 ? 1 : 0);
      tmp.lerp(c.bg, 0.94 * smooth(r0, r1, Math.hypot(x, y)));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
};

const radialTexture = (rgb: [number, number, number], peak: number) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  const [r, g, b] = rgb.map((v) => Math.round(v * 255));
  gr.addColorStop(0, `rgba(${r},${g},${b},${peak})`);
  gr.addColorStop(0.45, `rgba(${r},${g},${b},${peak * 0.5})`);
  gr.addColorStop(0.8, `rgba(${r},${g},${b},${peak * 0.12})`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
};

const CameraRig: React.FC<{pos: [number, number, number]; target: [number, number, number]; width: number; height: number; offX: number; offY: number}> = ({pos, target, width, height, offX, offY}) => {
  const {camera} = useThree();
  // runs on every render, so each frame of a video render gets its own pose. The view offset shifts the picture in screen
  // space (pixels) without changing the perspective, so the region can sit left of / above centre and stay undistorted.
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...pos); cam.lookAt(...target);
    if (offX || offY) cam.setViewOffset(width, height, offX, offY, width, height); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  });
  return null;
};

const SKIP_DEFAULT = ['02', '15', '60', '66', '69', '72', '78'];
const FOV = 26;

export const Region3D: React.FC<Region3DProps> = ({file = 'states.json', id, t, rise = 1.0, duration = 3, neighbors = true, layout = 'auto', skipIds = SKIP_DEFAULT, onAnchor}) => {
  const theme = useTheme();
  const {width, height} = theme.canvas;
  const portrait = height > width;
  const aspect = width / height;
  const topo = useBakedTopo(file);
  const fov = FOV;
  // composition: where the region's centre sits in the frame, as a fraction of the frame (reference: left of centre in
  // landscape to leave room for the card, upper part in portrait)
  const fx = layout === 'center' || portrait ? 0.5 : 0.4;
  const fy = layout === 'center' || !portrait ? 0.5 : 0.43;
  const offX = -(fx - 0.5) * width, offY = -(fy - 0.5) * height;

  const scene = useMemo(() => {
    if (!topo) return null;
    const fc = allFeatures(topo);
    const target = fc.features.find((x: any) => String(x.id) === id);
    if (!target) return null;
    const proj = geoAlbers().fitSize([SIZE, SIZE], target);
    const main = buildShapes(target, proj, {eps: SIZE * 0.01, minArea: SIZE * SIZE * 0.0005, minHole: SIZE * SIZE * 0.004, smooth: true});
    const maxDim = Math.max(main.w, main.h);
    const depth = 0.055 * maxDim;
    // pin point: visual centre of the largest part
    const big = main.outers.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a), main.outers[0]);
    const pole = poleOf(big);
    // camera fit: the bounding extent fills the same share of the frame in every state, at the widest drift angle
    const fillW = portrait ? 0.8 : 0.62, fillH = portrait ? 0.34 : 0.56;
    const elMax = 60 * deg, elMin = 53 * deg, azMax = 5 * deg;
    const wExt = main.w * Math.cos(azMax) + main.h * Math.sin(azMax);
    const hExt = main.h * Math.sin(elMax) + depth * Math.cos(elMin);
    const tanH = Math.tan((fov * deg) / 2);
    const dist = Math.max(wExt / (2 * tanH * aspect * fillW), hExt / (2 * tanH * fillH)) * 1.02;
    const visH = 2 * dist * tanH, visW = visH * aspect;
    const r0 = maxDim * 0.85, r1 = Math.max(visW, visH) * 0.62;
    const bg = mix(theme.colors.background.deep, theme.colors.background.base, 0.45);
    const tiles: {geo: THREE.BufferGeometry; key: string}[] = [];
    if (neighbors) {
      const c = {top: mix(theme.colors.background.base, theme.colors.background.lift, 0.25), edge: mix(theme.colors.background.lift, theme.colors.text.secondary, 0.16), side: new THREE.Color(theme.colors.background.deep), bg};
      for (const f of fc.features) {
        const fid = String(f.id);
        if (fid === id || skipIds.includes(fid)) continue;
        const b = buildShapes(f, proj, {eps: SIZE * 0.011, minArea: SIZE * SIZE * 0.003, minHole: Infinity, smooth: false, shrink: 0.992});
        if (!b.shapes.length) continue;
        const dx = Math.max(0, Math.abs(b.cx - main.cx) - (b.w + main.w) / 2), dy = Math.max(0, Math.abs(b.cy - main.cy) - (b.h + main.h) / 2);
        if (Math.hypot(dx, dy) > r1 * 1.05) continue;
        tiles.push({geo: tileGeometry(b.shapes, c, r0, r1), key: fid});
      }
    }
    // reference palette, all from theme tokens: a teal between the cool tint and the accent, darkened toward the deep background
    const teal = mix(theme.colors.tint.a, theme.colors.accent, 0.42);
    const slab = slabGeometry(main.shapes, {
      top0: mix(theme.colors.background.deep, teal, 0.7),
      topMid: mix(theme.colors.background.deep, theme.colors.tint.a, 0.42),
      top1: mix(theme.colors.background.base, theme.colors.background.lift, 0.53),
      wallHi: mix(theme.colors.background.deep, teal, 0.22),
      wallLo: mix(theme.colors.background.deep, teal, 0.08),
      glint: mix(theme.colors.background.deep, teal, 0.4),
      rim: mix(teal, theme.colors.text.primary, 0.42),
    }, main.w, main.h, main.cx, main.cy);
    return {main, maxDim, depth, dist, visW, visH, tiles, slab, tileH: 0.012 * maxDim, pole, teal, bg};
  }, [topo, id, neighbors, portrait, aspect, theme, skipIds]);

  const shadowTex = useMemo(() => radialTexture([0, 0, 0], 0.7), []);
  const glowTex = useMemo(() => { const c = scene ? scene.teal : new THREE.Color(theme.colors.accent); return radialTexture([c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2)) as [number, number, number], 0.5); }, [theme, scene]);

  // camera pose for this frame (pure function of t)
  const p = clamp01(t / Math.max(0.001, duration));
  const k = riseSpring(t - 0.15, rise); // tiny overshoot, then rests at 1
  const ep = smoother(p);
  const az = (-2 - 3 * ep) * deg;
  const el = (60 - 7 * easeOut(t / (rise + 0.9))) * deg; // tilts down onto the region as it lands
  const pose = scene ? (() => {
    const d = scene.dist * (1.04 - 0.04 * ep);
    const look: [number, number, number] = [scene.main.cx, scene.depth * 0.35, -scene.main.cy];
    const cam: [number, number, number] = [look[0] + Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, look[2] + Math.cos(az) * Math.cos(el) * d];
    // anchor on screen: the same camera and view offset as the render
    const pc = new THREE.PerspectiveCamera(fov, aspect, 0.1, 200);
    pc.position.set(...cam); pc.lookAt(...look);
    if (offX || offY) pc.setViewOffset(width, height, offX, offY, width, height);
    pc.updateProjectionMatrix(); pc.updateMatrixWorld();
    const v = new THREE.Vector3(scene.pole.x, scene.depth * 1.05 * Math.max(0.0008, k), -scene.pole.y).project(pc);
    return {look, cam, sx: (v.x * 0.5 + 0.5) * width, sy: (-v.y * 0.5 + 0.5) * height};
  })() : null;
  const ax = pose ? Math.round(pose.sx * 10) / 10 : null, ay = pose ? Math.round(pose.sy * 10) / 10 : null;
  useLayoutEffect(() => { if (ax !== null && ay !== null) onAnchor?.(ax, ay); }, [ax, ay, onAnchor]);
  if (!scene || !pose) return null;
  const {main, maxDim, depth, tiles, slab, tileH} = scene;
  const {look, cam} = pose;
  void look;

  const grow = Math.max(0.0008, k);
  const shadowA = clamp01(k);

  return (
    <ThreeCanvas width={width} height={height} camera={{fov, near: 0.1, far: 200, position: cam}} gl={{antialias: true}}>
      <CameraRig pos={cam} target={pose.look} width={width} height={height} offX={offX} offY={offY} />
      {/* faint flat neighbours: the region rises out of these (unlit, so colours are exactly the theme mixes) */}
      {tiles.map(({geo, key}) => (
        <mesh key={key} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, tileH]}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      ))}
      {/* soft teal ground glow and a tighter contact shadow lie just above the neighbour tops */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[main.cx, tileH + 0.002, -main.cy]} scale={[main.w * 1.9 + maxDim * 0.5, main.h * 1.9 + maxDim * 0.5, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTex} transparent depthWrite={false} opacity={shadowA} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[main.cx + maxDim * 0.03, tileH + 0.004, -main.cy - maxDim * 0.04]} scale={[main.w * 1.28, main.h * 1.28, 1]} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={shadowA} toneMapped={false} />
      </mesh>
      <mesh geometry={slab} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, Math.max(0.0008, depth * grow)]} renderOrder={3}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
    </ThreeCanvas>
  );
};
