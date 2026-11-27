import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {idleDrift} from '../motion';
import {useTheme} from '../tokens/ThemeProvider';
import {rgba} from '../tokens/color';
import {unit} from '../tokens/helpers';
import {lum, parseColor} from '../tokens/contrast';
import type {Theme, TintColors} from '../tokens/types';
import {lightAt, type LightBeat} from './focusPoints';

export type AtmospherePreset = 'midnight-aurora' | 'graphite' | 'soft-light' | 'deep-ocean';
type TintKey = keyof TintColors | 'accent';

interface OrbToken {
  tint: TintKey;
  x: number;
  y: number;
  size: number;
  drift: number;
  period: number;
  phase: number;
}

interface PresetToken {
  gradient: readonly [number, number, number];
  orbs: readonly OrbToken[];
  beats: readonly LightBeat[];
  keyTint: TintKey;
}

/** Tile size is authored at the 1080 design size and scales with unit(theme), including 4K output. */
export const ATMOSPHERE_GRAIN_TILE_PX = 64;

const PRESETS: Record<AtmospherePreset, PresetToken> = {
  'midnight-aurora': {
    gradient: [150, 48, 0],
    keyTint: 'a',
    orbs: [
      {tint: 'a', x: 0.19, y: 0.28, size: 0.68, drift: 0.1, period: 15, phase: 0},
      {tint: 'b', x: 0.79, y: 0.72, size: 0.64, drift: 0.12, period: 18, phase: 1.8},
      {tint: 'c', x: 0.52, y: 0.06, size: 0.5, drift: 0.14, period: 20, phase: 3.4},
    ],
    beats: [{t: 0, x: 0.2, y: 0.25}, {t: 7, x: 0.78, y: 0.28}, {t: 14, x: 0.55, y: 0.78}, {t: 21, x: 0.2, y: 0.25}],
  },
  graphite: {
    gradient: [160, 45, 0],
    keyTint: 'c',
    orbs: [
      {tint: 'd', x: 0.16, y: 0.7, size: 0.62, drift: 0.1, period: 16, phase: 0.6},
      {tint: 'a', x: 0.82, y: 0.26, size: 0.56, drift: 0.14, period: 19, phase: 2.1},
    ],
    beats: [{t: 0, x: 0.76, y: 0.72}, {t: 8, x: 0.22, y: 0.38}, {t: 16, x: 0.76, y: 0.72}],
  },
  'soft-light': {
    gradient: [145, 52, 0],
    keyTint: 'b',
    orbs: [
      {tint: 'b', x: 0.22, y: 0.24, size: 0.62, drift: 0.12, period: 14, phase: 0.4},
      {tint: 'a', x: 0.8, y: 0.74, size: 0.64, drift: 0.14, period: 17, phase: 2.4},
      {tint: 'd', x: 0.56, y: 0.05, size: 0.48, drift: 0.1, period: 20, phase: 4.1},
    ],
    beats: [{t: 0, x: 0.2, y: 0.75}, {t: 6, x: 0.76, y: 0.26}, {t: 12, x: 0.52, y: 0.72}, {t: 18, x: 0.2, y: 0.75}],
  },
  'deep-ocean': {
    gradient: [165, 42, 0],
    keyTint: 'a',
    orbs: [
      {tint: 'a', x: 0.18, y: 0.66, size: 0.72, drift: 0.14, period: 15.5, phase: 0},
      {tint: 'd', x: 0.84, y: 0.28, size: 0.6, drift: 0.12, period: 18.5, phase: 2},
      {tint: 'b', x: 0.58, y: 0.04, size: 0.46, drift: 0.1, period: 20, phase: 3.7},
    ],
    beats: [{t: 0, x: 0.18, y: 0.28}, {t: 7, x: 0.8, y: 0.72}, {t: 14, x: 0.52, y: 0.3}, {t: 21, x: 0.18, y: 0.28}],
  },
};

const tintOf = (theme: Theme, tint: TintKey): string => tint === 'accent' ? theme.colors.accent : theme.colors.tint[tint];

/** Quiet mode scales orb and key-light alpha by this factor (lower contrast behind charts and text). */
export const ATMOSPHERE_QUIET_FACTOR = 0.52;
/** Base alpha of the key light, as a fraction of `orbMaxAlpha` (the light is softer than the orbs). */
const KEY_LIGHT_ALPHA = 0.58;
/** Vignette strength at intensity 1. */
const VIGNETTE_ALPHA = 0.36;
/** Grain opacity at intensity 1, applied with mix-blend soft-light so it works on light and dark themes. */
const GRAIN_OPACITY = 0.16;

const grainSvg = (dark: string, light: string): string => {
  let state = 0x5eed1234;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const dots = Array.from({length: 256}, (_, i) => {
    const x = (i * 13) % ATMOSPHERE_GRAIN_TILE_PX;
    const y = (i * 29) % ATMOSPHERE_GRAIN_TILE_PX;
    const fill = next() > 0.5 ? light : dark;
    const opacity = (0.18 + next() * 0.28).toFixed(2);
    return `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}" fill-opacity="${opacity}"/>`;
  }).join('');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${ATMOSPHERE_GRAIN_TILE_PX}" height="${ATMOSPHERE_GRAIN_TILE_PX}">${dots}</svg>`)}`;
};

