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

const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
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

interface Built {shapes: THREE.Shape[]; w: number; h: number; cx: number; cy: number}

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
    if (o.smooth) outer = chaikin(outer);
    const holes = rings.slice(1).map(clean).filter((h): h is THREE.Vector2[] => !!h && ringArea(h) >= o.minHole).map((h) => (o.smooth ? chaikin(decimate(h, o.eps)) : decimate(h, o.eps)));
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
  return {shapes, w: sz.x, h: sz.y, cx: c.x, cy: c.y};
};

/** Target slab: depth-1 extrusion (scaled in z at render), stepped walls so the rim colour stays a thin line. */
const slabGeometry = (shapes: THREE.Shape[], c: {top0: THREE.Color; top1: THREE.Color; wallLo: THREE.Color; wallHi: THREE.Color; rim: THREE.Color}, w: number, h: number) => {
  const STEPS = 12, BT = 0.05;
  const g = new THREE.ExtrudeGeometry(shapes, {depth: 1, steps: STEPS, bevelEnabled: true, bevelSize: 0.028, bevelOffset: -0.028, bevelThickness: BT, bevelSegments: 2, curveSegments: 2});
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (const grp of g.groups) {
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (grp.materialIndex === 0) {
        // top cap: lighter toward the key light (left / front), darker away
        const u = clamp01(0.5 + (-(x / w) * 0.55 - (y / h) * 0.55));
        tmp.copy(c.top1).lerp(c.top0, u);
      } else if (z > 1.0005) tmp.copy(c.rim); // chamfer: the bright edge
      else if (z > 1 - 1.5 / STEPS) tmp.copy(c.wallHi).lerp(c.rim, 0.45); // thin glint just under it
      else tmp.copy(c.wallLo).lerp(c.wallHi, easeOut(clamp01(z)));
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

const CameraRig: React.FC<{pos: [number, number, number]; target: [number, number, number]}> = ({pos, target}) => {
  const {camera} = useThree();
  // runs on every render, so each frame of a video render gets its own pose
  useLayoutEffect(() => { camera.position.set(...pos); camera.lookAt(...target); camera.updateProjectionMatrix(); });
  return null;
};

const SKIP_DEFAULT = ['02', '15', '60', '66', '69', '72', '78'];

export const Region3D: React.FC<Region3DProps> = ({file = 'states.json', id, t, rise = 1.0, duration = 3, neighbors = true, layout = 'auto', skipIds = SKIP_DEFAULT}) => {
  const theme = useTheme();
  const {width, height} = theme.canvas;
  const portrait = height > width;
  const aspect = width / height;
  const topo = useBakedTopo(file);
  const fov = 26;

  const scene = useMemo(() => {
    if (!topo) return null;
    const fc = allFeatures(topo);
    const target = fc.features.find((x: any) => String(x.id) === id);
    if (!target) return null;
    const proj = geoAlbers().fitSize([SIZE, SIZE], target);
    const main = buildShapes(target, proj, {eps: SIZE * 0.0055, minArea: SIZE * SIZE * 0.0004, minHole: SIZE * SIZE * 0.004, smooth: true});
    const maxDim = Math.max(main.w, main.h);
    const depth = 0.085 * maxDim;
    // camera fit: distance so the region fills a set share of the frame at the widest drift angle
    const fillW = portrait ? 0.8 : 0.46, fillH = portrait ? 0.34 : 0.62;
    const elMin = 50 * deg, azMax = 14 * deg;
    const wExt = main.w * Math.cos(azMax) + main.h * Math.sin(azMax);
    const hExt = main.h * Math.sin(elMin) + depth * Math.cos(elMin);
    const tanH = Math.tan((fov * deg) / 2);
    const dist = Math.max(wExt / (2 * tanH * aspect * fillW), hExt / (2 * tanH * fillH));
    const visH = 2 * dist * tanH, visW = visH * aspect;
    const r0 = maxDim * 0.85, r1 = Math.max(visW, visH) * 0.62;
    const tiles: {geo: THREE.BufferGeometry; key: string}[] = [];
    if (neighbors) {
      const c = {top: mix(theme.colors.background.base, theme.colors.background.lift, 0.42), edge: mix(theme.colors.background.lift, theme.colors.text.secondary, 0.32), side: new THREE.Color(theme.colors.background.deep), bg: new THREE.Color(theme.colors.background.base)};
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
    const slab = slabGeometry(main.shapes, {
      top0: mix(theme.colors.background.lift, theme.colors.accent, 0.1),
      top1: mix(theme.colors.background.lift, theme.colors.text.primary, 0.2),
      wallLo: mix(theme.colors.accent, theme.colors.background.deep, 0.82),
      wallHi: mix(theme.colors.accent, theme.colors.background.base, 0.5),
      rim: mix(theme.colors.accent, theme.colors.text.primary, 0.62),
    }, main.w, main.h);
    return {main, maxDim, depth, dist, visW, visH, tiles, slab, tileH: 0.012 * maxDim};
  }, [topo, id, neighbors, portrait, aspect, theme, skipIds]);

  const shadowTex = useMemo(() => radialTexture([0, 0, 0], 0.62), []);
  const glowTex = useMemo(() => { const c = new THREE.Color(theme.colors.accent); return radialTexture([c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2)) as [number, number, number], 0.2); }, [theme]);
  if (!scene) return null;
  const {main, maxDim, depth, dist, visW, visH, tiles, slab, tileH} = scene;

  const p = clamp01(t / Math.max(0.001, duration));
  const k = riseSpring(t - 0.15, rise); // tiny overshoot, then rests at 1
  const ep = smoother(p);
  const az = (-13 + 26 * ep) * deg;
  const el = (66 - 15 * easeOut(t / (rise + 0.9))) * deg; // tilts down onto the region as it lands
  const d = dist * (1.05 - 0.05 * ep);
  // frame composition: landscape puts the region left of centre (room for the card), portrait puts it in the upper part
  const shiftX = layout === 'center' || portrait ? 0 : visW * 0.2;
  const shiftZ = layout === 'center' || !portrait ? 0 : visH * 0.12;
  const look: [number, number, number] = [main.cx + shiftX, depth * 0.35, -main.cy + shiftZ];
  const cam: [number, number, number] = [look[0] + Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, look[2] + Math.cos(az) * Math.cos(el) * d];
  const grow = Math.max(0.0008, k);
  const shadowA = clamp01(k);
  const shW = main.w * 1.5, shH = main.h * 1.5;

  return (
    <ThreeCanvas width={width} height={height} camera={{fov, near: 0.1, far: 200, position: cam}} gl={{antialias: true}}>
      <CameraRig pos={cam} target={look} />
      <ambientLight intensity={1.15} color={theme.colors.text.secondary} />
      <directionalLight position={[-4, 8, 6]} intensity={3.1} color={theme.colors.text.primary} />
      <directionalLight position={[5, 3, -7]} intensity={1.5} color={mix(theme.colors.text.primary, theme.colors.tint.a, 0.6)} />
      {/* faint flat neighbours: the region rises out of these */}
      {tiles.map(({geo, key}) => (
        <mesh key={key} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, tileH]}>
          <meshBasicMaterial vertexColors />
        </mesh>
      ))}
      {/* accent glow and contact shadow lie just above the neighbour tops */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[main.cx, tileH + 0.002, -main.cy]} scale={[main.w * 2.1, main.h * 2.1, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTex} transparent depthWrite={false} opacity={shadowA} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[main.cx + maxDim * 0.05, tileH + 0.004, -main.cy - maxDim * 0.035]} scale={[shW, shH, 1]} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={shadowA} />
      </mesh>
      <mesh geometry={slab} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, Math.max(0.0008, depth * grow)]} renderOrder={3}>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
      </mesh>
    </ThreeCanvas>
  );
};
