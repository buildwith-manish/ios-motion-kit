/**
 * Motion-linked cues: derive sound times from the same motion definitions the animation uses, so audio follows the
 * animation instead of being hand-timed. Everything here is pure maths on seconds; it reuses the kit's iOS spring/ease.
 */
import {iosEase, iosSpring, SPRING} from '../motion';
import {cue, type Cue, type CueAnchor} from './cues';
import type {SfxFamily} from './families';

/** Kinds of moments a motion produces. */
export type MotionEventKind =
  | 'enter-start'
  | 'peak-velocity'
  | 'spring-settle'
  | 'transition-start'
  | 'transition-mid'
  | 'transition-settle'
  | 'number-roll-start'
  | 'number-tick';

/** A moment in a motion, in seconds. */
export interface MotionEvent {
  kind: MotionEventKind;
  /** Seconds. */
  at: number;
  /** For per-digit / per-tick events: running index. */
  index?: number;
}

/**
 * Seconds for an iOS spring (kit `iosSpring`) with `response` to reach `threshold` (0..1) of its travel.
 * @example springSettleTime(0.5) // seconds to 99% for a 0.5 s response
 */
export const springSettleTime = (response: number, threshold = 0.99): number => {
  let lo = 0;
  let hi = response * 4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (iosSpring(mid, response) < threshold) lo = mid;
    else hi = mid;
  }
  return hi;
};

/**
 * Seconds after the start at which the spring moves fastest: v(t) = w^2 t e^(-wt) peaks at t = 1/w = response / 2 PI.
 * @example springPeakVelocityTime(0.5) // 0.0796
 */
export const springPeakVelocityTime = (response: number): number => response / (2 * Math.PI);

/**
 * Events of an element entering with `enter(time, start, response)`: start, fastest moment, settled (99%).
 * @example enterEvents(1.2, SPRING.SNAPPY)
 */
export const enterEvents = (startSeconds: number, response: number = SPRING.SMOOTH, settleThreshold = 0.99): MotionEvent[] => [
  {kind: 'enter-start', at: startSeconds},
  {kind: 'peak-velocity', at: startSeconds + springPeakVelocityTime(response)},
  {kind: 'spring-settle', at: startSeconds + springSettleTime(response, settleThreshold)},
];

/** Timing of a transition, same meaning as the kit's TimingOptions. */
export interface TransitionTiming {
  curve?: 'spring' | 'ease';
  /** Spring response, seconds. Default 0.95 x duration (as in TransitionScene). */
  response?: number;
}

/**
 * Progress 0..1 of a transition `t` seconds after it starts (same formula as the kit's transitionProgress, kept local so
 * the audio kit does not depend on the transitions module).
 * @example transitionProgressAt(0.4, 0.8) // ~0.84
 */
export const transitionProgressAt = (t: number, durationSeconds: number, timing: TransitionTiming = {}): number => {
  if (t <= 0) return 0;
  if (t >= durationSeconds) return 1;
  if (timing.curve === 'ease') return iosEase(t / durationSeconds);
  const response = timing.response ?? durationSeconds * 0.95;
  return Math.min(1, Math.max(0, iosSpring(t, response) / iosSpring(durationSeconds, response)));
};

const timeAtProgress = (target: number, durationSeconds: number, timing: TransitionTiming): number => {
  let lo = 0;
  let hi = durationSeconds;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (transitionProgressAt(mid, durationSeconds, timing) < target) lo = mid;
    else hi = mid;
  }
  return hi;
};

/**
 * Events of a transition: start, half-way progress (the content is mid-air) and settled (99%).
 * @example transitionEvents(2.0, 0.8)
 */
export const transitionEvents = (startSeconds: number, durationSeconds: number, timing: TransitionTiming = {}): MotionEvent[] => [
  {kind: 'transition-start', at: startSeconds},
  {kind: 'transition-mid', at: startSeconds + timeAtProgress(0.5, durationSeconds, timing)},
  {kind: 'transition-settle', at: startSeconds + timeAtProgress(0.99, durationSeconds, timing)},
];

/** A rolling number display. */
export interface NumberRollSpec {
  /** Seconds when the first digit starts rolling. */
  start: number;
  /** Number of digit columns. Default 1. */
  digits?: number;
  /** Seconds between each digit column starting. Default 0.06. */
  staggerSeconds?: number;
  /** Seconds each column rolls for (eased with iosEase). Default 0.7. */
  rollSeconds?: number;
  /** Ticks per column. Default 5. They land where the eased roll crosses equal steps, so they thin out as it slows. */
  ticksPerDigit?: number;
}

/**
 * Events of a number roll: one start event, then tick events per digit column, spaced like the decelerating roll itself.
 * @example numberRollEvents({start: 2.4, digits: 3})
 */
export const numberRollEvents = (spec: NumberRollSpec): MotionEvent[] => {
  const digits = spec.digits ?? 1;
  const stagger = spec.staggerSeconds ?? 0.06;
  const roll = spec.rollSeconds ?? 0.7;
  const ticks = Math.max(1, spec.ticksPerDigit ?? 5);
  const events: MotionEvent[] = [{kind: 'number-roll-start', at: spec.start}];
  let index = 0;
  for (let d = 0; d < digits; d++) {
    for (let k = 1; k <= ticks; k++) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (iosEase(mid) < k / ticks) lo = mid;
        else hi = mid;
      }
      events.push({kind: 'number-tick', at: spec.start + d * stagger + hi * roll, index: index++});
    }
  }
  return events.sort((a, b) => a.at - b.at);
};

/** Binds a sound to a kind of motion event. */
export interface CueRule {
  on: MotionEventKind;
  play: SfxFamily;
  /** Seconds added to the event time (negative = earlier, e.g. -0.02 to lead the visual). Default 0. */
  offset?: number;
  /** 'peak' aligns the sound's loudest moment to the event (use for whooshes on 'peak-velocity'). Default 'start'. */
  anchor?: CueAnchor;
  gain?: number;
  pan?: number;
  variant?: number;
  /** Play on every n-th event of this kind (1 = all). Default 1. */
  every?: number;
}

/**
 * Cues for a set of motion events and rules. Several rules can match the same event kind.
 * @example
 * const events = [...enterEvents(1.2), ...numberRollEvents({start: 2, digits: 3})];
 * const cues = cuesFromMotion(events, [{on: 'enter-start', play: 'pop'}, {on: 'number-tick', play: 'number-tick', every: 2}]);
 */
export const cuesFromMotion = (events: readonly MotionEvent[], rules: readonly CueRule[]): Cue[] => {
  const out: Cue[] = [];
  for (const rule of rules) {
    const every = Math.max(1, rule.every ?? 1);
    const matching = events.filter((e) => e.kind === rule.on).sort((a, b) => a.at - b.at);
    matching.forEach((e, i) => {
      if (i % every !== 0) return;
      out.push(cue(rule.play, e.at + (rule.offset ?? 0), {gain: rule.gain, pan: rule.pan, variant: rule.variant, anchor: rule.anchor}));
    });
  }
  return out.sort((a, b) => a.at - b.at);
};