/** Props for the frame-driven ambient background. */
export interface AtmosphereProps {
  /** Current composition frame; Atmosphere never reads the Remotion clock. */
  frame: number;
  preset?: AtmospherePreset;
  /** Overall tint strength. Default 1; must be between 0 and 1. */
  intensity?: number;
  /** Subdues orb and key-light contrast for charts and text. */
  quiet?: boolean;
  /** Disables all orb drift while keeping static colour and key-light position. */
  reducedMotion?: boolean;
  /** Optional normalized key-light beats in seconds. */
  beats?: readonly LightBeat[];
  theme?: Theme;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Token-driven gradient, radially-fallen colour orbs, a spring-following key light, vignette and deterministic grain.
 * @example <Atmosphere frame={frame} preset="deep-ocean"><Glass tier="card">...</Glass></Atmosphere>
 */
export const Atmosphere: React.FC<AtmosphereProps> = ({
  frame, preset = 'midnight-aurora', intensity = 1, quiet = false, reducedMotion = false, beats, theme: themeProp, className, style, children,
}) => {
  const contextTheme = useTheme();
  const theme = themeProp ?? contextTheme;
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new RangeError('Atmosphere: intensity must be between 0 and 1');
  if (!Number.isFinite(frame)) throw new RangeError('Atmosphere: frame must be finite');
  const config = PRESETS[preset];
  if (!config) throw new Error(`Atmosphere: unknown preset "${preset}"`);
  const {width, height, fps} = theme.canvas;
  const u = unit(theme);
  const time = frame / fps;
  const alphaCap = theme.colors.orbMaxAlpha;
  const opacityScale = (quiet ? ATMOSPHERE_QUIET_FACTOR : 1) * intensity;
  const lightBeats = beats ?? config.beats;
  const light = lightAt(time, lightBeats, theme.motion.spring.GENTLE);
  const lightColour = light.colour ?? tintOf(theme, config.keyTint);
  const lightAlpha = Math.min(alphaCap, alphaCap * KEY_LIGHT_ALPHA * opacityScale);
  // Grain needs one colour darker and one lighter than the backdrop, or soft-light has nothing to add
  // (the light theme's own lift/base/deep are all near-white, so use pure black/white dots there).
  const backdropLum = lum(parseColor(theme.colors.background.base).rgb);
  const grain = grainSvg(backdropLum > 0.5 ? '#000000' : theme.colors.background.deep, backdropLum > 0.5 ? '#FFFFFF' : theme.colors.background.lift);
  // Deterministic grain shift (same every render of the same frame; cadence matches the video-4 original).
  const grainStep = Math.floor(frame / 2);
  const grainX = grainStep * 37 % ATMOSPHERE_GRAIN_TILE_PX;
  const grainY = grainStep * 53 % ATMOSPHERE_GRAIN_TILE_PX;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        isolation: 'isolate',
        background: `linear-gradient(${config.gradient[0]}deg, ${theme.colors.background.lift} ${config.gradient[1]}%, ${theme.colors.background.base} 54%, ${theme.colors.background.deep} 100%)`,
        ...style,
      }}
    >
      <div aria-hidden style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0}}>
        {config.orbs.map((orb, i) => {
          const driftX = reducedMotion ? 0 : idleDrift(time + orb.phase, orb.period) * orb.drift * width;
          const driftY = reducedMotion ? 0 : idleDrift(time + orb.phase, orb.period * 1.17) * height * 0.025;
          const x = orb.x * width + driftX;
          const y = orb.y * height + driftY;
          const size = orb.size * Math.min(width, height);
          const alpha = Math.min(alphaCap, alphaCap * opacityScale);
          const color = tintOf(theme, orb.tint);
          return (
            <div
              key={`${preset}-${i}`}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, ${rgba(color, alpha)} 0%, ${rgba(color, alpha * 0.46)} 42%, transparent 74%)`,
              }}
            />
          );
        })}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(58% 64% at ${light.x * 100}% ${light.y * 100}%, ${rgba(lightColour, lightAlpha)} 0%, transparent 100%)`,
          }}
        />
        <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, transparent 44%, ${rgba(theme.colors.background.deep, VIGNETTE_ALPHA * intensity)} 100%)`}} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: GRAIN_OPACITY * intensity,
            backgroundImage: `url("${grain}")`,
            backgroundSize: `${ATMOSPHERE_GRAIN_TILE_PX * u}px ${ATMOSPHERE_GRAIN_TILE_PX * u}px`,
            backgroundPosition: `${grainX * u}px ${grainY * u}px`,
            mixBlendMode: 'soft-light',
          }}
        />
      </div>
      <div style={{position: 'relative', zIndex: 1, width: '100%', height: '100%'}}>{children}</div>
    </div>
  );
};
