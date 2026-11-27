import {defaultDirection, getTransition, MAX_LAYER_BLUR, type TransitionOptionsByKind} from './effects';
import {transitionProgress, type TimingOptions} from './progress';
import type {Direction, LayerState, TransitionKind} from './types';

/** Inputs for {@link auditTransition}. */
export interface AuditInput {
  kind: TransitionKind;
  fps: number;
  width: number;
  height: number;
  /** Seconds. */
  duration: number;
  direction?: Direction;
  timing?: TimingOptions;
  options?: TransitionOptionsByKind;
}

/** Result of {@link auditTransition}. */
export interface AuditResult {
  ok: boolean;
  frames: number;
  violations: string[];
}

const moved = (a: LayerState, b: LayerState): number =>
  Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty) + Math.abs(a.scale - b.scale) * 100 + Math.abs(a.blur - b.blur) + Math.abs(a.opacity - b.opacity) * 10;

/**
 * Checks the transition rules for every frame of the window, using only the pure layer functions: progress is
 * monotonic and lands on exactly 0 and 1, the outgoing opacity is 0 at the end, no layer blur exceeds 20px, and no
 * frame has both layers at ~half opacity while both are static. Pure; safe to run in node.
 * @example const r = auditTransition({kind: 'push', fps: 60, width: 1920, height: 1080, duration: 0.8}); // r.ok === true
 */
export const auditTransition = (i: AuditInput): AuditResult => {
  const fn = getTransition(i.kind, i.options);
  const ctx = {width: i.width, height: i.height, direction: i.direction ?? defaultDirection[i.kind]};
  const n = Math.round(i.duration * i.fps);
  const violations: string[] = [];
  let lastP = -1;
  for (let f = 0; f <= n + 1; f++) {
    const p = transitionProgress(f, 0, i.duration, i.fps, i.timing);
    const pPrev = transitionProgress(f - 1, 0, i.duration, i.fps, i.timing);
    if (p < lastP - 1e-9) violations.push(`frame ${f}: progress went backwards (${lastP} -> ${p})`);
    lastP = p;
    const cur = fn(p, ctx);
    const prev = fn(pPrev, ctx);
    for (const [name, l] of [['outgoing', cur.outgoing], ['incoming', cur.incoming]] as const) {
      if (l.blur > MAX_LAYER_BLUR + 1e-9) violations.push(`frame ${f}: ${name} blur ${l.blur}px > ${MAX_LAYER_BLUR}`);
      if (l.opacity < -1e-9 || l.opacity > 1 + 1e-9) violations.push(`frame ${f}: ${name} opacity ${l.opacity} out of range`);
    }
    const half = (o: number) => o > 0.25 && o < 0.75;
    if (half(cur.outgoing.opacity) && half(cur.incoming.opacity)) {
      const motion = moved(cur.outgoing, prev.outgoing) + moved(cur.incoming, prev.incoming);
      if (motion < 1e-3) violations.push(`frame ${f}: both scenes ~half opacity and static`);
    }
    if (f === 0 && p !== 0) violations.push(`start progress is ${p}, expected 0`);
    if (f >= n) {
      if (p !== 1) violations.push(`frame ${f}: progress ${p}, expected exactly 1 at the end`);
      if (cur.outgoing.opacity !== 0) violations.push(`frame ${f}: outgoing opacity ${cur.outgoing.opacity}, expected 0 at the end`);
      if (cur.incoming.opacity !== 1 || cur.incoming.mask) violations.push(`frame ${f}: incoming not fully shown at the end`);
    }
  }
  return {ok: violations.length === 0, frames: n + 2, violations};
};
