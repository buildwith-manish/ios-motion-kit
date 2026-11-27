import {FAMILY_DEFAULTS, SFX_FAMILIES, SFX_VARIANTS, dbToGain, sfxInfo, type SfxFamily, type SfxInfo} from './families';
import {hashString, mulberry32} from './prng';

/** Where in the sound the cue time points. */
export type CueAnchor = 'start' | 'peak';

/** Options for one cue. */
export interface CueOptions {
  /** Linear multiplier on the family's default level. Default 1. */
  gain?: number;
  /** -1 (left) .. 1 (right). Quantised to the nearest of L / centre / R pre-panned file. Default 0. */
  pan?: number;
  /** Force variant 1..3. Omit to let the seeded picker choose. */
  variant?: number;
  /** 'start' (default): `at` is when the file starts. 'peak': `at` is when the loudest sample lands (aligns whooshes to a move's peak velocity). */
  anchor?: CueAnchor;
}

/** A requested sound at a time. Build with {@link cue}. */
export interface Cue extends CueOptions {
  name: SfxFamily;
  /** Seconds from the start of the composition (or of the enclosing Sequence). */
  at: number;
}

/**
 * Create a cue.
 * @param name family name, e.g. 'tap'
 * @param atSeconds time in seconds
 * @example cue('pop', 1.25, {gain: 0.8, pan: -0.4})
 */
export const cue = (name: SfxFamily, atSeconds: number, options: CueOptions = {}): Cue => ({name, at: atSeconds, ...options});

/** Polyphony / repetition limits. */
export interface CueLimits {
  /** Max sounds playing at once. Default 3. */
  maxSimultaneous?: number;
  /** The same file may not start twice within this many seconds. Default 0.12. */
  minRepeatSeconds?: number;
}

/** Pre-panned file bucket. */
export type PanBucket = 'L' | 'C' | 'R';

/** A cue after variant selection and limiting. */
export interface ResolvedCue {
  /** Input order index. */
  id: number;
  name: SfxFamily;
  variant: number;
  /** Start of the file, seconds (anchor already applied). */
  at: number;
  /** End of the file, seconds. */
  end: number;
  /** Linear gain before ducking/ceiling = family default x cue gain, clamped to 0..1. */
  gain: number;
  pan: PanBucket;
  /** Path for staticFile(). */
  file: string;
  info: SfxInfo;
}

/** Why a cue was removed. */
export type DropReason = 'duplicate' | 'polyphony' | 'unknown-name' | 'negative-time';

/** A cue that did not make it into the mix. */
export interface DroppedCue {
  cue: Cue;
  id: number;
  reason: DropReason;
  /** Human-readable detail. */
  detail: string;
}

/** Result of {@link resolveCues}. */
export interface ResolveResult {
  cues: ResolvedCue[];
  dropped: DroppedCue[];
}

/** Options for {@link resolveCues}. */
export interface ResolveOptions {
  /** Seed for variant selection. Same seed + same cues = same variants, on any machine. Default 1. */
  seed?: number;
  limits?: CueLimits;
}

const panBucket = (pan: number | undefined): PanBucket => {
  const p = pan ?? 0;
  return p < -0.33 ? 'L' : p > 0.33 ? 'R' : 'C';
};

/** Path of the file to play for a resolved cue, honouring its pan bucket. */
export const cueFile = (info: SfxInfo, pan: PanBucket): string => {
  if (pan === 'C' || !info.pan.includes(pan)) return info.file;
  return info.file.replace(/\.wav$/, `@${pan}.wav`);
};

/**
 * Turn requested cues into the final, limited, deterministic list.
 *
 * - Variants: chosen per cue by a seeded PRNG keyed on (seed, family, nth occurrence); never the same variant twice in a
 *   row for a family and never one that already started within `minRepeatSeconds` ("no two identical SFX within 120 ms"
 *   means the same file; a different variant of the same family is allowed).
 * - Polyphony: at most `maxSimultaneous` files sounding at once; when a new cue would exceed that, the lowest-priority
 *   one of the overlapping set is dropped (ties: the newest).
 * Pure and order-independent for equal times (stable by input order).
 * @example const {cues, dropped} = resolveCues([cue('tap', 1), cue('tap', 1.05)], {seed: 7});
 */
