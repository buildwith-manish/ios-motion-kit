/**
 * Stacking math. Positive values stack up from 0, negative values stack down from 0 (separately), in series order.
 * A missing value (null/NaN) is a gap: it takes no space and is flagged, never treated as 0 for display.
 */
export interface StackedValue {
  y0: number;
  y1: number;
  missing: boolean;
}

export const isMissing = (v: number | null | undefined): v is null | undefined => v === null || v === undefined || Number.isNaN(v);

/** @returns result[series][index] */
export const stackValues = (series: ReadonlyArray<ReadonlyArray<number | null>>): StackedValue[][] => {
  const n = series.reduce((m, s) => Math.max(m, s.length), 0);
  const out: StackedValue[][] = series.map(() => []);
  for (let i = 0; i < n; i++) {
    let pos = 0;
    let neg = 0;
    series.forEach((s, k) => {
      const v = s[i];
      if (isMissing(v)) out[k][i] = {y0: pos, y1: pos, missing: true};
      else if (v >= 0) {
        out[k][i] = {y0: pos, y1: pos + v, missing: false};
        pos += v;
      } else {
        out[k][i] = {y0: neg, y1: neg + v, missing: false};
        neg += v;
      }
    });
  }
  return out;
};

/** [min, max] over every non-missing y0/y1, or null if there is no data. */
export const stackExtent = (stacked: readonly (readonly StackedValue[])[]): [number, number] | null => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of stacked) for (const v of s) if (!v.missing) {
    lo = Math.min(lo, v.y0, v.y1);
    hi = Math.max(hi, v.y0, v.y1);
  }
  return lo > hi ? null : [lo, hi];
};
