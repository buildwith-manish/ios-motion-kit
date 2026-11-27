import type {CSSProperties} from 'react';
import {radius as radiusPx, shadowCss, unit} from '../tokens/helpers';
import type {GlassTierName, RadiusKey, Theme} from '../tokens/types';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Result of glassStyle(): style patches for the surface and the rim overlay, plus the resolved radius. */
export interface GlassStyle {
  /** Spread onto the glass element: fill gradient over underlay, backdrop blur+saturate, layered shadows, radius. */
  surface: CSSProperties;
  /** Spread onto an absolutely-positioned child to draw the 1px gradient specular rim. */
  rim: CSSProperties;
  /** Resolved border radius in px. */
  borderRadius: number;
}

/**
 * Pure style recipe for one glass tier. Use it directly for non-React code or custom elements; <Glass> is built on it.
 * @example const {surface, rim} = glassStyle(theme, 'card'); <div style={{position:'relative', ...surface}}><div style={rim} /></div>
 */
export const glassStyle = (theme: Theme, tier: GlassTierName, radiusOverride?: RadiusKey | number): GlassStyle => {
  const t = theme.glass[tier];
  const u = unit(theme);
  const r = radiusOverride === undefined ? radiusPx(theme, t.radius) : typeof radiusOverride === 'number' ? radiusOverride : radiusPx(theme, radiusOverride);
  const blur = `blur(${t.blurPx * u}px) saturate(${t.saturatePct}%)`;
  const inset = `inset 0 ${t.insetHighlight.y * u}px 0 ${t.insetHighlight.color}`;
  return {
    borderRadius: r,
    surface: {
      borderRadius: r,
      background: `linear-gradient(135deg, ${t.fillFrom}, ${t.fillTo}), ${t.underlay}`,
      backdropFilter: blur,
      WebkitBackdropFilter: blur,
      boxShadow: `${inset}, ${shadowCss(t.shadowTight, u)}, ${shadowCss(t.shadowWide, u)}`,
    },
    rim: {
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      padding: t.rimWidthPx * u,
      pointerEvents: 'none',
      background: `linear-gradient(135deg, ${t.rimFrom} 0%, ${t.rimMid} 45%, ${t.rimTo} 100%)`,
      // Punch out the middle so only the ring remains (a gradient border; border-image would lose the radius).
      WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
    },
  };
};

/** One-shot shimmer state: sweep position (% of width, -20 = hidden left) and opacity. */
export interface ShimmerState {
  /** Left edge of the sweep band, % of the element width. */
  x: number;
  opacity: number;
}

/**
 * Pure one-shot shimmer curve. Hidden before `at` and after `at + duration`; in between it sweeps left to right
 * and fades in/out (sine envelope).
 * @param time seconds
 * @param at second the sweep starts
 * @param duration sweep length in seconds (default 0.3)
 * @example const s = shimmerState(frame / fps, 1.0);
 */
export const shimmerState = (time: number, at: number, duration: number = 0.3): ShimmerState => {
  const elapsed = time - at;
  if (elapsed < 0 || elapsed > duration || duration <= 0) return {x: -20, opacity: 0};
  const p = clamp01(elapsed / duration);
  return {x: p * 120, opacity: Math.sin(Math.PI * p)};
};
