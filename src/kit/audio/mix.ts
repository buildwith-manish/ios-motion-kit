import {getDuck, voiceLevelAt, type DuckOptions, type VoEnvelope} from './ducking';
import {dbToGain} from './families';
import type {ResolvedCue} from './cues';

/** How SFX are mixed against the voice-over. */
export interface SfxMix {
  /** Voice-over envelope. Without it there is no ducking and no voice ceiling. */
  voice?: VoEnvelope | null;
  /** Ducking of SFX under speech. `false` disables. Default depth 6 dB (SFX duck a little less than music). */
  duck?: DuckOptions | false;
  /** SFX RMS may be at most this many dB below the voice RMS while it speaks ("never louder than the voice-over"). Default 3. */
  voiceMarginDb?: number;
  /** Envelope level (dBFS RMS) below which the voice is considered absent and the ceiling is not applied. Default -50. */
  voiceGateDb?: number;
  /** Master gain on every SFX, linear. Default 1. */
  masterGain?: number;
}

/**
 * Gain (linear) for a resolved cue at composition time `seconds`: cue gain x duck x master, then clamped so the SFX's
 * RMS (from the manifest) stays `voiceMarginDb` under the voice-over RMS while the voice is speaking.
 * @example volume={(f) => sfxGainAt(cue, (cue.at * fps + f) / fps, mix)}
 */
export const sfxGainAt = (c: ResolvedCue, seconds: number, mix: SfxMix = {}): number => {
  let g = c.gain * (mix.masterGain ?? 1);
  const voice = mix.voice;
  if (!voice) return Math.min(1, g);
  if (mix.duck !== false) g *= getDuck(voice, {depthDb: 6, ...(mix.duck ?? {})}).gainAtSeconds(seconds);
  const gate = dbToGain(mix.voiceGateDb ?? -50);
  const v = voiceLevelAt(voice, seconds);
  if (v > gate) {
    const sfxRms = dbToGain(c.info.rmsDb) * g;
    const allowed = v * dbToGain(-(mix.voiceMarginDb ?? 3));
    if (sfxRms > allowed) g *= allowed / sfxRms;
  }
  return Math.min(1, Math.max(0, g));
};

