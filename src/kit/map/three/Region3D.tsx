/**
 * Optional 3D insert: one extruded region (state, or any baked polygon) with a matte material and one soft key light.
 * Isolated: nothing else in the kit imports this file, so `three` is only bundled by entries that import it
 * (import from './map/three', not from './map'). No HDR, no bloom, no blur.
 * Pure function of the frame passed in; seconds in the public API.
 */
import React, {useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
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
  /** Seconds the region takes to rise. */
  rise?: number;
  /** Seconds of the whole insert; the camera drifts over it. */
  duration?: number;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** Projected extrusion shapes of a GeoJSON polygon/multipolygon, fitted into a box of `size` world units. */
export const regionShapes = (feat: any, size: number): THREE.Shape[] => {
  const proj = geoAlbers().fitSize([size, size], feat);
  const toV = (p: number[]) => {
    const q = proj(p as [number, number])!;
    return new THREE.Vector2(q[0] - size / 2, size / 2 - q[1]);
  };
  const polys: number[][][][] = feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
  return polys.map((rings) => {
    const s = new THREE.Shape(rings[0].map(toV));
    for (const h of rings.slice(1)) s.holes.push(new THREE.Path(h.map(toV)));
    return s;
  });
};

const Extrusion: React.FC<{shapes: THREE.Shape[]; depth: number; top: string; side: string}> = ({shapes, depth, top, side}) => {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shapes, {depth: 1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 1}), [shapes]);
  return (
    <mesh geometry={geo} scale={[1, 1, depth]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial attach="material-0" color={top} roughness={1} metalness={0} />
      <meshStandardMaterial attach="material-1" color={side} roughness={1} metalness={0} />
    </mesh>
  );
};

export const Region3D: React.FC<Region3DProps> = ({file = 'states.json', id, t, rise = 1.2, duration = 3}) => {
  const theme = useTheme();
  const {width, height} = theme.canvas;
  const topo = useBakedTopo(file);
  const shapes = useMemo(() => {
    if (!topo) return null;
    const f = allFeatures(topo).features.find((x: any) => String(x.id) === id);
    return f ? regionShapes(f, 6) : null;
  }, [topo, id]);
  if (!shapes) return null;
  const p = Math.min(1, t / Math.max(0.001, duration));
  const k = ease(t / rise);
  // slow orbit-ish drift: azimuth -18..+18 deg, elevation 52 deg, distance in world units
  const az = ((-18 + 36 * p) * Math.PI) / 180;
  const el = (52 * Math.PI) / 180;
  const dist = (height > width ? 12.5 : 9.5);
  const cam = new THREE.Vector3(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{fov: 30, position: cam.toArray() as [number, number, number], near: 0.1, far: 100}}
      onCreated={({camera}) => camera.lookAt(0, 0.2, 0)}
      gl={{antialias: true}}
    >
      <ambientLight intensity={0.55} color={theme.colors.text.secondary} />
      <directionalLight position={[-4, 8, 5]} intensity={2.1} color={theme.colors.text.primary} />
      <Extrusion shapes={shapes} depth={0.001 + 0.5 * k} top={theme.colors.background.lift} side={theme.colors.accent} />
    </ThreeCanvas>
  );
};
