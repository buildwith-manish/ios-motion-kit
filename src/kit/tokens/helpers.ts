import {cubicBezier, secondsToFrames, framesToSeconds} from '../motion';
import type {EasingName, SafeKind, SafeRect, ShadowSpec, Theme} from './types';

/** Design size of the shorter canvas side that every px token is authored against. */
export const DESIGN_SHORT_SIDE = 1080;

/**
 * Px scale factor for the theme's canvas: shorter side / 1080. It is 1 at both 1920x1080 and 1080x1920, so type
 * and spacing keep the same size in landscape and vertical; it only changes for other resolutions (e.g. 4K = 2).
 * @example const u = unit(theme); fontSize: 32 * u
 */
export const unit = (theme: Theme): number => Math.min(theme.canvas.width, theme.canvas.height) / DESIGN_SHORT_SIDE;

/**
 * Scales a design px value to the canvas.
 * @example px(theme, 24)
 */
export const px = (theme: Theme, n: number): number => n * unit(theme);

/**
 * Spacing token (4pt grid) in canvas px.
 * @example padding: space(theme, 6) // 24px at 1080
 */
export const space = (theme: Theme, key: keyof Theme['spacing']): number => theme.spacing[key] * unit(theme);

/**
 * Radius token in canvas px. 'pill' returns 9999 (fully rounded at any size).
 * @example borderRadius: radius(theme, 'xl')
 */
export const radius = (theme: Theme, key: keyof Theme['radius']): number => (key === 'pill' ? theme.radius.pill : theme.radius[key] * unit(theme));

/**
 * Canvas orientation from its aspect ratio.
 * @example orientation(theme) // 'portrait' for 1080x1920
 */
export const orientation = (theme: Theme): 'landscape' | 'portrait' => (theme.canvas.height > theme.canvas.width ? 'portrait' : 'landscape');

/**
 * Safe rectangle in canvas px for the theme's orientation. `title` keeps text; `action` keeps important action.
 * @example const r = safeRect(theme, 'title'); <div style={{position:'absolute', left:r.left, top:r.top, width:r.width, height:r.height}} />
 */
export const safeRect = (theme: Theme, kind: SafeKind = 'title'): SafeRect => {
  const ins = theme.safeArea[orientation(theme)][kind];
  const {width, height} = theme.canvas;
  const left = ins.left * width;
  const right = ins.right * width;
  const top = ins.top * height;
  const bottom = ins.bottom * height;
  return {top, right, bottom, left, width: width - left - right, height: height - top - bottom};
};

/**
 * Seconds -> frames at the theme's fps.
 * @example toFrames(theme, 1.5) // 90 at 60 fps, 45 at 30 fps
 */
export const toFrames = (theme: Theme, seconds: number): number => secondsToFrames(seconds, theme.canvas.fps);

/**
 * Frame -> seconds at the theme's fps.
 * @example toSeconds(theme, frame)
 */
export const toSeconds = (theme: Theme, frame: number): number => framesToSeconds(frame, theme.canvas.fps);

/**
 * Easing function from the theme's easing tokens.
 * @example const e = ease(theme, 'ios'); e(0.5)
 */
export const ease = (theme: Theme, name: EasingName): ((x: number) => number) => {
  const [x1, y1, x2, y2] = theme.motion.easing[name];
  return cubicBezier(x1, y1, x2, y2);
};

/**
 * ShadowSpec -> CSS box-shadow layer, scaled by `scale` (pass unit(theme)).
 * @example shadowCss(theme.glass.card.shadowWide, unit(theme))
 */
export const shadowCss = (s: ShadowSpec, scale: number = 1): string =>
  `${s.x * scale}px ${s.y * scale}px ${s.blur * scale}px ${s.spread * scale}px ${s.color}`;
