import type {CSSProperties} from 'react';
import {radius as radiusPx, shadowCss, unit} from '../tokens/helpers';
import type {RadiusKey, Theme} from '../tokens/types';

/** Compass angle (deg, 0 = up, clockwise) the light comes FROM by default: top-left. */
export const LIQUID_LIGHT_DEG = 315;

/** Where the glass sits on the canvas, each 0-1 (centre of the element). Used only by tintFor. */
export interface GlassPosition {
  x: number;
  y: number;
}

/** Result of tintFor(): an rgba colour string and its alpha (already inside the string). */
export interface LiquidTint {
  color: string;
  alpha: number;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** '#rgb' | '#rrggbb' | 'rgb(a)(r,g,b[,a])' -> [r,g,b,a]. */
const parse = (c: string): [number, number, number, number] => {
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = c.match(/[\d.]+/g) ?? ['255', '255', '255'];
  return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
};
/** Same colour, new alpha. Works on the theme's hex and rgba token strings. */
const withAlpha = (c: string, a: number): string => {
  const [r, g, b] = parse(c);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${r3(clamp01(a))})`;
};

/** Orb anchors of the kit's ambient backdrops (x, y in 0-1) and the theme tint each one carries. */
const ANCHORS: ReadonlyArray<{x: number; y: number; key: 'a' | 'b' | 'c' | 'd'}> = [
  {x: 0.22, y: 0.18, key: 'a'},
  {x: 0.8, y: 0.38, key: 'b'},
  {x: 0.3, y: 0.68, key: 'c'},
  {x: 0.78, y: 0.86, key: 'd'},
];

/** Share of orbMaxAlpha the adaptive tint may use. Keeps text contrast inside the QA envelope. */
const TINT_ALPHA_SHARE = 0.34;

/**
 * Pure adaptive tint: blends the theme's four backdrop tints by inverse-square distance from `position` (0-1 canvas
 * coordinates of the glass centre), so the glass echoes the colour of the area it sits over. No pixel reading.
 * Alpha is capped at `orbMaxAlpha * 0.34`, so it never lifts the backdrop beyond what contrast was tuned for.
 * @example tintFor(midnight, {x: 0.25, y: 0.2}) // mostly tint.a
 */
export const tintFor = (theme: Theme, position: GlassPosition): LiquidTint => {
  const px = clamp01(position.x);
  const py = clamp01(position.y);
  let wSum = 0;
  const acc = [0, 0, 0];
  for (const a of ANCHORS) {
    const d2 = (px - a.x) ** 2 + (py - a.y) ** 2;
    const w = 1 / (d2 + 0.02);
    const [r, g, b] = parse(theme.colors.tint[a.key]);
    acc[0] += r * w;
    acc[1] += g * w;
    acc[2] += b * w;
    wSum += w;
  }
  const alpha = r3(theme.colors.orbMaxAlpha * TINT_ALPHA_SHARE);
  return {color: `rgba(${Math.round(acc[0] / wSum)},${Math.round(acc[1] / wSum)},${Math.round(acc[2] / wSum)},${alpha})`, alpha};
};

/** Options for liquidStyle(). */
export interface LiquidOptions {
  /** Compass angle (deg, 0 = up, clockwise) the light comes from. Default 315 (top-left). May animate per frame. */
  lightAngle?: number;
  /** Glass centre on the canvas (0-1). Omit for no adaptive tint. */
  position?: GlassPosition;
  /** Overall strength of the extra layers, 0-1. Default 1. */
  strength?: number;
}

/** Result of liquidStyle(). */
export interface LiquidStyle {
  borderRadius: number;
  /** Spread onto the glass element. */
  surface: CSSProperties;
  /** Absolutely positioned children drawn BEHIND the content (zIndex -1): inner light, shadow, refraction. */
  under: CSSProperties[];
  /** Absolutely positioned child drawn ABOVE the content: the 1.5px specular rim. */
  rim: CSSProperties;
}

const ring = (width: number, background: string, extra: CSSProperties = {}): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  padding: width,
  pointerEvents: 'none',
  background,
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  maskComposite: 'exclude',
  ...extra,
});

/**
 * Conic gradient with a main lobe at the light angle and a weaker back lobe opposite, like light wrapping a glass edge.
 * `from` rotates the gradient so 0deg points at the light.
 */
const lobes = (fromDeg: number, color: string, peak: number, back: number, floor: number): string => {
  const c = (a: number) => withAlpha(color, a);
  return `conic-gradient(from ${r3(fromDeg)}deg, ${c(peak)} 0deg, ${c(peak * 0.3 + floor * 0.7)} 38deg, ${c(floor)} 95deg, ${c(floor * 1.6)} 150deg, ${c(back)} 180deg, ${c(floor * 1.6)} 210deg, ${c(floor)} 265deg, ${c(peak * 0.3 + floor * 0.7)} 322deg, ${c(peak)} 360deg)`;
};

/**
 * Pure style recipe for the "liquid" glass tier. Built on the card tier (same fill, underlay and shadows, so text
 * contrast stays inside the card envelope) plus: a conic specular rim that follows the corner radius and the light
 * angle, a soft inner highlight and inner shadow, and a cheap fake edge refraction (two chroma-shifted thin rings
 * and a lens band at the edge only). Never adds a second backdrop blur. All colours come from the theme.
 * @example const s = liquidStyle(theme, undefined, {lightAngle: 315, position: {x: 0.3, y: 0.4}});
 */
export const liquidStyle = (theme: Theme, radiusOverride?: RadiusKey | number, opts: LiquidOptions = {}): LiquidStyle => {
  const t = theme.glass.card;
  const u = unit(theme);
  const k = clamp01(opts.strength ?? 1);
  const light = opts.lightAngle ?? LIQUID_LIGHT_DEG;
  const rad = (light * Math.PI) / 180;
  // Unit vector pointing TOWARD the light (screen space, y down).
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const r = radiusOverride === undefined ? radiusPx(theme, 'xl') : typeof radiusOverride === 'number' ? radiusOverride : radiusPx(theme, radiusOverride);
  const hl = t.rimFrom; // highlight colour carried by the theme's rim token
  const ink = t.shadowTight.color;
  const cool = theme.colors.tint.a;
  const warm = theme.colors.semantic.warning;

  const tint = opts.position ? tintFor(theme, opts.position) : null;
  const blur = `blur(${20 * u}px) saturate(${Math.round(t.saturatePct * 1.1)}%)`;
  const fill = `linear-gradient(135deg, ${t.fillFrom}, ${t.fillTo}), ${t.underlay}`;
  const background = tint ? `linear-gradient(${tint.color}, ${tint.color}), ${fill}` : fill;

  const fill01 = (n: number) => n * k;
  const inner: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none',
    zIndex: -1,
    background: `radial-gradient(60% 40% at ${r3(50 + dx * 46)}% ${r3(50 + dy * 46)}%, ${withAlpha(hl, fill01(0.09))} 0%, ${withAlpha(hl, 0)} 70%)`,
    boxShadow: [
      // Crisp inner edge on the lit side.
      `inset ${r3(dx * 2 * u)}px ${r3(dy * 2 * u)}px ${r3(2 * u)}px ${r3(-1 * u)}px ${withAlpha(hl, fill01(0.55))}`,
      // Soft inner glow gathering on the lit side.
      `inset ${r3(dx * 8 * u)}px ${r3(dy * 8 * u)}px ${r3(24 * u)}px ${r3(-10 * u)}px ${withAlpha(hl, fill01(0.22))}`,
      // Soft inner shadow on the far side gives the slab thickness.
      `inset ${r3(-dx * 10 * u)}px ${r3(-dy * 12 * u)}px ${r3(28 * u)}px ${r3(-8 * u)}px ${withAlpha(ink, fill01(0.9) * 0.34)}`,
      // Lens band: faint brightening hugging the whole edge.
      `inset 0 0 ${r3(10 * u)}px ${r3(-1 * u)}px ${withAlpha(hl, fill01(0.1))}`,
    ].join(', '),
  };

  const shift = 1.6 * u;
  const fringeW = 5 * u;
  // Chroma-shifted thin rings: cool one nudged toward the light, warm one away. Clipped by the parent's overflow.
  const fringeCool = ring(fringeW, lobes(light, cool, fill01(0.5), fill01(0.22), fill01(0.1)), {zIndex: -1, transform: `translate(${r3(dx * shift)}px, ${r3(dy * shift)}px)`});
  const fringeWarm = ring(fringeW * 0.8, lobes(light, warm, fill01(0.34), fill01(0.2), fill01(0.05)), {zIndex: -1, transform: `translate(${r3(-dx * shift)}px, ${r3(-dy * shift)}px)`});

  return {
    borderRadius: r,
    surface: {
      borderRadius: r,
      background,
      backdropFilter: blur,
      WebkitBackdropFilter: blur,
      boxShadow: `${shadowCss(t.shadowTight, u)}, ${shadowCss(t.shadowWide, u)}`,
    },
    under: [inner, fringeCool, fringeWarm],
    rim: ring(1.5 * u, lobes(light, hl, 0.95 * k, 0.4 * k, 0.07 * k)),
  };
};
