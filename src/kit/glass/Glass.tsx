import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {useTheme} from '../tokens/ThemeProvider';
import type {GlassTierProp, RadiusKey, Theme} from '../tokens/types';
import {glassStyle, shimmerState} from './glassStyle';
import {liquidStyle, type GlassPosition} from './liquid';

/** Props for <Glass>. */
export interface GlassProps {
  /** Which tier to draw. Default 'card'. */
  tier?: GlassTierProp;
  /** Current frame number. Only needed with `shimmerAt`. Passed in, never read from a hook. */
  frame?: number;
  /** Second at which a one-shot shimmer sweeps across the surface. Omit for none. */
  shimmerAt?: number;
  /** Shimmer length in seconds. Default 0.3. */
  shimmerDuration?: number;
  /** Radius override: a theme key or px. Default is the tier's radius. */
  radius?: RadiusKey | number;
  width?: number | string;
  height?: number | string;
  /** Override the theme (default: nearest ThemeProvider, else midnight). */
  theme?: Theme;
  /** Extra style, merged last. */
  style?: CSSProperties;
  className?: string;
  /** 'liquid' only: compass angle (deg, 0 = up, clockwise) the light comes from. Default 315. May animate per frame. */
  lightAngle?: number;
  /** 'liquid' only: glass centre on the canvas (0-1) for the adaptive tint. Omit for no tint. */
  position?: GlassPosition;
  /** Optional layout-lint role, rendered as data-kit-role. */
  kitRole?: 'hero' | 'secondary' | 'rail' | 'footer';
  children?: ReactNode;
}

/**
 * Glass surface for any tier (card, pill, chip, sheet): tinted gradient fill over a faint dark underlay,
 * backdrop blur + saturate, gradient specular rim (bright top-left fading to ~0 bottom-right), inset top highlight,
 * tight + wide layered shadows, and an optional one-shot shimmer. Pure presentational: no Remotion hooks, so it is
 * safe in the parallel renderer.
 *
 * Tier 'liquid' (opt-in, hero cards only) is the card plus a light-angle specular rim, inner highlight/shadow and a
 * chroma-shifted edge refraction; see glass/README.md.
 *
 * NOTE: backdrop-filter only samples what is behind the element inside the nearest "backdrop root". An ancestor
 * with opacity < 1 or a CSS filter (e.g. enterStyle() mid-entrance) is a backdrop root, so the glass shows its
 * un-blurred fill until that settles. Keep the glass itself out of those ancestors where the background should show through.
 *
 * @example
 * <ThemeProvider theme={midnight}>
 *   <Glass tier="card" width={480} height={240} frame={frame} shimmerAt={1.0}>
 *     <Text role="title">Hello</Text>
 *   </Glass>
 * </ThemeProvider>
 */
export const Glass: React.FC<GlassProps> = ({tier = 'card', frame, shimmerAt, shimmerDuration = 0.3, radius, width, height, theme, style, className, kitRole, lightAngle, position, children}) => {
  const ctx = useTheme();
  const th = theme ?? ctx;
  const liquid = tier === 'liquid' ? liquidStyle(th, radius, {lightAngle, position}) : null;
  const base = tier === 'liquid' ? 'card' : tier;
  const g = liquid ? {surface: liquid.surface, rim: liquid.rim} : glassStyle(th, base, radius);
  const spec = th.glass[base];

  const sh = frame !== undefined && shimmerAt !== undefined ? shimmerState(frame / th.canvas.fps, shimmerAt, shimmerDuration) : null;

  return (
    <div className={className} data-kit-role={kitRole} style={{position: 'relative', width, height, overflow: 'hidden', ...g.surface, ...style}}>
      {liquid ? liquid.under.map((st, i) => <div key={i} aria-hidden style={st} />) : null}
      {children}
      {sh && sh.opacity > 0.001 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${sh.x}%`,
            width: '14%',
            opacity: sh.opacity,
            pointerEvents: 'none',
            background: `linear-gradient(115deg, transparent 0%, ${spec.shimmer} 50%, transparent 100%)`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      <div aria-hidden style={g.rim} />
    </div>
  );
};
