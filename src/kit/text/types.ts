/** Shared types for kit/text. Pure types, no runtime code. */

/** Text direction. 'auto' picks from the first strongly-directional character. */
export type TextDirection = 'ltr' | 'rtl' | 'auto';

/** Logical alignment: 'start' is the left edge in LTR and the right edge in RTL. */
export type TextAlign = 'start' | 'center' | 'end';

/** What <RevealText> animates as one unit. */
export type RevealMode = 'words' | 'lines' | 'chars';

/** One word with its position in a voice-over, in seconds. */
export interface TimedWord {
  /** The word as it should be displayed (punctuation attached is fine). */
  text: string;
  /** Second the word starts being spoken. */
  start: number;
  /** Second the word stops being spoken. */
  end: number;
}
