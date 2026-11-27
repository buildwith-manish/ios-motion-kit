/**
 * MetroMap level of detail, stroke widths and radial reveal. Everything here is a pure function of its arguments
 * (zoom is a plain number, time is a frame number plus fps); nothing reads a clock or the network.
 *
 * Zoom 1 = "cover": the baked 14 km city box fills the LONGER canvas side, so no canvas edge shows empty land.
 * Zoom 2 shows half of that width, zoom 4 a quarter, and so on.
 */
export type MetroClass = 'primary' | 'secondary' | 'ramp' | 'local' | 'service' | 'other';
export type MetroLodTier = 'major' | 'secondary' | 'local' | 'minor';

/** Draw order, bottom to top. */
export const METRO_CLASS_ORDER: readonly MetroClass[] = ['other', 'service', 'local', 'ramp', 'secondary', 'primary'];
/** Which reveal/LOD tier each road class belongs to. */
export const METRO_TIER: Record<MetroClass, MetroLodTier> = {primary: 'major', secondary: 'secondary', ramp: 'local', local: 'local', service: 'minor', other: 'minor'};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const smoothstep = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Zoom at which each class starts to appear and is fully in. Far out only major roads; local roads need the rich tier. */
export const METRO_LOD_RANGES: Record<MetroClass, readonly [number, number]> = {
  primary: [0, 0.0001],
  secondary: [0.8, 1.5],
  ramp: [1.6, 2.4],
  local: [1.8, 2.8],
  service: [3, 4.2],
  other: [3.2, 4.6],
};

/** Opacity (0..1) per road class at a zoom. Classes at 0 are not drawn at all (and cost nothing). */
export const metroLod = (zoom: number): Record<MetroClass, number> => {
  const out = {} as Record<MetroClass, number>;
  for (const c of METRO_CLASS_ORDER) out[c] = smoothstep(METRO_LOD_RANGES[c][0], METRO_LOD_RANGES[c][1], zoom);
  return out;
};

/** Base stroke width in CSS px at zoom 1 (non-scaling strokes, so 4K via --scale=2 stays crisp). */
export const METRO_STROKE_PX: Record<MetroClass, number> = {primary: 1.8, secondary: 1.1, ramp: 0.8, local: 0.6, service: 0.45, other: 0.4};

/** Widths grow with zoom (roads get fatter as you move in) but sub-linearly, so they never turn into ribbons. */
export const metroWidthScale = (zoom: number): number => Math.min(2.4, Math.max(0.85, Math.pow(Math.max(zoom, 0.01), 0.45)));
export const metroStrokePx = (cls: MetroClass, zoom: number, weight = 1): number => METRO_STROKE_PX[cls] * metroWidthScale(zoom) * weight;

/**
 * Tiered line brightness (alpha of the theme's primary text colour): major roads read brightest, minor ones barely whisper.
 * `light` themes need a little more ink to hold the same hierarchy.
 */
export const METRO_TIER_ALPHA: Record<MetroClass, number> = {primary: 0.88, secondary: 0.52, ramp: 0.4, local: 0.3, service: 0.2, other: 0.16};
export const metroTierAlpha = (cls: MetroClass, light: boolean, compress = false): number => {
  const a = Math.min(1, METRO_TIER_ALPHA[cls] * (light ? 1.3 : 1));
  // dim mode multiplies everything by a low opacity, so the quiet tiers would vanish: compress the range, keep the order
  return compress ? Math.pow(a, 0.55) : a;
};

/** Hero keeps full brightness. Dim sits behind content at low opacity. */
export type MetroMode = 'hero' | 'dim';
export const METRO_DIM_OPACITY = 0.3;

/** Reveal progress per tier: major first, then secondary, local, minor, each starting a little later. */
export const METRO_REVEAL_OFFSET: Record<MetroLodTier, number> = {major: 0, secondary: 0.1, local: 0.22, minor: 0.34};
export const tierReveal = (progress: number, tier: MetroLodTier): number => clamp01((progress - METRO_REVEAL_OFFSET[tier]) / (1 - METRO_REVEAL_OFFSET[tier]));

/** Ease-in-out cubic reveal progress for a frame (0 before `delay`, 1 after delay + duration), so the reveal reads across its whole duration. Seconds in, frame in. */
export const metroRevealProgress = (frame: number, fps: number, delaySeconds: number, durationSeconds: number): number => {
  if (durationSeconds <= 0) return 1;
  const t = clamp01((frame / fps - delaySeconds) / durationSeconds);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** Radius of the soft reveal disc in metres for a progress, reaching `farthest` (+ the soft edge) at 1. */
export const revealRadius = (progress: number, farthest: number, softness = 0.38): number => progress * farthest * (1 + softness);
