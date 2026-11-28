/** Small pure scales for kit/charts (no d3). Linear, band and time. */

export interface LinearScale {
  (v: number): number;
  domain: [number, number];
  range: [number, number];
  invert: (px: number) => number;
}

/** Linear map domain -> range. A zero-width domain maps everything to the middle of the range. */
export const linearScale = (domain: [number, number], range: [number, number]): LinearScale => {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const f = ((v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0))) as LinearScale;
  f.domain = domain;
  f.range = range;
  f.invert = (px) => (r1 === r0 ? d0 : d0 + ((px - r0) / (r1 - r0)) * span);
  return f;
};

/** 1/2/5 x 10^n step giving about `count` intervals over `span`. */
export const niceStep = (span: number, count: number): number => {
  if (!(span > 0) || count < 1) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r >= 7.07 ? 10 : r >= 3.16 ? 5 : r >= 1.41 ? 2 : 1) * mag;
};

const clean = (v: number): number => Number(v.toPrecision(12));

/** Rounded-out domain on a nice step. min === max is padded; [0,0] becomes [0,1]. */
export const niceDomain = (min: number, max: number, count: number = 4): [number, number] => {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    if (lo === 0) return [0, 1];
    const pad = Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  return [clean(Math.floor(lo / step + 1e-9) * step), clean(Math.ceil(hi / step - 1e-9) * step)];
};

/** Tick values on a nice step inside [min, max] (inclusive). */
export const linearTicks = (min: number, max: number, count: number = 4): number[] => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo === hi) return [lo];
  const step = niceStep(hi - lo, count);
  const out: number[] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k++) out.push(clean(k * step));
  return out;
};

export interface BandScale {
  step: number;
  bandwidth: number;
  /** Left/top edge of band i. */
  start: (i: number) => number;
  /** Centre of band i. */
  center: (i: number) => number;
}

/** Evenly divided bands; padding as a fraction of the step. */
export const bandScale = (count: number, range: [number, number], paddingInner: number = 0.25, paddingOuter: number = 0.15): BandScale => {
  const n = Math.max(0, count);
  const total = range[1] - range[0];
  const step = n === 0 ? 0 : total / Math.max(1e-9, n - paddingInner + 2 * paddingOuter);
  const bandwidth = step * (1 - paddingInner);
  const origin = range[0] + step * paddingOuter;
  return {step, bandwidth, start: (i) => origin + step * i, center: (i) => origin + step * i + bandwidth / 2};
};

/** Milliseconds (UTC) from a date string, number or Date. ISO date-only strings are UTC. */
export const parseTime = (v: string | number | Date): number => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v));

export const timeScale = (domain: [number, number], range: [number, number]): LinearScale => linearScale(domain, range);

/** Month-aligned (UTC) ticks inside [t0, t1]: the smallest step of 1/3/6/12/24/60 months giving at most `count` ticks. */
export const timeTicks = (t0: number, t1: number, count: number = 5): number[] => {
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  for (const months of [1, 3, 6, 12, 24, 60, 120]) {
    const d = new Date(lo);
    let y = d.getUTCFullYear();
    let m = Math.floor(d.getUTCMonth() / months) * months;
    const out: number[] = [];
    for (let guard = 0; guard < 2000; guard++) {
      const t = Date.UTC(y, m, 1);
      if (t > hi) break;
      if (t >= lo) out.push(t);
      m += months;
      y += Math.floor(m / 12);
      m %= 12;
    }
    if (out.length <= count) return out;
  }
  return [lo];
};
