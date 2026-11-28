import type {Theme} from '../tokens/types';

/** Overlay colour: a semantic theme colour name or any CSS colour; default the theme accent. */
export type OverlayColor = 'accent' | 'positive' | 'warning' | 'negative' | (string & {});

export const overlayInk = (theme: Theme, color: OverlayColor): string =>
  color === 'accent' ? theme.colors.accent
    : color === 'positive' ? theme.colors.semantic.positive
    : color === 'warning' ? theme.colors.semantic.warning
    : color === 'negative' ? theme.colors.semantic.negative
    : color;
