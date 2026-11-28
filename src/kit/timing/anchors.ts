import type {TimedWord} from '../text/types';

export interface WordMatch {
  index: number;
  word: TimedWord;
}

const normalize = (text: string): string => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const tokens = (text: string): string[] => text.trim().split(/\s+/u).map(normalize).filter(Boolean);

const validateOccurrence = (occurrence: number): void => {
  if (!Number.isInteger(occurrence) || occurrence < 1) throw new RangeError('occurrence must be a positive, 1-based integer');
};

/** Finds the 1-based occurrence of a word, ignoring case and punctuation at any position in the token. */
export const findWord = (words: readonly TimedWord[], query: string, occurrence = 1): WordMatch | undefined => {
  validateOccurrence(occurrence);
  const wanted = tokens(query);
  if (wanted.length !== 1) throw new TypeError('findWord query must contain exactly one word');
  let seen = 0;
  for (let index = 0; index < words.length; index++) {
    if (normalize(words[index].text) !== wanted[0]) continue;
    if (++seen === occurrence) return {index, word: words[index]};
  }
  return undefined;
};

/** Finds the 1-based occurrence of a contiguous phrase and returns the matching timed words. */
export const findPhrase = (words: readonly TimedWord[], query: string, occurrence = 1): readonly TimedWord[] | undefined => {
  validateOccurrence(occurrence);
  const wanted = tokens(query);
  if (!wanted.length) throw new TypeError('findPhrase query must contain at least one word');
  let seen = 0;
  for (let index = 0; index <= words.length - wanted.length; index++) {
    if (!wanted.every((word, offset) => normalize(words[index + offset].text) === word)) continue;
    if (++seen === occurrence) return words.slice(index, index + wanted.length);
  }
  return undefined;
};
