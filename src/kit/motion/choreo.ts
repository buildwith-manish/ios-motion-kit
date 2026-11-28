import {SPRING, SPRING_PRESETS, iosSpring} from './ios';

/** One choreographed item: `start` in seconds and a pure `progress(time)` (seconds in, 0..1 out; overshoot allowed for bounce). */
export interface ChoreoItem {
  start: number;
  progress: (time: number) => number;
}

export interface EnterStackOptions {
  /** Second the first item begins. Default 0. */
  start?: number;
  /** Seconds between consecutive items. Default 0.08. */
  stagger?: number;
  /** Spring response in seconds. Default SPRING.SMOOTH. */
  response?: number;
}

const assertFinite = (name: string, v: number): void => {
  if (!Number.isFinite(v)) throw new RangeError(`choreo: ${name} must be finite`);
};

const springItem = (start: number, response: number): ChoreoItem => ({
  start,
  progress: (time) => iosSpring(time - start, response),
});

/**
 * n items entering one after another. Item i starts at `start + i * stagger`.
 * @example const [a, b, c] = enterStack(3, {start: 0.2, stagger: 0.1}); a.progress(t)
 */
export const enterStack = (n: number, options: EnterStackOptions = {}): ChoreoItem[] => {
  const {start = 0, stagger = 0.08, response = SPRING.SMOOTH} = options;
  if (!Number.isInteger(n) || n < 0) throw new RangeError('choreo: n must be a non-negative integer');
  assertFinite('start', start);
  assertFinite('stagger', stagger);
  return Array.from({length: n}, (_, i) => springItem(start + i * stagger, response));
};

export interface EmphasizeOptions {
  /** Seconds the pulse stays up before settling back. Default 0.2. */
  hold?: number;
  response?: number;
}

/** A pulse: rises 0 -> 1 at `at`, then settles back to 0 after `hold`. Use it for scale or glow bumps. */
export const emphasize = (at: number, options: EmphasizeOptions = {}): ChoreoItem => {
  const {hold = 0.2, response = SPRING_PRESETS.hero.response} = options;
  assertFinite('at', at);
  assertFinite('hold', hold);
  return {start: at, progress: (time) => iosSpring(time - at, response) - iosSpring(time - at - hold, response)};
};

/** An exit: 0 -> 1 from `at` (1 means fully gone). */
export const exit = (at: number, options: {response?: number} = {}): ChoreoItem => {
  assertFinite('at', at);
  return springItem(at, options.response ?? SPRING.SMOOTH);
};

/**
 * One item leaves while the next arrives. Returns `[out, in]`; `out` starts at `from`, `in` at `to`.
 * `to < from + response` overlaps them.
 */
export const handoff = (from: number, to: number, options: {response?: number} = {}): [out: ChoreoItem, incoming: ChoreoItem] => {
  assertFinite('from', from);
  assertFinite('to', to);
  const response = options.response ?? SPRING.SMOOTH;
  return [springItem(from, response), springItem(to, response)];
};

/** A spring in flight: enough to sample position and velocity, or to retarget it without a jump. */
export interface SpringMotion {
  /** Second the spring started. */
  start: number;
  from: number;
  to: number;
  /** Initial velocity in value units per second. */
  velocity: number;
  response: number;
  bounce: number;
}

export interface SpringSample {
  value: number;
  /** Value units per second. */
  velocity: number;
}

export interface SpringMotionOptions {
  start?: number;
  from?: number;
  to?: number;
  response?: number;
  bounce?: number;
}

/**
 * Spring from `from` to `to` that begins with `initialVelocity` (units per second), so a new animation can inherit motion.
 * Same dynamics as iosSpring (response, bounce); with velocity 0 and from 0, to 1 it equals iosSpring.
 */
export const springWithVelocity = (initialVelocity: number, options: SpringMotionOptions = {}): SpringMotion => {
  const {start = 0, from = 0, to = 1, response = SPRING.SMOOTH, bounce = 0} = options;
  assertFinite('initialVelocity', initialVelocity);
  assertFinite('start', start);
  assertFinite('from', from);
  assertFinite('to', to);
  if (!Number.isFinite(response) || response <= 0) throw new RangeError('choreo: response must be > 0');
  if (!Number.isFinite(bounce) || bounce < 0 || bounce > 0.4) throw new RangeError('choreo: bounce must be between 0 and 0.4');
  return {start, from, to, velocity: initialVelocity, response, bounce};
};

/** Position and velocity of a spring at `time` (seconds). Before `start` it rests at `from`; at `start` velocity is the initial velocity. */
export const sampleSpring = (m: SpringMotion, time: number): SpringSample => {
  const t = time - m.start;
  if (t < 0) return {value: m.from, velocity: 0};
  if (t === 0) return {value: m.from, velocity: m.velocity};
  const w = (2 * Math.PI) / m.response;
  const e0 = m.from - m.to;
  const v0 = m.velocity;
  if (m.bounce > 0) {
    const zeta = 1 - 2 * m.bounce;
    const wd = w * Math.sqrt(4 * m.bounce * (1 - m.bounce));
    const b = (v0 + zeta * w * e0) / wd;
    const decay = Math.exp(-zeta * w * t);
    const c = Math.cos(wd * t);
    const s = Math.sin(wd * t);
    const e = decay * (e0 * c + b * s);
    const ev = decay * ((-zeta * w * e0 + wd * b) * c + (-zeta * w * b - wd * e0) * s);
    return {value: m.to + e, velocity: ev};
  }
  const k = v0 + w * e0;
  const decay = Math.exp(-w * t);
  return {value: m.to + (e0 + k * t) * decay, velocity: (v0 - w * k * t) * decay};
};

/**
 * Start a new spring at `time` from where `prev` is (position and velocity), aimed at `to`.
 * Position and velocity are continuous across the handover. Defaults keep prev's target, response and bounce.
 */
export const retarget = (prev: SpringMotion, time: number, to: number = prev.to, options: {response?: number; bounce?: number} = {}): SpringMotion => {
  assertFinite('time', time);
  const s = sampleSpring(prev, time);
  return springWithVelocity(s.velocity, {
    start: time,
    from: s.value,
    to,
    response: options.response ?? prev.response,
    bounce: options.bounce ?? prev.bounce,
  });
};
