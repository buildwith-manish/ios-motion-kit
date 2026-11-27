import React from 'react';
import {Audio, staticFile} from 'remotion';
import {getDuck, type DuckOptions, type VoEnvelope} from './ducking';
import {dbToGain} from './families';

/** Props for {@link MusicBed}. */
export interface MusicBedProps {
  /** Path for staticFile(), e.g. "kit/music/pad-loop.wav". */
  src: string;
  fps: number;
  /** Base level in dB. Default 0: the pad file is already low (about -28 LUFS). */
  gainDb?: number;
  /** Voice-over envelope for ducking. Omit for no ducking. */
  voice?: VoEnvelope | null;
  /** Ducking parameters. Default depth 7.5 dB, 80 ms attack, 400 ms release. */
  duck?: DuckOptions;
  /** Fade in / out, seconds. Default 1 / 2. */
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  /** Total length of the bed in seconds; the fade-out ends here. Omit for no fade-out. */
  totalSeconds?: number;
  /** Add when the component sits inside a Sequence whose start is not frame 0 (so ducking uses composition time). */
  frameOffset?: number;
}

/**
 * Looping music bed with fade in/out and voice-over ducking. A pure function of Remotion's per-frame volume callback.
 * @example <MusicBed src="kit/music/pad-loop.wav" fps={60} voice={env} totalSeconds={10} />
 */
export const MusicBed: React.FC<MusicBedProps> = ({src, fps, gainDb = 0, voice, duck, fadeInSeconds = 1, fadeOutSeconds = 2, totalSeconds, frameOffset = 0}) => {
  const base = dbToGain(gainDb);
  const d = voice ? getDuck(voice, duck) : null;
  const volume = (f: number): number => {
    const s = (f + frameOffset) / fps;
    let g = base;
    if (fadeInSeconds > 0) g *= Math.min(1, s / fadeInSeconds);
    if (totalSeconds !== undefined && fadeOutSeconds > 0) g *= Math.min(1, Math.max(0, (totalSeconds - s) / fadeOutSeconds));
    if (d) g *= d.gainAtSeconds(s);
    return Math.min(1, Math.max(0, g));
  };
  return <Audio src={staticFile(src)} loop loopVolumeCurveBehavior="extend" volume={volume} />;
};