export const resolveCues = (input: readonly Cue[], options: ResolveOptions = {}): ResolveResult => {
  const seed = options.seed ?? 1;
  const maxSim = options.limits?.maxSimultaneous ?? 3;
  const minRepeat = options.limits?.minRepeatSeconds ?? 0.12;
  const dropped: DroppedCue[] = [];

  const order = input
    .map((c, id) => ({c, id}))
    .sort((a, b) => a.c.at - b.c.at || a.id - b.id);

  const kept: ResolvedCue[] = [];
  const lastVariant = new Map<SfxFamily, number>();
  const occurrence = new Map<SfxFamily, number>();

  for (const {c, id} of order) {
    if (!SFX_FAMILIES.includes(c.name)) {
      dropped.push({cue: c, id, reason: 'unknown-name', detail: `unknown sound "${c.name}"`});
      continue;
    }
    if (!(c.at >= 0) && c.anchor !== 'peak') {
      dropped.push({cue: c, id, reason: 'negative-time', detail: `time ${c.at}s is before 0`});
      continue;
    }
    const nth = occurrence.get(c.name) ?? 0;
    occurrence.set(c.name, nth + 1);

    // Variants that already started within minRepeat of where this cue will land are blocked (same file twice).
    const peakShift = (v: number) => (c.anchor === 'peak' ? sfxInfo(c.name, v).peakTime : 0);
    const blocked = (v: number) => kept.some((k) => k.name === c.name && k.variant === v && Math.abs(k.at - (c.at - peakShift(v))) < minRepeat);

    let variant: number;
    if (c.variant !== undefined) {
      variant = Math.min(SFX_VARIANTS, Math.max(1, Math.round(c.variant)));
      if (blocked(variant)) {
        dropped.push({cue: c, id, reason: 'duplicate', detail: `forced variant ${variant} already started within ${Math.round(minRepeat * 1000)} ms`});
        continue;
      }
    } else {
      let candidates = Array.from({length: SFX_VARIANTS}, (_, i) => i + 1).filter((v) => !blocked(v));
      if (candidates.length === 0) {
        dropped.push({cue: c, id, reason: 'duplicate', detail: `all variants of "${c.name}" started within ${Math.round(minRepeat * 1000)} ms`});
        continue;
      }
      const prev = lastVariant.get(c.name);
      if (candidates.length > 1 && prev !== undefined) candidates = candidates.filter((v) => v !== prev);
      const rnd = mulberry32(hashString(`${seed}:${c.name}:${nth}`))();
      variant = candidates[Math.floor(rnd * candidates.length)];
    }

    const info = sfxInfo(c.name, variant);
    const at = c.anchor === 'peak' ? c.at - info.peakTime : c.at;
    if (at < 0) {
      dropped.push({cue: c, id, reason: 'negative-time', detail: `peak-anchored start ${at.toFixed(3)}s is before 0`});
      continue;
    }
    const gain = Math.min(1, Math.max(0, dbToGain(FAMILY_DEFAULTS[c.name].gainDb) * (c.gain ?? 1)));
    const resolved: ResolvedCue = {id, name: c.name, variant, at, end: at + info.duration, gain, pan: panBucket(c.pan), file: '', info};
    resolved.file = cueFile(info, resolved.pan);
    lastVariant.set(c.name, variant);

    // Polyphony. Cues are processed in time order, so "active" = already-kept cues still sounding at `at`.
    const active = kept.filter((k) => k.end > resolved.at);
    if (active.length >= maxSim) {
      const pool = [...active, resolved];
      let victim = pool[0];
      for (const p of pool) {
        const pv = FAMILY_DEFAULTS[p.name].priority;
        const vv = FAMILY_DEFAULTS[victim.name].priority;
        if (pv < vv || (pv === vv && p.at >= victim.at)) victim = p;
      }
      const src = input[victim.id];
      dropped.push({cue: src, id: victim.id, reason: 'polyphony', detail: `more than ${maxSim} sounds overlapping; lowest priority dropped`});
      if (victim !== resolved) {
        kept.splice(kept.indexOf(victim), 1);
        kept.push(resolved);
      }
      continue;
    }
    kept.push(resolved);
  }
  kept.sort((a, b) => a.at - b.at || a.id - b.id);
  dropped.sort((a, b) => a.cue.at - b.cue.at || a.id - b.id);
  return {cues: kept, dropped};
};

/**
 * Plain-text table of resolved + dropped cues with frame numbers at `fps`.
 * @example console.log(formatCueTable(resolveCues(cues), 60));
 */
export const formatCueTable = (result: ResolveResult, fps: number): string => {
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  const rows = [
    `${pad('time s', 9)}${pad('frame', 7)}${pad('end s', 9)}${pad('sound', 20)}${pad('pan', 5)}${pad('gain dB', 9)}note`,
    '-'.repeat(72),
  ];
  const all = [
    ...result.cues.map((c) => ({t: c.at, id: c.id, line: `${pad(c.at.toFixed(3), 9)}${pad(Math.round(c.at * fps), 7)}${pad(c.end.toFixed(3), 9)}${pad(`${c.name}-${c.variant}`, 20)}${pad(c.pan, 5)}${pad((20 * Math.log10(c.gain)).toFixed(1), 9)}`})),
    ...result.dropped.map((d) => ({t: d.cue.at, id: d.id, line: `${pad(d.cue.at.toFixed(3), 9)}${pad(Math.round(d.cue.at * fps), 7)}${pad('', 9)}${pad(d.cue.name, 20)}${pad('', 5)}${pad('', 9)}DROPPED (${d.reason}): ${d.detail}`})),
  ].sort((a, b) => a.t - b.t || a.id - b.id);
  return [...rows, ...all.map((a) => a.line)].join('\n');
};
