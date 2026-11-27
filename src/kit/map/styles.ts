/** Map styles derived ONLY from kit theme tokens (no hard-coded colours). `night` = midnight: navy land, hairline borders. */
import {rgba, getTheme, type Theme} from '../tokens';
import type {MapStyle, MapStyleName} from './types';

/** Builds a style from any theme. Dark themes: land sits above the water. Light theme: land is the lifted white. */
export const mapStyleFromTheme = (theme: Theme, name: MapStyleName = theme.name === 'midnight' ? 'night' : (theme.name as MapStyleName)): MapStyle => {
  const c = theme.colors;
  const lightTheme = theme.name === 'light';
  return {
    name,
    water: c.background.deep,
    land: lightTheme ? c.background.lift : c.background.base,
    landAlt: lightTheme ? c.background.base : c.background.lift,
    stroke: rgba(c.text.tertiary, lightTheme ? 0.7 : 0.55),
    strokeSoft: rgba(c.text.tertiary, lightTheme ? 0.35 : 0.28),
    highlight: c.accent,
    highlightFill: rgba(c.accent, lightTheme ? 0.22 : 0.28),
    road: rgba(c.text.secondary, lightTheme ? 0.55 : 0.4),
    roadMajor: rgba(c.text.primary, lightTheme ? 0.7 : 0.65),
    waterFill: c.background.deep,
    park: rgba(c.semantic.positive, lightTheme ? 0.22 : 0.16),
    dim: c.background.deep,
    dimOpacity: lightTheme ? 0.55 : 0.4,
    highlightSolid: rgba(c.accent, lightTheme ? 0.86 : 0.8),
    innerLight: lightTheme ? c.background.lift : c.text.primary,
    glow: c.accent,
    // light themes have a pale `deep`, so their shadow ink is the dark text colour
    shadow: rgba(lightTheme ? c.text.primary : c.background.deep, lightTheme ? 0.42 : 0.85),
    missing: rgba(c.text.tertiary, lightTheme ? 0.14 : 0.16),
    missingHatch: rgba(c.text.tertiary, lightTheme ? 0.75 : 0.7),
    hairline: 0.75,
  };
};

/** night (midnight), light, mono variants. */
export const mapStyle = (name: MapStyleName): MapStyle => mapStyleFromTheme(getTheme(name === 'night' ? 'midnight' : name), name);
