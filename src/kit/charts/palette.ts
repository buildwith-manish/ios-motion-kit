import {toneColor, type Tone} from '../dataviz/common';
import type {Theme} from '../tokens/types';

/**
 * Series colours, in this fixed order (series i uses SERIES_TONES[i % 6]): accent, positive, warning, negative,
 * primary, secondary. All are theme tokens, so midnight / light / mono each restyle them; a series can override
 * with `tone`. Colours only identify series: the legend and end-of-line labels name them too.
 */
export const SERIES_TONES: readonly Tone[] = ['accent', 'positive', 'warning', 'negative', 'primary', 'secondary'];

export const seriesTone = (i: number, override?: Tone): Tone => override ?? SERIES_TONES[((i % SERIES_TONES.length) + SERIES_TONES.length) % SERIES_TONES.length];
export const seriesColor = (theme: Theme, i: number, override?: Tone): string => toneColor(theme, seriesTone(i, override));
