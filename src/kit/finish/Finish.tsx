import React, {useId} from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {useTheme} from '../tokens/ThemeProvider';
import {unit} from '../tokens/helpers';

export type FinishLevel = 'off' | 'light' | 'full';

export type DitherShape = 'triangular' | 'blue';
export interface DitherOptions {
  /** Nominal peak noise in 8-bit levels (LSB). 1 to 1.5 breaks up 8-bit bands without visible grain. */
  amount?: number;
  /** `triangular`: two independent uniform-like channels averaged. `blue`: the same, high-passed (less low-frequency blotching). */
  shape?: DitherShape;
  /** 0..1: how much less noise bright areas get than dark ones (banding shows in darks). Luma based, not motion adaptive. */
  highlightFalloff?: number;
  /** Seed mixed with the frame number. */
  seed?: number;
}
export type DitherSetting = false | 'off' | 'banding-safe' | DitherOptions;

export const DITHER_PROFILES = {
  'banding-safe': {amount: 1.25, shape: 'triangular', highlightFalloff: 0.6, seed: 0x5eed},
} as const satisfies Record<string, Required<DitherOptions>>;

/** Resolves a dither setting; `undefined`, `false` and `'off'` mean no dither (the default). */
export const resolveDither = (dither?: DitherSetting): Required<DitherOptions> | null => {
  if (!dither || dither === 'off') return null;
  const base = DITHER_PROFILES['banding-safe'];
  return typeof dither === 'string' ? {...DITHER_PROFILES[dither]} : {...base, ...dither};
};

/** feTurbulence seed for a frame: integer hash of seed and frame, 1..65000. Same inputs, same noise. */
export const ditherSeed = (seed: number, frame: number): number => ((Math.imul((seed ^ Math.round(frame)) >>> 0, 2654435761) >>> 0) % 65000) + 1;

const NOISE_PEAK = 0.25; // nominal peak of (mixed noise - 0.5) before gain; the banding check measures the real effect
const BLUE_GAIN = 1.5;

/** Filter numbers for a dither config: arithmetic gain (fraction of full scale per unit of centred noise) and the luma weight table. */
export const ditherFilterValues = (cfg: Required<DitherOptions>, frame: number) => {
  const gain = (cfg.amount * (cfg.shape === 'blue' ? BLUE_GAIN : 1)) / 255 / NOISE_PEAK;
  const fall = Math.min(1, Math.max(0, cfg.highlightFalloff));
  const table = Array.from({length: 8}, (_, i) => (1 - fall * Math.pow(i / 7, 0.8)).toFixed(3)).join(' ');
  return {seed: ditherSeed(cfg.seed, frame), gain, table};
};

