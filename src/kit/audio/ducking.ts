/**
 * Voice-over ducking. Takes a voice-over loudness envelope (JSON produced by scripts/kit_vo_envelope.py: RMS per
 * 1/30 s) and returns a smooth gain curve for music / SFX. Pure functions of numbers; no React, no Remotion.
 */
import {dbToGain} from './families';

/** Voice-over envelope file format ("kit-vo-envelope" v1). */
export interface VoEnvelope {
  version: 1;
  /** Samples per second (30 from kit_vo_envelope.py). */
  hz: number;
  /** Linear RMS (0..1, full scale = 1) per 1/hz seconds, starting at `startSeconds`. */
  rms: number[];
  /** Time of rms[0], seconds. Default 0. */
  startSeconds?: number;
  durationSeconds?: number;
  source?: string;
}

/** Ducking parameters. */
export interface DuckOptions {
  /** How far to pull the signal down under speech, dB (positive number). Brief: 6-9. Default 7.5. */
  depthDb?: number;
  /** Seconds to reach ~95% of the full duck once speech starts. Default 0.08. */
  attackSeconds?: number;
  /** Seconds to recover ~95% of the way once speech has ended. Default 0.4. */
  releaseSeconds?: number;
  /** Envelope level (dBFS RMS) above which the voice counts as speaking. Default -50. */
  thresholdDb?: number;
  /** Keep the duck engaged this long across short pauses between words (so it does not pump). Default 0.15. */
  holdSeconds?: number;
  /** Start ducking this much earlier than the speech (the envelope is known in advance). Default 0. */
  lookaheadSeconds?: number;
}

/** A computed duck curve. */
export interface Duck {
  depthDb: number;
  /** Linear gain (1 = untouched, ~0.42 at 7.5 dB) at `seconds`. */
  gainAtSeconds: (seconds: number) => number;
  /** Linear gain at a composition frame. */
  gainAtFrame: (frame: number, fps: number) => number;
  /** Gain in dB (<= 0) at `seconds`. */
  gainDbAtSeconds: (seconds: number) => number;
  /** True while the voice is above the threshold (before smoothing/hold) at `seconds`. */
  speakingAtSeconds: (seconds: number) => boolean;
}

const GRID_HZ = 500;
const TAU_DIV = 3;

const ampToDb = (a: number) => 20 * Math.log10(Math.max(a, 1e-9));

/**
 * Build a duck curve from a voice-over envelope. The smoothing is a one-pole in the dB domain on a 500 Hz grid
 * (envelope samples are held), so attack/release are exact regardless of the video's fps.
 * @param env voice-over envelope
 * @example const duck = createDuck(env, {depthDb: 7.5}); const g = duck.gainAtFrame(120, 60); // music volume x g
 */
export const createDuck = (env: VoEnvelope, options: DuckOptions = {}): Duck => {
  const depth = Math.abs(options.depthDb ?? 7.5);
  const attack = Math.max(1e-3, options.attackSeconds ?? 0.08);
  const release = Math.max(1e-3, options.releaseSeconds ?? 0.4);
  const threshold = options.thresholdDb ?? -50;
  const hold = Math.max(0, options.holdSeconds ?? 0.15);
  const look = Math.max(0, options.lookaheadSeconds ?? 0);
  const t0 = env.startSeconds ?? 0;
  const total = (env.rms.length / env.hz) + t0;
  const n = Math.ceil((total + 2) * GRID_HZ) + 1;
  const dt = 1 / GRID_HZ;

  // 1) speaking flag per grid step (sample-and-hold of the envelope), shifted earlier by lookahead.
  const speaking = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const ts = i * dt + look - t0;
    const k = Math.floor(ts * env.hz);
    speaking[i] = k >= 0 && k < env.rms.length && ampToDb(env.rms[k]) > threshold ? 1 : 0;
  }
  // 2) hold: extend each speaking run forward by `hold`.
  const holdN = Math.round(hold * GRID_HZ);
  const engaged = new Uint8Array(n);
  let sinceSpeech = Infinity;
  for (let i = 0; i < n; i++) {
    if (speaking[i]) sinceSpeech = 0;
    else sinceSpeech++;
    engaged[i] = sinceSpeech <= holdN ? 1 : 0;
  }
  // 3) one-pole smoothing in dB: attack when going down, release when coming back.
  const gdb = new Float32Array(n);
  const ca = 1 - Math.exp(-dt / (attack / TAU_DIV));
  const cr = 1 - Math.exp(-dt / (release / TAU_DIV));
  let cur = 0;
  for (let i = 0; i < n; i++) {
    const target = engaged[i] ? -depth : 0;
    cur += (target - cur) * (target < cur ? ca : cr);
    gdb[i] = cur;
  }
  const dbAt = (s: number) => {
    const x = s * GRID_HZ;
    if (x <= 0) return gdb[0];
    if (x >= n - 1) return gdb[n - 1];
    const i = Math.floor(x);
    const f = x - i;
    return gdb[i] * (1 - f) + gdb[i + 1] * f;
  };
  return {
    depthDb: depth,
    gainDbAtSeconds: dbAt,
    gainAtSeconds: (s) => dbToGain(dbAt(s)),
    gainAtFrame: (frame, fps) => dbToGain(dbAt(frame / fps)),
    speakingAtSeconds: (s) => {
      const i = Math.min(n - 1, Math.max(0, Math.round(s * GRID_HZ)));
      return speaking[i] === 1;
    },
  };
};

/**
 * Per-frame gain array (linear) for a whole timeline: index = frame.
 * @example const g = duckGainPerFrame(env, 60, 600); // g[frame] multiplies music/SFX volume
 */
export const duckGainPerFrame = (env: VoEnvelope, fps: number, totalFrames: number, options: DuckOptions = {}): Float32Array => {
  const duck = createDuck(env, options);
  const out = new Float32Array(totalFrames);
  for (let f = 0; f < totalFrames; f++) out[f] = duck.gainAtFrame(f, fps);
  return out;
};

const cache = new WeakMap<VoEnvelope, Map<string, Duck>>();

/**
 * Same as {@link createDuck} but memoised per (envelope object, options), so calling it from every frame's render is cheap.
 * @example const duck = getDuck(env); volume={(f) => base * duck.gainAtFrame(f, fps)}
 */
export const getDuck = (env: VoEnvelope, options: DuckOptions = {}): Duck => {
  let m = cache.get(env);
  if (!m) cache.set(env, (m = new Map()));
  const key = JSON.stringify([options.depthDb, options.attackSeconds, options.releaseSeconds, options.thresholdDb, options.holdSeconds, options.lookaheadSeconds]);
  let d = m.get(key);
  if (!d) m.set(key, (d = createDuck(env, options)));
  return d;
};

/**
 * Voice level (linear RMS) around `seconds`: the max of the envelope within +-`windowSeconds` / 2, so a pause between
 * two words does not read as silence. 0 where the envelope has no data.
 * @example voiceLevelAt(env, 3.2) // 0.07
 */
export const voiceLevelAt = (env: VoEnvelope, seconds: number, windowSeconds = 0.2): number => {
  const t0 = env.startSeconds ?? 0;
  const lo = Math.max(0, Math.floor((seconds - windowSeconds / 2 - t0) * env.hz));
  const hi = Math.min(env.rms.length - 1, Math.ceil((seconds + windowSeconds / 2 - t0) * env.hz));
  let m = 0;
  for (let i = lo; i <= hi; i++) m = Math.max(m, env.rms[i]);
  return m;
};
