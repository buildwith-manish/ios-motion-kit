import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {useTheme} from '../tokens/ThemeProvider';
import type {GlassTierName, RadiusKey, Theme} from '../tokens/types';
import {glassStyle, shimmerState} from './glassStyle';

/** Props for <Glass>. */
export interface GlassProps {
  /** Which tier to draw. Default 'card'. */
  tier?: GlassTierName;
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
  children?: ReactNode;
}

/**
 * Glass surface for any tier (card, pill, chip, sheet): tinted gradient fill over a faint dark underlay,
 * backdrop blur + saturate, gradient specular rim (bright top-left fading to ~0 bottom-right), inset top highlight,
 * tight + wide layered shadows, and an optional one-shot shimmer. Pure presentational: no Remotion hooks, so it is
 * safe in the parallel renderer.
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
export const Glass: React.FC<GlassProps> = ({tier = 'card', frame, shimmerAt, shimmerDuration = 0.3, radius, width, height, theme, style, className, children}) => {
  const ctx = useTheme();
  const th = theme ?? ctx;
  const g = glassStyle(th, tier, radius);
  const spec = th.glass[tier];

  const sh = frame !== undefined && shimmerAt !== undefined ? shimmerState(frame / th.canvas.fps, shimmerAt, shimmerDuration) : null;

  return (
    <div className={className} style={{position: 'relative', width, height, overflow: 'hidden', ...g.surface, ...style}}>
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