export interface FinishProps {
  level?: FinishLevel;
  /** Apply bloom and grain only when the render script selected the final profile. */
  finalOnly?: boolean;
  kitRender?: {profile?: string};
  /** Seeded noise added after the grade, vignette and grain, to break up 8-bit banding in dark gradients. Default off. */
  dither?: DitherSetting;
  /** Composition frame; varies the dither noise per frame (default 0 = the same noise every frame). */
  frame?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const curve = (level: Exclude<FinishLevel, 'off'>, channel: 'r' | 'g' | 'b'): string => {
  const base = level === 'light'
    ? [0, 0.025, 0.06, 0.11, 0.18, 0.27, 0.38, 0.5, 0.62, 0.73, 0.82, 0.9, 0.95, 0.98, 1]
    : [0, 0.018, 0.045, 0.09, 0.16, 0.25, 0.37, 0.5, 0.63, 0.75, 0.84, 0.92, 0.97, 0.99, 1];
  return base.map((value, i) => {
    const split = channel === 'r' ? (i > 8 ? 0.012 : 0) : channel === 'b' ? (i < 6 ? 0.01 : 0) : 0;
    return String(Math.min(1, value + split));
  }).join(' ');
};

const grainSvg = (): string => {
  let state = 0x4f1bbcdc;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const dots = Array.from({length: 192}, (_, i) => {
    const x = (i * 17) % 64;
    const y = (i * 29) % 64;
    const opacity = (0.16 + next() * 0.22).toFixed(2);
    return `<rect x="${x}" y="${y}" width="1" height="1" fill="white" fill-opacity="${opacity}"/>`;
  }).join('');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${dots}</svg>`)}`;
};

const GRAIN = grainSvg();

/** A deterministic film finish that is a pure function of its props and children. */
const FinishBase: React.FC<Omit<FinishProps, 'dither' | 'frame'>> = ({
  level = 'light',
  finalOnly = false,
  kitRender,
  className,
  style,
  children,
}) => {
  const theme = useTheme();
  const id = useId().replace(/:/g, '');
  const active = level !== 'off';
  const grade = level === 'off' ? 'light' : level;
  const heavy = active && (!finalOnly || kitRender?.profile === 'final');
  const blur = Math.min(10 * unit(theme), 20);
  const filterId = `kit-finish-${id}`;

  return (
    <div className={className} style={{position: 'relative', width: '100%', height: '100%', isolation: 'isolate', ...style}}>
      {active && (
        <svg aria-hidden style={{position: 'absolute', width: 0, height: 0}}>
          <defs>
            <filter id={filterId} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
              <feComponentTransfer in="SourceGraphic" result="graded">
                <feFuncR type="table" tableValues={curve(grade, 'r')} />
                <feFuncG type="table" tableValues={curve(grade, 'g')} />
                <feFuncB type="table" tableValues={curve(grade, 'b')} />
              </feComponentTransfer>
              {level === 'full' && heavy ? (
                <>
                  <feColorMatrix in="graded" result="luma" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0" />
                  <feComponentTransfer in="luma" result="highlights">
                    <feFuncR type="table" tableValues="0 0 0 .05 .2 .55 .9 1" />
                    <feFuncG type="table" tableValues="0 0 0 .05 .2 .55 .9 1" />
                    <feFuncB type="table" tableValues="0 0 0 .05 .2 .55 .9 1" />
                    <feFuncA type="table" tableValues="0 0 0 .05 .2 .55 .9 1" />
                  </feComponentTransfer>
                  <feGaussianBlur in="highlights" stdDeviation={blur} result="bloom" />
                  <feBlend in="graded" in2="bloom" mode="screen" />
                </>
              ) : null}
            </filter>
          </defs>
        </svg>
      )}
      <div style={{position: 'relative', width: '100%', height: '100%', filter: active ? `url(#${filterId})` : undefined}}>
        {children}
      </div>
      {active && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse at center, transparent 48%, ${theme.colors.background.deep} 100%)`,
            opacity: 0.22,
          }}
        />
      )}
      {level === 'full' && heavy && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
            backgroundImage: `url("${GRAIN}")`,
            backgroundSize: `${64 * unit(theme)}px ${64 * unit(theme)}px`,
            mixBlendMode: 'soft-light',
            opacity: 0.16,
          }}
        />
      )}
    </div>
  );
};

/** Finish with optional dither: a final SVG filter over the whole finished image (so the vignette and grain are dithered too). */
export const Finish: React.FC<FinishProps> = ({dither, frame = 0, className, style, ...rest}) => {
  const cfg = resolveDither(dither);
  const id = useId().replace(/:/g, '');
  if (!cfg) return <FinishBase {...rest} className={className} style={style} />;
  const v = ditherFilterValues(cfg, frame);
  const fid = `kit-dither-${id}`;
  const luma = '.2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 0 1';
  const mix = '.5 .5 0 0 0 .5 .5 0 0 0 .5 .5 0 0 0 0 0 0 0 1';
  return (
    <div className={className} style={{position: 'relative', width: '100%', height: '100%', isolation: 'isolate', ...style, filter: `url(#${fid})`}}>
      <svg aria-hidden style={{position: 'absolute', width: 0, height: 0}}>
        <defs>
          <filter id={fid} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed={v.seed} result="raw" />
            <feColorMatrix in="raw" type="matrix" values={mix} result="tri" />
            {cfg.shape === 'blue' ? <feConvolveMatrix in="tri" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" divisor="8" bias="0.5" preserveAlpha="true" result="noise" /> : <feOffset in="tri" dx="0" dy="0" result="noise" />}
            <feColorMatrix in="SourceGraphic" type="matrix" values={luma} result="lum" />
            <feComponentTransfer in="lum" result="weight">
              <feFuncR type="table" tableValues={v.table} />
              <feFuncG type="table" tableValues={v.table} />
              <feFuncB type="table" tableValues={v.table} />
            </feComponentTransfer>
            <feComposite in="noise" in2="weight" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="weighted" />
            <feComposite in="SourceGraphic" in2="weighted" operator="arithmetic" k1="0" k2="1" k3={v.gain} k4={-v.gain / 2} result="dithered" />
            <feComposite in="dithered" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
      </svg>
      <FinishBase {...rest} />
    </div>
  );
};
