import {layoutWords, type LayoutOptions} from './layout';
import type {TimedWord} from './types';

/** One caption page: a run of words shown together on at most `maxLines` lines. */
export interface CaptionPage {
  /** Second the first word starts. */
  start: number;
  /** Second the last word ends. */
  end: number;
  words: TimedWord[];
}

export interface PaginateOptions extends Omit<LayoutOptions, 'maxLines'> {
  /** Line limit per page. Default 2. */
  maxLines?: number;
  /** Start a new page when a page would last longer than this many seconds. Default 4. */
  maxPageSeconds?: number;
  /** Start a new page after a silence longer than this many seconds between words. Default 0.7. */
  breakOnGap?: number;
}

/**
 * Splits word timings into caption pages that each fit `maxLines` lines at the given font size and box width. Breaks
 * also on long pauses and after sentence-ending punctuation once a page has at least 4 words. Pure.
 * @example const pages = paginateCaptions(words, {fontSize: 44, metrics: INTER_700, maxWidth: 1400});
 */
export const paginateCaptions = (timings: readonly TimedWord[], o: PaginateOptions): CaptionPage[] => {
  const {maxLines = 2, maxPageSeconds = 4, breakOnGap = 0.7, ...layoutOpts} = o;
  const pages: CaptionPage[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (cur.length > 0) pages.push({start: cur[0].start, end: cur[cur.length - 1].end, words: cur});
    cur = [];
  };
  timings.forEach((w) => {
    if (cur.length > 0) {
      const last = cur[cur.length - 1];
      const tooLong = w.end - cur[0].start > maxPageSeconds;
      const pause = w.start - last.end > breakOnGap;
      const sentence = /[.!?\u061F\u3002]["'\u201D\u2019)]*$/.test(last.text) && cur.length >= 4;
      const overflow = layoutWords([...cur, w].map((x) => x.text), {...layoutOpts, maxLines}).lines.length > maxLines;
      if (tooLong || pause || sentence || overflow) flush();
    }
    cur.push(w);
  });
  flush();
  return pages;
};

/**
 * Index of the page showing at `time`: the last page whose start <= time and which has not ended by more than
 * `hold` seconds. Returns -1 before the first page or in a long gap.
 * @example const i = pageAt(pages, frame / fps, 0.25);
 */
export const pageAt = (pages: readonly CaptionPage[], time: number, hold: number = 0.25): number => {
  for (let i = pages.length - 1; i >= 0; i--) {
    if (time >= pages[i].start) return time < pages[i].end + hold ? i : -1;
  }
  return -1;
};
