import type {TimedWord} from '../text/types';

type JsonInput = string | unknown;

const parseJson = (input: JsonInput, name: string): unknown => {
  if (typeof input !== 'string') return input;
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    throw new SyntaxError(`${name}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordsFrom = (value: unknown, name: string): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) throw new TypeError(`${name}: expected an array or an object containing timed words`);

  for (const key of ['words', 'timings']) {
    if (Array.isArray(value[key])) return value[key];
  }

  if (Array.isArray(value.segments)) {
    return value.segments.flatMap((segment) => (isRecord(segment) && Array.isArray(segment.words) ? segment.words : [segment]));
  }

  if (typeof value.text === 'string' || typeof value.word === 'string') return [value];
  throw new TypeError(`${name}: expected "words", "timings", or "segments"`);
};

const spanFrom = (value: unknown, index: number, name: string): {text: string; start: number; end: number} => {
  if (!isRecord(value)) throw new TypeError(`${name}: entry ${index} must be an object`);
  const text = typeof value.word === 'string' ? value.word : value.text;
  if (typeof text !== 'string') throw new TypeError(`${name}: entry ${index} is missing a string "word" or "text"`);
  if (typeof value.start !== 'number' || typeof value.end !== 'number') {
    throw new TypeError(`${name}: entry ${index} must have numeric "start" and "end" seconds`);
  }
  return {text, start: value.start, end: value.end};
};

const splitSpan = (span: {text: string; start: number; end: number}): TimedWord[] => {
  const tokens = span.text.trim().split(/\s+/u).filter(Boolean);
  if (!tokens.length) return [];
  if (tokens.length === 1) return [{...span, text: tokens[0]}];

  const weights = tokens.map((token) => Math.max(1, Array.from(token).length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const duration = span.end - span.start;
  let elapsed = 0;
  return tokens.map((text, index) => {
    const start = span.start + (duration * elapsed) / total;
    elapsed += weights[index];
    const end = index === tokens.length - 1 ? span.end : span.start + (duration * elapsed) / total;
    return {text, start, end};
  });
};

/** Returns timing-data problems. Words must be ordered, finite, non-negative, and contain no whitespace. */
export const validateTimedWords = (words: readonly TimedWord[]): string[] => {
  const issues: string[] = [];
  if (!words.length) issues.push('timings must contain at least one word');
  words.forEach((word, index) => {
    if (typeof word.text !== 'string' || !word.text.trim() || /\s/u.test(word.text)) {
      issues.push(`word ${index}: text must be one non-empty word without spaces`);
    }
    if (!Number.isFinite(word.start) || word.start < 0) issues.push(`word ${index}: start must be a finite, non-negative number`);
    if (!Number.isFinite(word.end) || word.end < word.start) issues.push(`word ${index}: end must be finite and no earlier than start`);
    if (index > 0 && word.start < words[index - 1].start) issues.push(`word ${index}: starts before the previous word`);
  });
  return issues;
};

const validated = (words: TimedWord[], name: string): TimedWord[] => {
  const issues = validateTimedWords(words);
  if (issues.length) throw new RangeError(`${name}: ${issues.join('; ')}`);
  return words;
};

/**
 * Parses generic JSON timing data. Accepts `{words:[{text,start,end}]}`, `{segments:[...]}`, or a timed-word array.
 * Multi-word spans are split proportionally by character count; all times are seconds.
 */
export const parseTimedWordsJson = (input: JsonInput): TimedWord[] => {
  const root = parseJson(input, 'timing JSON');
  const records = recordsFrom(root, 'timing JSON');
  const words = records.flatMap((record, index) => splitSpan(spanFrom(record, index, 'timing JSON')));
  return validated(words, 'timing JSON');
};

/** Parses Whisper / WhisperX JSON, including `segments[].words[]` and word-level arrays. */
export const parseWhisperWordTimestamps = (input: JsonInput): TimedWord[] => {
  const root = parseJson(input, 'Whisper timing JSON');
  const records = recordsFrom(root, 'Whisper timing JSON');
  const words = records.flatMap((record, index) => splitSpan(spanFrom(record, index, 'Whisper timing JSON')));
  return validated(words, 'Whisper timing JSON');
};

const parseTimestamp = (value: string, name: string): number => {
  const match = /^(\d+(?::\d{2}){1,2})(?:[.,](\d{1,3}))?$/u.exec(value);
  if (!match) throw new SyntaxError(`${name}: invalid timestamp "${value}"`);
  const fields = match[1].split(':').map(Number);
  const seconds = fields.pop()!;
  const minutes = fields.pop()!;
  const hours = fields.length ? fields[0] : 0;
  if (seconds >= 60 || minutes >= 60) throw new RangeError(`${name}: timestamp component out of range "${value}"`);
  const fraction = match[2] ? Number(`0.${match[2]}`) : 0;
  return hours * 3600 + minutes * 60 + seconds + fraction;
};

const parseSubtitles = (input: string, format: 'SRT' | 'VTT'): TimedWord[] => {
  if (!input.trim()) throw new SyntaxError(`${format}: subtitle input is empty`);
  const timeToken = String.raw`\d+(?::\d{2}){1,2}(?:[.,]\d{1,3})?`;
  const timingLine = new RegExp(String.raw`^\s*(${timeToken})\s+-->\s+(${timeToken})(?:\s+.*)?$`, 'u');
  const words: TimedWord[] = [];
  const blocks = input.replace(/\r/gu, '').split(/\n\s*\n/u);

  blocks.forEach((block, blockIndex) => {
    const lines = block.split('\n');
    const lineIndex = lines.findIndex((line) => line.includes('-->'));
    if (lineIndex < 0) return;
    const match = timingLine.exec(lines[lineIndex]);
    if (!match) throw new SyntaxError(`${format}: malformed timing line in block ${blockIndex + 1}`);
    const start = parseTimestamp(match[1], format);
    const end = parseTimestamp(match[2], format);
    if (end < start) throw new RangeError(`${format}: block ${blockIndex + 1} ends before it starts`);
    const text = lines
      .slice(lineIndex + 1)
      .join(' ')
      .replace(/<br\s*\/?>/giu, ' ')
      .replace(/<[^>]*>/gu, ' ')
      .replace(/&nbsp;/giu, ' ')
      .replace(/&amp;/giu, '&')
      .replace(/&lt;/giu, '<')
      .replace(/&gt;/giu, '>')
      .replace(/&quot;/giu, '"')
      .replace(/&#39;|&apos;/giu, "'")
      .replace(/\s+/gu, ' ')
      .trim();
    words.push(...splitSpan({text, start, end}));
  });

  return validated(words, format);
};

/** Parses SubRip cues and distributes each cue's time span over its words. */
export const parseSrt = (input: string): TimedWord[] => parseSubtitles(input, 'SRT');

/** Parses WebVTT cues, ignoring cue IDs, settings, and inline markup. */
export const parseVtt = (input: string): TimedWord[] => parseSubtitles(input, 'VTT');
