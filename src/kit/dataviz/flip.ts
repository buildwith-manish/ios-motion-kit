/**
 * Pure FLIP state for <Ticker>. A ticker is a list of timed "steps"; each step is the full ranked list at that moment.
 * Between steps every row springs from where it is NOW (First) to its new slot (Last), so rows slide and never
 * teleport, even if a new step starts while the previous re-rank is still settling (the next spring begins from the
 * mid-flight position). New rows rise in, removed rows fade out. All of it is a function of `time` in seconds.
 */
import {clamp01, lerp, springProgress, type NumberFormat, type Tone} from './common';

/**
 * One ranked row. `id` is the identity that FLIP tracks across steps.
 * @example {id: 'a', label: 'Alder', value: 4200, prefix: '$'}
 */
export interface TickerRow extends NumberFormat {
  id: string;
  label: string;
  value: number;
  /** Colours the rank chip. Default: neutral. */
  tone?: Tone;
}

/**
 * The ranked list from second `at` on. List order = display order (index 0 is the top slot).
 * @example {at: 4.5, rows: [{id: 'b', label: 'Birch', value: 5100}, {id: 'a', label: 'Alder', value: 4200}]}
 */
export interface TickerStep {
  at: number;
  rows: TickerRow[];
}

/** Where one row is, and how it looks, at one moment. */
export interface RowState {
  id: string;
  /** Latest row data (label, formatting, tone). */
  row: TickerRow;
  /** Fractional slot index: multiply by the row pitch for px. */
  slot: number;
  /** Fractional rank (1-based). Round it for display: it counts through the numbers while the row slides. */
  rank: number;
  opacity: number;
  /** Rolling value. */
  value: number;
}

/** Motion options of {@link tickerStateAt}. */
export interface FlipOptions {
  /** Spring response in seconds. Default 0.6. */
  response?: number;
  /** Seconds between rows of the first step entering. Default 0.07. */
  stagger?: number;
  /** Slots a new row rises from. Default 0.5. */
  enterSlots?: number;
  /** Slots a removed row drifts down while fading. Default 0.35. */
  exitSlots?: number;
  /** The first step's values count up from 0. Default true. */
  rollFirst?: boolean;
  /** Seconds a NEW row waits (in later steps) so a removed row has mostly faded first. Default 0.12. */
  swapDelay?: number;
}

const applyStep = (prev: RowState[] | null, step: TickerStep, time: number, o: Required<FlipOptions>): RowState[] => {
  const before = new Map((prev ?? []).map((r) => [r.id, r]));
  const out: RowState[] = [];
  step.rows.forEach((row, i) => {
    const b = before.get(row.id);
    const delay = b ? 0 : prev === null ? i * o.stagger : o.swapDelay;
    const p = springProgress(time - step.at - delay, o.response);
    out.push(
      b
        ? {id: row.id, row, slot: lerp(b.slot, i, p), rank: lerp(b.rank, i + 1, p), opacity: lerp(b.opacity, 1, p), value: lerp(b.value, row.value, p)}
        : {id: row.id, row, slot: lerp(i + o.enterSlots, i, p), rank: i + 1, opacity: p, value: prev === null && o.rollFirst ? row.value * p : row.value},
    );
  });
  (prev ?? []).forEach((b) => {
    if (step.rows.some((r) => r.id === b.id)) return;
    const p = springProgress(time - step.at, o.response);
    const opacity = lerp(b.opacity, 0, clamp01(p * 2.2));
    if (opacity > 0.003) out.push({...b, slot: lerp(b.slot, b.slot + o.exitSlots, p), opacity});
  });
  return out;
};

/**
 * State of every row at `time` seconds. Rows are returned in their latest list order (leaving rows last), with stable
 * ids so a renderer keeps one DOM node per row. Empty before the first step.
 * @example const rows = tickerStateAt(steps, frame / fps, {response: 0.6});
 */
export const tickerStateAt = (steps: readonly TickerStep[], time: number, opts: FlipOptions = {}): RowState[] => {
  const o: Required<FlipOptions> = {response: 0.6, stagger: 0.07, enterSlots: 0.5, exitSlots: 0.35, rollFirst: true, swapDelay: 0.12, ...opts};
  let k = -1;
  for (let j = 0; j < steps.length; j++) if (steps[j].at <= time) k = j;
  if (k < 0) return [];
  let cur: RowState[] | null = null;
  for (let j = 0; j <= k; j++) cur = applyStep(cur, steps[j], j === k ? time : steps[j + 1].at, o);
  return cur ?? [];
};

/**
 * The time a ticker finishes moving: the last step's start plus enough spring (and stagger) to settle.
 * @example const end = tickerEndTime(steps, 0.6)
 */
export const tickerEndTime = (steps: readonly TickerStep[], response: number = 0.6, stagger: number = 0.07): number => {
  const last = steps[steps.length - 1];
  return last ? last.at + response * 2 + stagger * last.rows.length : 0;
};
