import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {resolveCues, type Cue, type CueLimits, type ResolveResult} from './cues';
import {sfxGainAt, type SfxMix} from './mix';

/** Props for {@link CueTrack}. */
export interface CueTrackProps {
  /** Requested cues (seconds). Build with `cue()` or `cuesFromMotion()`. */
  cues: readonly Cue[];
  /** Composition fps (use `theme.canvas.fps`). */
  fps: number;
  /** Seed for deterministic variant selection. Default 1. */
  seed?: number;
  limits?: CueLimits;
  /** Voice-over ducking / ceiling settings. */
  mix?: SfxMix;
}

const cache = new WeakMap<readonly Cue[], Map<string, ResolveResult>>();

/**
 * Resolve cues with a per-array memo so every frame's render reuses the same result (no hooks, no randomness).
 * @example const {cues, dropped} = resolveCached(cueList, 1);
 */
export const resolveCached = (cues: readonly Cue[], seed = 1, limits: CueLimits = {}): ResolveResult => {
  let m = cache.get(cues);
  if (!m) cache.set(cues, (m = new Map()));
  const key = `${seed}|${limits.maxSimultaneous ?? ''}|${limits.minRepeatSeconds ?? ''}`;
  let r = m.get(key);
  if (!r) m.set(key, (r = resolveCues(cues, {seed, limits})));
  return r;
};

/**
 * Renders one `<Sequence><Audio/></Sequence>` per resolved cue. Variants are chosen by a seeded PRNG, limits are applied
 * (max 3 simultaneous, no identical file within 120 ms), and each sound's volume follows the voice-over duck and the
 * "never louder than the voice" ceiling per frame. Place it inside the composition (or a Sequence; times are then
 * relative to that Sequence).
 *
 * Sequences start on whole frames, so a cue lands within half a frame (8 ms at 60 fps, 17 ms at 30 fps) of its time.
 * @example <CueTrack fps={60} cues={[cue('pop', 0.5), cue('chime-success', 2, {pan: 0.4})]} mix={{voice: env}} />
 */
export const CueTrack: React.FC<CueTrackProps> = ({cues, fps, seed = 1, limits, mix}) => {
  const {cues: resolved} = resolveCached(cues, seed, limits);
  const dynamic = !!mix?.voice;
  return (
    <>
      {resolved.map((c) => {
        const from = Math.round(c.at * fps);
        const frames = Math.ceil(c.info.duration * fps) + 1;
        return (
          <Sequence key={`${c.id}-${c.name}-${c.variant}`} from={from} durationInFrames={frames} layout="none" name={`cue ${c.name}-${c.variant}`}>
            <Audio src={staticFile(c.file)} volume={dynamic ? (f: number) => sfxGainAt(c, (from + f) / fps, mix) : sfxGainAt(c, c.at, mix)} />
          </Sequence>
        );
      })}
    </>
  );
};
